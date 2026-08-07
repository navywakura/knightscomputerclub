/**
 * Notificaciones fuera de la web: Notification API del navegador
 * y Electron (mismo Chromium; main puede reenviar si se expone).
 */

export function canUseDesktopNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function ensureNotifyPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!canUseDesktopNotify()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showDesktopNotification(opts: {
  title: string;
  body?: string;
  tag?: string;
  href?: string;
}): void {
  if (!canUseDesktopNotify()) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(opts.title, {
      body: opts.body || "",
      tag: opts.tag || "kcc-notify",
      silent: false,
    });
    n.onclick = () => {
      try {
        window.focus();
        if (opts.href) {
          const w = window as Window & {
            electronAPI?: { openPath?: (p: string) => void };
          };
          if (opts.href.startsWith("/")) {
            window.location.href = opts.href;
          } else {
            window.open(opts.href, "_blank");
          }
          void w;
        }
      } catch {
        /* */
      }
      n.close();
    };
  } catch {
    /* Electron sandbox / denied */
  }
}

/** Poll helper: avisa solo si hay nuevos unread respecto al último contador. */
export function notifyIfNewUnread(
  prevUnread: number,
  nextUnread: number,
  sample?: { title: string; body?: string; href?: string }
): void {
  if (nextUnread <= prevUnread) return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    // en foreground basta el badge in-app
    return;
  }
  showDesktopNotification({
    title: sample?.title || `${nextUnread} notificación${nextUnread === 1 ? "" : "es"}`,
    body: sample?.body || "Nuevo en knightscomputer.club",
    href: sample?.href || "/nexo",
    tag: "kcc-unread",
  });
}
