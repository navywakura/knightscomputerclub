/**
 * Preferencias de notificaciones in-app (popup + sonido).
 * Persistidas en localStorage — no requieren round-trip al server.
 */

export const NOTIFY_MUTE_KEY = "kc_notify_muted";
export const NOTIFY_TOAST_EVENT = "kcc:notify-toast";

export type NotifyToastPayload = {
  id?: string | number;
  type?: string;
  title: string;
  body?: string;
  href?: string | null;
};

export function isNotifyMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(NOTIFY_MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setNotifyMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) window.localStorage.setItem(NOTIFY_MUTE_KEY, "1");
    else window.localStorage.removeItem(NOTIFY_MUTE_KEY);
    window.dispatchEvent(
      new CustomEvent("kcc:notify-mute-change", { detail: { muted } })
    );
  } catch {
    /* */
  }
}

/** Tipos que disparan popup in-app (mensajes / replies / menciones) */
export function isToastableNotifyType(type: string | undefined | null): boolean {
  const t = String(type || "");
  if (!t) return true;
  return (
    t === "nexo.dm" ||
    t === "nexo.mention" ||
    t.startsWith("forum.") ||
    t === "system" ||
    t.startsWith("friend")
  );
}

/**
 * Emite un toast global (escuchado por GlobalNotifyToast).
 * Respeta mute.
 */
export function pushNotifyToast(payload: NotifyToastPayload): void {
  if (typeof window === "undefined") return;
  if (isNotifyMuted()) return;
  if (!isToastableNotifyType(payload.type)) return;
  window.dispatchEvent(
    new CustomEvent(NOTIFY_TOAST_EVENT, { detail: payload })
  );
}
