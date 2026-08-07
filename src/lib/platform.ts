/**
 * Capa fina de plataforma (browser hoy · Electron mañana).
 * Evita acoplar UI a APIs de ventana; en Electron se puede reimplementar.
 */

export function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    electronAPI?: { isNexoDesktop?: boolean };
  };
  if (w.electronAPI?.isNexoDesktop) return true;
  // fallback userAgent (main.js añade NexoDesktop)
  if (typeof navigator !== "undefined" && /NexoDesktop/i.test(navigator.userAgent)) {
    return true;
  }
  return false;
}

export async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base =
    typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_SITE_URL || "";
  return fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers || {}),
    },
  });
}
