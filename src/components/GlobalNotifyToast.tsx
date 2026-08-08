"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  NOTIFY_TOAST_EVENT,
  isNotifyMuted,
  type NotifyToastPayload,
} from "@/lib/notify-prefs";

type ToastItem = {
  key: string;
  title: string;
  body: string;
  href: string | null;
  type: string;
  /** visible | exiting */
  phase: "enter" | "shown" | "exit";
};

const SHOW_MS = 3000;
const EXIT_MS = 380;
const MAX_TOASTS = 3;

function typeLabel(type: string): string {
  if (type === "nexo.dm") return "DM";
  if (type === "nexo.mention") return "mención";
  if (type.startsWith("forum.")) return "foro";
  if (type.startsWith("friend")) return "amigos";
  return "aviso";
}

/**
 * Popup global de notificaciones (arriba a la derecha).
 * Entra deslizando hacia la izquierda (desde fuera a la derecha),
 * se queda 3s, sale deslizando hacia la derecha.
 */
export default function GlobalNotifyToast() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());
  const mutedRef = useRef(isNotifyMuted());

  const clearTimer = useCallback((key: string) => {
    const t = timersRef.current.get(key);
    if (t != null) {
      window.clearTimeout(t);
      timersRef.current.delete(key);
    }
  }, []);

  const dismiss = useCallback(
    (key: string) => {
      clearTimer(key);
      setToasts((prev) =>
        prev.map((t) => (t.key === key ? { ...t, phase: "exit" } : t))
      );
      const rm = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.key !== key));
        timersRef.current.delete(key);
      }, EXIT_MS);
      timersRef.current.set(`rm-${key}`, rm);
    },
    [clearTimer]
  );

  const enqueue = useCallback(
    (payload: NotifyToastPayload) => {
      if (mutedRef.current) return;
      const key = `t-${payload.id ?? Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = {
        key,
        title: String(payload.title || "notificación").slice(0, 120),
        body: String(payload.body || "").slice(0, 200),
        href: payload.href ? String(payload.href) : null,
        type: String(payload.type || "system"),
        phase: "enter",
      };
      setToasts((prev) => {
        const next = [...prev, item];
        // limitar stack: sacar los más viejos
        while (next.length > MAX_TOASTS) {
          const old = next.shift();
          if (old) clearTimer(old.key);
        }
        return next;
      });
      // enter → shown (siguiente frame para animación CSS)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setToasts((prev) =>
            prev.map((t) =>
              t.key === key && t.phase === "enter"
                ? { ...t, phase: "shown" }
                : t
            )
          );
        });
      });
      // auto-dismiss a los 3s
      const auto = window.setTimeout(() => dismiss(key), SHOW_MS);
      timersRef.current.set(key, auto);
    },
    [clearTimer, dismiss]
  );

  useEffect(() => {
    mutedRef.current = isNotifyMuted();
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<NotifyToastPayload>).detail;
      if (!detail?.title) return;
      enqueue(detail);
    };
    const onMute = (e: Event) => {
      const muted = Boolean(
        (e as CustomEvent<{ muted: boolean }>).detail?.muted
      );
      mutedRef.current = muted;
      if (muted) {
        // limpiar toasts al silenciar
        for (const k of timersRef.current.keys()) {
          window.clearTimeout(timersRef.current.get(k));
        }
        timersRef.current.clear();
        setToasts([]);
      }
    };
    window.addEventListener(NOTIFY_TOAST_EVENT, onToast);
    window.addEventListener("kcc:notify-mute-change", onMute);
    return () => {
      window.removeEventListener(NOTIFY_TOAST_EVENT, onToast);
      window.removeEventListener("kcc:notify-mute-change", onMute);
      for (const t of timersRef.current.values()) window.clearTimeout(t);
      timersRef.current.clear();
    };
  }, [enqueue]);

  if (toasts.length === 0) return null;

  return (
    <div className="kcc-toast-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div
          key={t.key}
          className={`kcc-toast kcc-toast-${t.phase}`}
          role="status"
          data-type={t.type}
        >
          <button
            type="button"
            className="kcc-toast-close"
            aria-label="cerrar notificación"
            onClick={() => dismiss(t.key)}
          >
            ×
          </button>
          <div className="kcc-toast-kind">{typeLabel(t.type)}</div>
          <button
            type="button"
            className="kcc-toast-body"
            onClick={() => {
              dismiss(t.key);
              if (t.href) {
                router.push(t.href);
                router.refresh();
              }
            }}
          >
            <strong className="kcc-toast-title">{t.title}</strong>
            {t.body ? <span className="kcc-toast-text">{t.body}</span> : null}
          </button>
        </div>
      ))}
    </div>
  );
}
