"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationRecord } from "../types";

export type NotificationCenterProps = {
  /** Base path de la API, ej. "/api/notifications" */
  apiBase?: string;
  /** Polling unread en ms (0 = off). Default 45000 */
  pollMs?: number;
  /** Solo montar si hay sesión */
  enabled?: boolean;
  className?: string;
  /** Llamado al navegar a un href de notificación */
  onNavigate?: (href: string) => void;
  /**
   * Si true, muestra Notification API del SO cuando hay unread nuevos
   * y la pestaña no está visible (navegador + Electron).
   */
  desktopNotify?: boolean;
};

type InboxResponse = {
  items: NotificationRecord[];
  unread: number;
  error?: string;
};

/**
 * Campana + panel de notificaciones.
 * 100% desacoplado: solo habla con `apiBase` (GET/PATCH).
 */
export function NotificationCenter({
  apiBase = "/api/notifications",
  pollMs = 45_000,
  enabled = true,
  className = "",
  onNavigate,
  desktopNotify = false,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastUnreadRef = useRef(0);
  const primedRef = useRef(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch(`${apiBase}?limit=25`, {
        credentials: "same-origin",
      });
      if (res.status === 401) {
        setItems([]);
        setUnread(0);
        return;
      }
      const data = (await res.json()) as InboxResponse;
      if (!res.ok) return;
      const nextItems = data.items || [];
      const nextUnread = Number(data.unread || 0);
      setItems(nextItems);
      setUnread(nextUnread);

      if (desktopNotify && typeof window !== "undefined" && "Notification" in window) {
        if (!primedRef.current) {
          primedRef.current = true;
          lastUnreadRef.current = nextUnread;
        } else if (
          nextUnread > lastUnreadRef.current &&
          document.visibilityState !== "visible" &&
          Notification.permission === "granted"
        ) {
          const fresh = nextItems.find((x) => !x.read_at) || nextItems[0];
          try {
            const n = new Notification(
              fresh?.title || "Nueva notificación",
              {
                body: fresh?.body || "knightscomputer.club",
                tag: "kcc-web-notify",
              }
            );
            n.onclick = () => {
              window.focus();
              if (fresh?.href) {
                if (onNavigate) onNavigate(fresh.href);
                else window.location.href = fresh.href;
              }
              n.close();
            };
          } catch {
            /* */
          }
        }
        lastUnreadRef.current = nextUnread;
      }
    } catch {
      /* red */
    }
  }, [apiBase, enabled, desktopNotify, onNavigate]);

  useEffect(() => {
    if (!enabled) return;
    load();
    if (pollMs <= 0) return;
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [enabled, load, pollMs]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markAll() {
    setLoading(true);
    try {
      await fetch(apiBase, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function openItem(n: NotificationRecord) {
    if (!n.read_at) {
      fetch(apiBase, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      }).catch(() => {});
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x
        )
      );
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.href) {
      if (onNavigate) onNavigate(n.href);
      else if (typeof window !== "undefined") window.location.href = n.href;
    }
  }

  if (!enabled) return null;

  return (
    <div
      ref={rootRef}
      className={`wn-notify ${className}`.trim()}
      data-open={open ? "1" : "0"}
    >
      <button
        type="button"
        className="wn-bell"
        aria-label="Notificaciones"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
      >
        <span className="wn-bell-icon" aria-hidden>
          [n]
        </span>
        {unread > 0 ? (
          <span className="wn-badge">{unread > 99 ? "99+" : unread}</span>
        ) : null}
      </button>

      {open ? (
        <div className="wn-panel" role="dialog" aria-label="Inbox">
          <div className="wn-panel-head">
            <strong>notificaciones</strong>
            <button
              type="button"
              className="wn-linkish"
              disabled={loading || unread === 0}
              onClick={markAll}
            >
              marcar leídas
            </button>
          </div>
          <ul className="wn-list">
            {items.length === 0 ? (
              <li className="wn-empty">sin señales</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`wn-item${n.read_at ? "" : " unread"}`}
                    onClick={() => openItem(n)}
                  >
                    <div className="wn-item-title">{n.title}</div>
                    {n.body ? (
                      <div className="wn-item-body">{n.body}</div>
                    ) : null}
                    <div className="wn-item-meta">
                      <span className="wn-type">{n.type}</span>
                      <span>
                        {new Date(n.created_at).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
