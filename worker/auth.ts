import { checkRateLimit, clientIp, rateLimitedResponse } from "./rate-limit";
import { expectedTurnstileHostnames, verifyTurnstileToken } from "./turnstile";
import { processEmailOutbox } from "./email";

const TURNSTILE_LOGIN_ACTION = "login";
const TURNSTILE_EMAIL_ACTION = "email_login";
const EMAIL_OTP_TTL_SECONDS = 10 * 60;
const EMAIL_OTP_MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AUTH_JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_STATE_SECONDS = 10 * 60;
const FRESH_SESSION_WINDOW = "-30 minutes";

type AuthEnv = Env & { GOOGLE_CLIENT_SECRET?: string };
export type PipiroRole = "customer" | "admin" | "kitchen" | "delivery";
export type PipiroSurface = "family" | "admin" | "kitchen";
export type RequestActor = {
  userId: string;
  user: { id: string; email: string; display_name: string; locale: string };
  roles: string[];
  demo: boolean;
  /** False once the session is older than FRESH_SESSION_WINDOW; gates high-risk admin actions via requireFreshAuth. */
  sessionFresh: boolean;
};
type LoginStateRow = { code_verifier: string; nonce_hash: string; return_to: string; expires_at: number };
type GoogleClaims = {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  locale?: string;
  nonce: string;
  exp: number;
  iat: number;
};

function authJson(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, { ...init, headers: { ...AUTH_JSON_HEADERS, ...init?.headers } });
}

function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

async function equalHashes(first: string, second: string): Promise<boolean> {
  const [firstHash, secondHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(first)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(second)),
  ]);
  const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean };
  return subtle.timingSafeEqual(firstHash, secondHash);
}

function cookieMap(request: Request): Map<string, string> {
  const values = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    values.set(part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim()));
  }
  return values;
}

function isLocalUrl(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

export function isPrivateDemoHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return true;
  if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) return true;
  const private172 = hostname.match(/^172\.(\d+)\./);
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true;
  const tailscale = hostname.match(/^100\.(\d+)\./);
  return Boolean(tailscale && Number(tailscale[1]) >= 64 && Number(tailscale[1]) <= 127);
}

function configuredOrigins(env: Env): Array<{ origin: string; surface: PipiroSurface }> {
  return [
    { origin: env.APP_ORIGIN, surface: "family" },
    { origin: env.ADMIN_ORIGIN, surface: "admin" },
    { origin: env.KDS_ORIGIN, surface: "kitchen" },
  ];
}

export function requestSurface(url: URL, env: Env): PipiroSurface | null {
  return configuredOrigins(env).find((entry) => entry.origin === url.origin)?.surface ?? null;
}

function appOrigin(url: URL, env: Env): string {
  if (isPrivateDemoHost(url.hostname)) return url.origin;
  return configuredOrigins(env).some((entry) => entry.origin === url.origin) ? url.origin : env.APP_ORIGIN;
}

function authCookieName(url: URL, suffix: "session" | "oauth"): string {
  return isLocalUrl(url) ? `pipiro_${suffix}` : `__Host-pipiro_${suffix}`;
}

function setCookie(name: string, value: string, maxAge: number, secure: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function clearCookie(name: string, secure: boolean): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

function safeReturnTo(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") && value.length <= 500 ? value : "/";
}

function normalizedEmailOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLocaleLowerCase("en-US");
  return trimmed.length >= 3 && trimmed.length <= 200 && EMAIL_RE.test(trimmed) ? trimmed : null;
}

