/** Dominio canónico de producción (OAuth + OG + sitemap). */
export const CANONICAL_SITE_ORIGIN = "https://www.knightscomputer.club";

/**
 * Normaliza la URL del sitio:
 * - apex knightscomputer.club → www
 * - sin slash final
 */
export function normalizeSiteUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.hostname === "knightscomputer.club") {
      u.hostname = "www.knightscomputer.club";
    }
    u.hash = "";
    u.search = "";
    // quitar path si solo es /
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${u.origin}${path}`.replace(/\/$/, "");
  } catch {
    return CANONICAL_SITE_ORIGIN;
  }
}

export function getSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : CANONICAL_SITE_ORIGIN);
  return normalizeSiteUrl(raw);
}

/**
 * Base para redirects OAuth (Google/GitHub).
 * Nunca usa localhost: los providers deben tener registradas las URIs de prod.
 * Override opcional: OAUTH_SITE_URL
 */
export function getOAuthSiteUrl() {
  const raw =
    process.env.OAUTH_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    CANONICAL_SITE_ORIGIN;

  try {
    const u = new URL(raw.trim());
    if (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname.endsWith(".local")
    ) {
      return CANONICAL_SITE_ORIGIN;
    }
    return normalizeSiteUrl(u.origin);
  } catch {
    return CANONICAL_SITE_ORIGIN;
  }
}

/** URL absoluta para RSS / OG */
export function absoluteUrl(path: string): string {
  const base = getSiteUrl().replace(/\/$/, "");
  if (path.startsWith("http")) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
