/** Fixed-window rate limiting backed by D1. See migrations/0019_rate_limit_counters.sql. */

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Increments the counter for `bucketKey` in the current fixed window of
 * `windowSeconds`, and reports whether this request is still within `limit`.
 * The increment and read happen in a single statement (SQLite RETURNING),
 * so concurrent requests can't both slip through under the limit.
 */
export async function checkRateLimit(
  env: Env,
  bucketKey: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limit_counters (bucket_key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(bucket_key, window_start) DO UPDATE SET count = count + 1
     RETURNING count`,
  ).bind(bucketKey, windowStart).first<{ count: number }>();
  const count = row?.count ?? 1;
  const retryAfterSeconds = windowStart + windowSeconds - now;
  return { allowed: count <= limit, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function rateLimitedResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Demasiadas solicitudes. Inténtalo de nuevo en unos minutos." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" } },
  );
}

/** Deletes counters from windows older than `retentionSeconds`; call opportunistically from the scheduled handler. */
export async function pruneRateLimitCounters(env: Env, retentionSeconds = 60 * 60 * 24): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - retentionSeconds;
  await env.DB.prepare("DELETE FROM rate_limit_counters WHERE window_start < ?").bind(cutoff).run();
}
