/**
 * Rate limit en memoria (por proceso).
 * En Vercel es por instancia (mitiga spam básico).
 * En OpenBSD/VPS con un solo proceso es más efectivo;
 * complementar con pf (ver docs/security-hardening.md).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Limpieza ocasional para no crecer sin límite */
function gc(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

/**
 * @param key  ip:route o userId:route
 * @param limit  máx peticiones en la ventana
 * @param windowMs  ventana en ms
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  gc(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (b.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count };
}

/** Extrae IP de headers de proxy (Vercel / nginx / relayd) */
export function clientIp(req: Request): string {
  const h = req.headers;
  const xf = h.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const vercel = h.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

export function rateLimitResponse(retryAfterSec: number) {
  return new Response(
    JSON.stringify({
      error: "demasiadas peticiones — esperá un momento",
      code: "rate_limit",
      retry_after: retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
        "Cache-Control": "no-store",
      },
    }
  );
}