function randomOtpCode(): string {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(value[0] % 1_000_000).padStart(6, "0");
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function parseGoogleClaims(value: Record<string, unknown>): GoogleClaims | null {
  const emailVerified = value.email_verified === true || value.email_verified === "true";
  if (typeof value.iss !== "string" || typeof value.aud !== "string" || typeof value.sub !== "string" ||
      typeof value.email !== "string" || !emailVerified || typeof value.name !== "string" ||
      typeof value.nonce !== "string" || typeof value.exp !== "number" || typeof value.iat !== "number") return null;
  return { iss: value.iss, aud: value.aud, sub: value.sub, email: value.email, email_verified: true,
    name: value.name, locale: typeof value.locale === "string" ? value.locale : undefined,
    nonce: value.nonce, exp: value.exp, iat: value.iat };
}

async function verifyGoogleIdToken(idToken: string, env: Env, expectedNonceHash: string): Promise<GoogleClaims | null> {
  const segments = idToken.split(".");
  if (segments.length !== 3) return null;
  const header = parseJsonRecord(new TextDecoder().decode(decodeBase64Url(segments[0])));
  const rawClaims = parseJsonRecord(new TextDecoder().decode(decodeBase64Url(segments[1])));
  if (!header || !rawClaims || header.alg !== "RS256" || typeof header.kid !== "string") return null;

  const jwksResponse = await fetch(GOOGLE_JWKS_URL, { headers: { Accept: "application/json" } });
  if (!jwksResponse.ok) throw new Error("google_jwks_unavailable");
  const jwks: unknown = await jwksResponse.json();
  if (typeof jwks !== "object" || jwks === null || !("keys" in jwks) || !Array.isArray(jwks.keys)) return null;
  const matchingKey = jwks.keys.find((candidate) => typeof candidate === "object" && candidate !== null &&
    "kid" in candidate && candidate.kid === header.kid);
  if (!matchingKey) return null;
  const key = await crypto.subtle.importKey("jwk", matchingKey as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const validSignature = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBase64Url(segments[2]),
    new TextEncoder().encode(`${segments[0]}.${segments[1]}`));
  if (!validSignature) return null;

  const claims = parseGoogleClaims(rawClaims);
  const now = Math.floor(Date.now() / 1000);
  if (!claims || !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss) ||
      claims.aud !== env.GOOGLE_CLIENT_ID || claims.exp <= now || claims.iat > now + 60 ||
      !(await equalHashes(await sha256(claims.nonce), expectedNonceHash))) return null;
  return claims;
}

const LAST_SEEN_REFRESH_SECONDS = 60 * 60 * 24;

/**
 * Creates a session and records the login in audit_log — just who, when and how (Google vs.
 * email OTP), keyed by the session's token hash. Deliberately no IP address: that would build a
 * location/device trail beyond what "who logged in and when" needs, and rate limiting already
 * uses IP transiently (short-lived counters) without keeping it on a permanent record.
 */
async function createSession(env: Env, userId: string, userAgent: string | null, method: "google" | "email_otp"): Promise<string> {
  const sessionToken = randomToken();
  const sessionHash = await sha256(sessionToken);
  const sessionExpiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)")
      .bind(sessionHash, userId, sessionExpiresAt, userAgent?.slice(0, 300) ?? null),
    env.DB.prepare("INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'auth_session', ?)")
      .bind(crypto.randomUUID(), userId, `login.${method}`, sessionHash),
  ]);
  return sessionToken;
}

