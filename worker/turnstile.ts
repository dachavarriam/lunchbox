/**
 * Cloudflare Turnstile server-side verification.
 *
 * Both TURNSTILE_SITE_KEY (public) and TURNSTILE_SECRET_KEY (secret) come from
 * a Turnstile widget created in the Cloudflare dashboard; until they're
 * configured, verification is skipped so the app keeps working as today.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileEnv = Env & { TURNSTILE_SECRET_KEY?: string };

export function turnstileConfigured(env: Env): boolean {
  return Boolean((env as TurnstileEnv).TURNSTILE_SECRET_KEY) && Boolean(env.TURNSTILE_SITE_KEY);
}

function hostnameOf(origin: string | undefined): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

/** The widget only ever runs on Pipiro's own three surfaces (plus the current host on private dev hosts). */
export function expectedTurnstileHostnames(env: Env, currentHostnameIfDev: string | null): Set<string> {
  const hostnames = [env.APP_ORIGIN, env.ADMIN_ORIGIN, env.KDS_ORIGIN].map(hostnameOf).filter((value): value is string => Boolean(value));
  if (currentHostnameIfDev) hostnames.push(currentHostnameIfDev);
  return new Set(hostnames);
}

/**
 * Returns true when Turnstile is not configured (nothing to check yet) or the
 * token verified successfully for the given action on one of Pipiro's own
 * hostnames — this stops a token solved on an unrelated page from being
 * replayed against this endpoint.
 */
export async function verifyTurnstileToken(
  env: Env,
  token: string | null,
  remoteIp: string,
  expectedAction: string,
  expectedHostnames: Set<string>,
): Promise<boolean> {
  const authEnv: TurnstileEnv = env;
  if (!authEnv.TURNSTILE_SECRET_KEY) return true;
  if (!token || token.length > 2048) return false;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: authEnv.TURNSTILE_SECRET_KEY, response: token, remoteip: remoteIp }),
    });
    if (!response.ok) return false;
    const payload = await response.json() as { success?: boolean; action?: string; hostname?: string };
    return payload.success === true && payload.action === expectedAction && Boolean(payload.hostname) && expectedHostnames.has(payload.hostname!);
  } catch {
    return false;
  }
}
