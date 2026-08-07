"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RankBadge from "@/components/RankBadge";
import { NotificationCenter } from "@web-notify/react";
import {
  notifySoundKindFromType,
  playNotifySound,
  unlockNotifyAudio,
} from "@/lib/notify-sound";
import { getRank, isOwnerUser, rankNameClass } from "@/lib/ranks";

type User = {
  id: number;
  username: string;
  role: string;
  is_vip?: boolean;
};

const NAV = [
  { href: "/", label: "home" },
  { href: "/descargar", label: "descargar" },
  { href: "/donate", label: "donate" },
  { href: "/forum", label: "forum" },
  { href: "/auth/login", label: "login" },
  { href: "/auth/register", label: "register" },
];

export default function Header() {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setUser(d.user || null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  // desbloquear audio de notificaciones en primer gesto
  useEffect(() => {
    const unlock = () => unlockNotifyAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="site-header">
      <div className="header-top">
        <Link href="/" className="brand">
          knights<span>computer</span>.club
        </Link>
        <div className="status-line">
          {loaded ? (
            user ? (
              <span className="user-chip">
                <span className="online">●</span>{" "}
                <span
                  className={rankNameClass(
                    getRank({
                      role: user.role,
                      username: user.username,
                      is_vip: user.is_vip,
                    })
                  )}
                >
                  @{user.username}
                </span>
                <RankBadge
                  role={user.role}
                  username={user.username}
                  isVip={user.is_vip}
                />
                <NotificationCenter
                  enabled
                  apiBase="/api/notifications"
                  pollMs={6000}
                  desktopNotify
                  onNewUnread={({ latest }) => {
                    const kind = notifySoundKindFromType(
                      latest?.type || "system"
                    );
                    playNotifySound(kind);
                  }}
                  onNavigate={(href) => {
                    router.push(href);
                    router.refresh();
                  }}
                />
                <Link href="/settings" className="user-settings-link">
                  [settings]
                </Link>
                <button type="button" onClick={logout}>
                  [logout]
                </button>
              </span>
            ) : (
              <span>
                <span style={{ color: "var(--text-dim)" }}>○</span> guest //{" "}
                <span className="online">NODE ONLINE</span>
              </span>
            )
          ) : (
            <span className="muted">syncing session…</span>
          )}
        </div>
      </div>

      <nav className="nav" aria-label="main">
        {(() => {
          const items: Array<{ href: string; label: string }> = [];
          for (const item of NAV) {
            if (user && (item.href === "/auth/login" || item.href === "/auth/register")) {
              continue;
            }
            // /forum y /nexo solo para usuarios registrados
            if (!user && (item.href === "/forum" || item.href === "/nexo")) {
              continue;
            }
            items.push(item);
          }
          if (user) {
            // nexo después de forum si no está en NAV base
            if (!items.some((i) => i.href === "/nexo")) {
              const forumIdx = items.findIndex((i) => i.href === "/forum");
              const nexoItem = { href: "/nexo", label: "nexo" };
              if (forumIdx >= 0) items.splice(forumIdx + 1, 0, nexoItem);
              else items.push(nexoItem);
            }
            items.push({ href: "/forum/new", label: "new_thread" });
            items.push({ href: "/settings", label: "settings" });
          }
          if (user && isOwnerUser(user)) {
            items.push({ href: "/admin", label: "admin" });
          }
          return items.map((item, i) => {
            const active =
              item.href === "/"
                ? path === "/"
                : path === item.href || path.startsWith(item.href + "/");
            return (
              <span key={item.href}>
                {i > 0 && <span className="sep">|</span>}
                <Link href={item.href} className={active ? "active" : ""}>
                  {item.label}
                </Link>
              </span>
            );
          });
        })()}
      </nav>

      <div className="ticker" aria-hidden>
        <div className="ticker-inner">
          ::: KNIGHTSCOMPUTER.CLUB — NODO TECNOACTIVISTA — RXos OPEN DEV —
          FORUM // DEBATE // DONATE — PRIVACY IS NOT A CRIME — COMPUTACIÓN
          LIBRE PARA QUIEN LA NECESITE — UNDERGROUND BUILD 2000-STYLE — NO
          TRACKERS · NO ADS · SOLO SEÑAL — :::&nbsp;&nbsp;&nbsp;
        </div>
      </div>
    </header>
  );
}
