import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Rate limit ligero en edge + cabeceras de seguridad por request.
 * Límites más finos también en rutas API (src/lib/rate-limit.ts).
 *
 * Nota: en Vercel el contador es por isolate; en OpenBSD/VPS un solo
 * proceso Node es más estricto. Complementar con pf (docs/security-hardening.md).
 */

type Bucket = { n: number; t: number };
const map = new Map<string, Bucket>();

function ipOf(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function limited(
  key: string,
  max: number,
  windowMs: number
): { blocked: boolean; retry: number } {
  const now = Date.now();
  const b = map.get(key);
  if (!b || b.t <= now) {
    map.set(key, { n: 1, t: now + windowMs });
    return { blocked: false, retry: 0 };
  }
  if (b.n >= max) {
    return { blocked: true, retry: Math.ceil((b.t - now) / 1000) };
  }
  b.n += 1;
  return { blocked: false, retry: 0 };
}

/** Rutas sensibles: límites más bajos */
const STRICT: Array<{ prefix: string; max: number; windowMs: number }> = [
  { prefix: "/api/auth/login", max: 8, windowMs: 60_000 },
  { prefix: "/api/auth/register", max: 5, windowMs: 60_000 },
  { prefix: "/api/auth/verify", max: 10, windowMs: 60_000 },
  { prefix: "/api/media", max: 30, windowMs: 60_000 },
  { prefix: "/api/forum/posts", max: 40, windowMs: 60_000 },
  { prefix: "/api/forum/threads", max: 20, windowMs: 60_000 },
  { prefix: "/api/nexo/messages", max: 90, windowMs: 60_000 },
  { prefix: "/api/nexo/dm", max: 60, windowMs: 60_000 },
  { prefix: "/api/reports", max: 15, windowMs: 60_000 },
  { prefix: "/api/captcha", max: 40, windowMs: 60_000 },
  { prefix: "/api/paste", max: 30, windowMs: 60_000 },
  { prefix: "/api/search", max: 40, windowMs: 60_000 },
];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api/")) {
    // anti-fuzz global API
    const ip = ipOf(req);
    const global = limited(`g:${ip}`, 300, 60_000);
    if (global.blocked) {
      return NextResponse.json(
        { error: "rate limit", code: "rate_limit" },
        {
          status: 429,
          headers: { "Retry-After": String(global.retry) },
        }
      );
    }

    for (const rule of STRICT) {
      if (path === rule.prefix || path.startsWith(rule.prefix + "/")) {
        const r = limited(`${rule.prefix}:${ip}`, rule.max, rule.windowMs);
        if (r.blocked) {
          return NextResponse.json(
            {
              error: "demasiadas peticiones — esperá un momento",
              code: "rate_limit",
            },
            {
              status: 429,
              headers: { "Retry-After": String(r.retry) },
            }
          );
        }
        break;
      }
    }
  }

  const res = NextResponse.next();
  // Cabeceras extra por request (además de next.config)
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  return res;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon|icons|reproductormp3|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|m4a)$).*)",
  ],
};