export async function resolveSession(request: Request, env: Env, url: URL): Promise<{
  tokenHash: string;
  user: { id: string; email: string; display_name: string; locale: string };
  roles: string[];
  fresh: boolean;
} | null> {
  const cookies = cookieMap(request);
  const token = cookies.get(authCookieName(url, "session")) ?? cookies.get("pipiro_session");
  if (!token || token.length < 32 || token.length > 200) return null;
  const tokenHash = await sha256(token);
  const user = await env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.locale, (s.created_at > datetime('now', ?)) AS fresh FROM auth_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.status = 'active' LIMIT 1`,
  ).bind(FRESH_SESSION_WINDOW, tokenHash, Math.floor(Date.now() / 1000))
    .first<{ id: string; email: string; display_name: string; locale: string; fresh: number }>();
  if (!user) return null;
  const roles = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?").bind(user.id).all<{ role: string }>();
  // Keep "last seen" useful for the sessions list without writing on every request.
  await env.DB.prepare(
    "UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND last_seen_at < datetime('now', ?)",
  ).bind(tokenHash, `-${LAST_SEEN_REFRESH_SECONDS} seconds`).run();
  return {
    tokenHash,
    user: { id: user.id, email: user.email, display_name: user.display_name, locale: user.locale },
    roles: roles.results.map((role) => role.role),
    fresh: Boolean(user.fresh),
  };
}

function requestOriginAllowed(request: Request, env: Env, url: URL): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === appOrigin(url, env));
}

export async function authorizeRequest(
  request: Request,
  env: Env,
  url: URL,
  allowedRoles: PipiroRole[],
  demoUserId: string,
): Promise<{ actor: RequestActor | null; response: Response | null }> {
  if (!requestOriginAllowed(request, env, url)) {
    return { actor: null, response: authJson({ error: "Origen no permitido" }, { status: 403 }) };
  }
  const session = await resolveSession(request, env, url);
  if (session) {
    if (!allowedRoles.some((role) => session.roles.includes(role))) {
      return { actor: null, response: authJson({ error: "No tienes permiso para esta sección" }, { status: 403 }) };
    }
    return { actor: { userId: session.user.id, user: session.user, roles: session.roles, demo: false, sessionFresh: session.fresh }, response: null };
  }
  if (env.DEMO_MODE === "true" && isPrivateDemoHost(url.hostname)) {
    const user = await env.DB.prepare(
      "SELECT id, email, display_name, locale FROM app_users WHERE id = ? LIMIT 1",
    ).bind(demoUserId).first<{ id: string; email: string; display_name: string; locale: string }>();
    if (user) return { actor: { userId: user.id, user, roles: allowedRoles, demo: true, sessionFresh: true }, response: null };
  }
  return { actor: null, response: authJson({ error: "Debes iniciar sesión" }, { status: 401 }) };
}

/**
 * Gates high-risk admin actions (granting privileged roles, approving/cancelling payments,
 * changing payout bank details) behind a recently-created session. There's no password to
 * re-prompt for (login is Google or email OTP), so "fresh" means the session itself — the
 * actual sign-in — happened within FRESH_SESSION_WINDOW; otherwise the client must sign in
 * again (which creates a new session and clears this check) before the action proceeds.
 */
export function requireFreshAuth(actor: RequestActor): Response | null {
  if (actor.demo || actor.sessionFresh) return null;
  return authJson({
    error: "reauth_required",
    message: "Por seguridad, vuelve a iniciar sesión para confirmar esta acción.",
  }, { status: 401 });
}

export async function authorizeSurface(request: Request, env: Env, url: URL, roles: PipiroRole[]): Promise<Response | null> {
  if (env.DEMO_MODE === "true" && isPrivateDemoHost(url.hostname)) return null;
  const session = await resolveSession(request, env, url);
  if (!session) {
    return new Response(null, { status: 302, headers: { Location: `/login?returnTo=${encodeURIComponent(url.pathname)}`, "Cache-Control": "no-store" } });
  }
  if (!roles.some((role) => session.roles.includes(role))) {
    return new Response("No tienes permiso para acceder a esta sección.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return null;
}

export async function handleAuthApi(request: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/auth/")) return null;

  if (request.method === "GET" && url.pathname === "/api/auth/google/start") {
    const authEnv: AuthEnv = env;
    if (!authEnv.GOOGLE_CLIENT_SECRET) return authJson({ error: "Google login is not configured" }, { status: 503 });
    const origin = appOrigin(url, env);
    const loginFailure = (reason: string) => new Response(null, {
      status: 302,
      headers: { Location: `${origin}/login?error=${encodeURIComponent(reason)}`, "Cache-Control": "no-store" },
    });
    const rateLimit = await checkRateLimit(env, `auth_start:${clientIp(request)}`, 15, 10 * 60);
    if (!rateLimit.allowed) return loginFailure("rate_limited");
    const expectedHostnames = expectedTurnstileHostnames(env, isPrivateDemoHost(url.hostname) ? url.hostname : null);
    const turnstileOk = await verifyTurnstileToken(
      env, url.searchParams.get("turnstileToken"), clientIp(request), TURNSTILE_LOGIN_ACTION, expectedHostnames,
    );
    if (!turnstileOk) return loginFailure("turnstile_failed");
    const state = randomToken();
    const nonce = randomToken();
    const codeVerifier = randomToken(48);
    const [stateHash, nonceHash, codeChallenge] = await Promise.all([sha256(state), sha256(nonce), sha256(codeVerifier)]);
    const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
    const expiresAt = Math.floor(Date.now() / 1000) + OAUTH_STATE_SECONDS;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO oauth_login_states (state_hash, code_verifier, nonce_hash, return_to, expires_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(stateHash, codeVerifier, nonceHash, returnTo, expiresAt),
      env.DB.prepare("DELETE FROM oauth_login_states WHERE expires_at < ? OR consumed_at IS NOT NULL")
        .bind(Math.floor(Date.now() / 1000) - OAUTH_STATE_SECONDS),
    ]);
    const authorize = new URL(GOOGLE_AUTHORIZE_URL);
    authorize.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${origin}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return new Response(null, {
      status: 302,
      headers: {
        Location: authorize.toString(),
        "Cache-Control": "no-store",
        "Set-Cookie": setCookie(authCookieName(url, "oauth"), state, OAUTH_STATE_SECONDS, origin.startsWith("https://")),
      },
    });
  }

  if (request.method === "GET" && url.pathname === "/api/auth/google/callback") {
    const authEnv: AuthEnv = env;
    const origin = appOrigin(url, env);
    const failure = (reason: string) => new Response(null, { status: 302, headers: {
      Location: `${origin}/login?error=${encodeURIComponent(reason)}`,
      "Cache-Control": "no-store",
      "Set-Cookie": clearCookie(authCookieName(url, "oauth"), origin.startsWith("https://")),
    } });
    if (!authEnv.GOOGLE_CLIENT_SECRET) return failure("not_configured");
    if (url.searchParams.get("error")) return failure("access_denied");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = cookieMap(request).get(authCookieName(url, "oauth")) ?? cookieMap(request).get("pipiro_oauth");
    if (!code || code.length > 4096 || !state || !cookieState || !(await equalHashes(state, cookieState))) return failure("invalid_state");
    const stateHash = await sha256(state);
    const loginState = await env.DB.prepare(
      "SELECT code_verifier, nonce_hash, return_to, expires_at FROM oauth_login_states WHERE state_hash = ? AND consumed_at IS NULL LIMIT 1",
    ).bind(stateHash).first<LoginStateRow>();
    if (!loginState || loginState.expires_at <= Math.floor(Date.now() / 1000)) return failure("expired_state");
    const consumed = await env.DB.prepare(
      "UPDATE oauth_login_states SET consumed_at = CURRENT_TIMESTAMP WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ?",
    ).bind(stateHash, Math.floor(Date.now() / 1000)).run();
    if (!consumed.meta.changes) return failure("used_state");

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: authEnv.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${origin}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: loginState.code_verifier }),
    });
    const tokenPayload: unknown = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokenPayload !== "object" || tokenPayload === null ||
        !("id_token" in tokenPayload) || typeof tokenPayload.id_token !== "string") return failure("token_exchange_failed");
    const claims = await verifyGoogleIdToken(tokenPayload.id_token, env, loginState.nonce_hash);
    if (!claims) return failure("invalid_identity");

    const normalizedEmail = claims.email.trim().toLocaleLowerCase("en-US");
    const identity = await env.DB.prepare(
      "SELECT user_id FROM auth_identities WHERE provider = 'google' AND provider_subject = ? LIMIT 1",
    ).bind(claims.sub).first<{ user_id: string }>();
    let userId = identity?.user_id;
    if (userId) {
      await env.DB.prepare("UPDATE auth_identities SET email_snapshot = ?, last_login_at = CURRENT_TIMESTAMP WHERE provider = 'google' AND provider_subject = ?")
        .bind(normalizedEmail, claims.sub).run();
    } else {
      const existingUser = await env.DB.prepare("SELECT id FROM app_users WHERE email = ? COLLATE NOCASE LIMIT 1")
        .bind(normalizedEmail).first<{ id: string }>();
      userId = existingUser?.id ?? crypto.randomUUID();
      const statements: D1PreparedStatement[] = [];
      if (!existingUser && requestSurface(url, env) !== "family") return failure("invitation_required");
      if (!existingUser) {
        statements.push(
          env.DB.prepare("INSERT INTO app_users (id, email, display_name, locale, status) VALUES (?, ?, ?, ?, 'active')")
            .bind(userId, normalizedEmail, claims.name.slice(0, 120), claims.locale?.slice(0, 20) ?? env.DEFAULT_LOCALE),
          env.DB.prepare("INSERT INTO user_roles (user_id, role, school_id) VALUES (?, 'customer', 'school_eis')").bind(userId),
        );
      }
      statements.push(env.DB.prepare(
        `INSERT INTO auth_identities (id, user_id, provider, provider_subject, email_snapshot)
         VALUES (?, ?, 'google', ?, ?)`,
      ).bind(crypto.randomUUID(), userId, claims.sub, normalizedEmail));
      await env.DB.batch(statements);
    }

    await env.DB.prepare(
      `UPDATE app_users SET display_name = ?,
       status = CASE WHEN status = 'invited' THEN 'active' ELSE status END,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(claims.name.slice(0, 120), userId).run();
    if (requestSurface(url, env) === "family") {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO user_roles (user_id, role, school_id) VALUES (?, 'customer', 'school_eis')",
      ).bind(userId).run();
    }
    await env.DB.prepare(
      `UPDATE staff_invitations SET status = 'accepted', accepted_by_user_id = ?, accepted_at = CURRENT_TIMESTAMP
       WHERE email = ? COLLATE NOCASE AND status = 'pending' AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`,
    ).bind(userId, normalizedEmail).run();

    const sessionToken = await createSession(env, userId, request.headers.get("user-agent"), "google");
    const successHeaders = new Headers({ Location: `${origin}${safeReturnTo(loginState.return_to)}`, "Cache-Control": "no-store" });
    successHeaders.append("Set-Cookie", setCookie(authCookieName(url, "session"), sessionToken, SESSION_SECONDS, origin.startsWith("https://")));
    successHeaders.append("Set-Cookie", clearCookie(authCookieName(url, "oauth"), origin.startsWith("https://")));
    return new Response(null, { status: 302, headers: successHeaders });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/email/start") {
    if (!requestOriginAllowed(request, env, url)) return authJson({ error: "Origen no permitido" }, { status: 403 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const normalizedEmail = normalizedEmailOf(body?.email);
    if (!normalizedEmail) return authJson({ error: "Correo inválido" }, { status: 400 });

    const ipLimit = await checkRateLimit(env, `email_otp_start_ip:${clientIp(request)}`, 10, 10 * 60);
    if (!ipLimit.allowed) return rateLimitedResponse(ipLimit.retryAfterSeconds);
    const emailLimit = await checkRateLimit(env, `email_otp_start_email:${normalizedEmail}`, 5, 15 * 60);
    if (!emailLimit.allowed) return rateLimitedResponse(emailLimit.retryAfterSeconds);

    const expectedHostnames = expectedTurnstileHostnames(env, isPrivateDemoHost(url.hostname) ? url.hostname : null);
    const turnstileOk = await verifyTurnstileToken(
      env, typeof body?.turnstileToken === "string" ? body.turnstileToken : null, clientIp(request), TURNSTILE_EMAIL_ACTION, expectedHostnames,
    );
    if (!turnstileOk) return authJson({ error: "Verificación fallida" }, { status: 400 });

    const code = randomOtpCode();
    const codeHash = await sha256(code);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO email_otp_codes (id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), normalizedEmail, codeHash, now + EMAIL_OTP_TTL_SECONDS),
      env.DB.prepare("DELETE FROM email_otp_codes WHERE expires_at < ?").bind(now),
      env.DB.prepare(
        "INSERT INTO notification_outbox (id, recipient_email, channel, template_key, payload_json) VALUES (?, ?, 'email', 'login_otp', ?)",
      ).bind(crypto.randomUUID(), normalizedEmail, JSON.stringify({ code })),
    ]);
    ctx.waitUntil(processEmailOutbox(env));
    return authJson({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/email/verify") {
    if (!requestOriginAllowed(request, env, url)) return authJson({ error: "Origen no permitido" }, { status: 403 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const normalizedEmail = normalizedEmailOf(body?.email);
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const invalid = () => authJson({ error: "Código incorrecto o vencido" }, { status: 400 });
    if (!normalizedEmail || !/^\d{6}$/.test(code)) return invalid();

    const ipLimit = await checkRateLimit(env, `email_otp_verify_ip:${clientIp(request)}`, 20, 10 * 60);
    if (!ipLimit.allowed) return rateLimitedResponse(ipLimit.retryAfterSeconds);
    const emailLimit = await checkRateLimit(env, `email_otp_verify_email:${normalizedEmail}`, 10, 15 * 60);
    if (!emailLimit.allowed) return rateLimitedResponse(emailLimit.retryAfterSeconds);

    const now = Math.floor(Date.now() / 1000);
    const pending = await env.DB.prepare(
      `SELECT id, code_hash, attempts FROM email_otp_codes
       WHERE email = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1`,
    ).bind(normalizedEmail, now).first<{ id: string; code_hash: string; attempts: number }>();
    if (!pending || pending.attempts >= EMAIL_OTP_MAX_ATTEMPTS) return invalid();

    const candidateHash = await sha256(code);
    if (!(await equalHashes(candidateHash, pending.code_hash))) {
      await env.DB.prepare("UPDATE email_otp_codes SET attempts = attempts + 1 WHERE id = ?").bind(pending.id).run();
      return invalid();
    }
    const claimed = await env.DB.prepare(
      "UPDATE email_otp_codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = ? AND consumed_at IS NULL",
    ).bind(pending.id).run();
    if (!claimed.meta.changes) return invalid();

    const existingUser = await env.DB.prepare("SELECT id FROM app_users WHERE email = ? COLLATE NOCASE LIMIT 1")
      .bind(normalizedEmail).first<{ id: string }>();
    if (!existingUser && requestSurface(url, env) !== "family") {
      return authJson({ error: "Esta cuenta necesita una invitación" }, { status: 403 });
    }

    let userId = existingUser?.id;
    if (!userId) {
      userId = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO app_users (id, email, display_name, locale, status) VALUES (?, ?, ?, ?, 'active')")
          .bind(userId, normalizedEmail, normalizedEmail.split("@")[0].slice(0, 120), env.DEFAULT_LOCALE),
        env.DB.prepare("INSERT INTO user_roles (user_id, role, school_id) VALUES (?, 'customer', 'school_eis')").bind(userId),
      ]);
    } else {
      await env.DB.prepare(
        `UPDATE app_users SET status = CASE WHEN status = 'invited' THEN 'active' ELSE status END,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ).bind(userId).run();
      if (requestSurface(url, env) === "family") {
        await env.DB.prepare(
          "INSERT OR IGNORE INTO user_roles (user_id, role, school_id) VALUES (?, 'customer', 'school_eis')",
        ).bind(userId).run();
      }
    }
    await env.DB.prepare(
      `UPDATE staff_invitations SET status = 'accepted', accepted_by_user_id = ?, accepted_at = CURRENT_TIMESTAMP
       WHERE email = ? COLLATE NOCASE AND status = 'pending' AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`,
    ).bind(userId, normalizedEmail).run();

    const [roles, user] = await Promise.all([
      env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?").bind(userId).all<{ role: string }>(),
      env.DB.prepare("SELECT id, email, display_name, locale FROM app_users WHERE id = ? LIMIT 1")
        .bind(userId).first<{ id: string; email: string; display_name: string; locale: string }>(),
    ]);
    const sessionToken = await createSession(env, userId, request.headers.get("user-agent"), "email_otp");
    const origin = appOrigin(url, env);
    return authJson({ ok: true, user, roles: roles.results.map((role) => role.role) }, {
      headers: { "Set-Cookie": setCookie(authCookieName(url, "session"), sessionToken, SESSION_SECONDS, origin.startsWith("https://")) },
    });
  }

  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    const session = await resolveSession(request, env, url);
    if (!session) return authJson({ authenticated: false });
    return authJson({ authenticated: true, user: session.user, roles: session.roles });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const requestOrigin = request.headers.get("origin");
    const expectedOrigin = appOrigin(url, env);
    if (requestOrigin && requestOrigin !== expectedOrigin && !(isLocalUrl(url) && requestOrigin === url.origin)) {
      return authJson({ error: "Invalid origin" }, { status: 403 });
    }
    const session = await resolveSession(request, env, url);
    if (session) {
      await env.DB.batch([
        env.DB.prepare("UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?").bind(session.tokenHash),
        env.DB.prepare("INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, 'logout', 'auth_session', ?)")
          .bind(crypto.randomUUID(), session.user.id, session.tokenHash),
      ]);
    }
    return authJson({ ok: true }, { headers: { "Set-Cookie": clearCookie(authCookieName(url, "session"), expectedOrigin.startsWith("https://")) } });
  }

  if (request.method === "GET" && url.pathname === "/api/auth/sessions") {
    const session = await resolveSession(request, env, url);
    if (!session) return authJson({ error: "Debes iniciar sesión" }, { status: 401 });
    const sessions = await env.DB.prepare(
      `SELECT token_hash, created_at, last_seen_at, user_agent FROM auth_sessions
       WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC`,
    ).bind(session.user.id, Math.floor(Date.now() / 1000)).all<{
      token_hash: string; created_at: string; last_seen_at: string; user_agent: string | null;
    }>();
    return authJson({
      sessions: sessions.results.map((row) => ({
        id: row.token_hash,
        createdAt: row.created_at,
        lastSeenAt: row.last_seen_at,
        userAgent: row.user_agent,
        current: row.token_hash === session.tokenHash,
      })),
    });
  }

  const revokeMatch = url.pathname.match(/^\/api\/auth\/sessions\/([^/]+)\/revoke$/);
  if (request.method === "POST" && revokeMatch) {
    if (!requestOriginAllowed(request, env, url)) return authJson({ error: "Origen no permitido" }, { status: 403 });
    const session = await resolveSession(request, env, url);
    if (!session) return authJson({ error: "Debes iniciar sesión" }, { status: 401 });
    const revokedTokenHash = decodeURIComponent(revokeMatch[1]);
    const result = await env.DB.prepare(
      "UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND user_id = ? AND revoked_at IS NULL",
    ).bind(revokedTokenHash, session.user.id).run();
    if (!result.meta.changes) return authJson({ error: "Sesión no encontrada" }, { status: 404 });
    await env.DB.prepare("INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, 'session.revoked', 'auth_session', ?)")
      .bind(crypto.randomUUID(), session.user.id, revokedTokenHash).run();
    return authJson({ ok: true });
  }

  return authJson({ error: "Not found" }, { status: 404 });
}
