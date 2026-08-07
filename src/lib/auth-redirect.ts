/**
 * Paths seguros post-login (evita open redirect).
 * Solo rutas internas del sitio.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = "/forum"
): string {
  if (!raw) return fallback;
  let path = String(raw).trim();
  try {
    // si viene URL absoluta del mismo sitio, quedarse con path+search
    if (path.startsWith("http://") || path.startsWith("https://")) {
      const u = new URL(path);
      path = `${u.pathname}${u.search}`;
    }
  } catch {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  // bloquear protocol-relative y basura
  if (path.includes("://")) return fallback;
  return path;
}

export function nexoInvitePath(slug: string): string {
  const s = encodeURIComponent(slug.trim());
  return `/nexo?join=${s}`;
}

export function nexoInviteUrl(slug: string, origin?: string): string {
  const path = nexoInvitePath(slug);
  if (origin) return `${origin.replace(/\/$/, "")}${path}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}
