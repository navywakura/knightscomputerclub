"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import RankBadge from "@/components/RankBadge";
import { NotificationCenter } from "@web-notify/react";
import {
  notifySoundKindFromType,
  playNotifySound,
  unlockNotifyAudio,
} from "@/lib/notify-sound";
import { getRank, isOwnerUser, rankNameClass } from "@/lib/ranks";
import { useIsPhone } from "@/lib/use-phone";

type User = {
  id: number;
  username: string;
  role: string;
  is_vip?: boolean;
  avatar_url?: string | null;
};

const NAV = [
  { href: "/", label: "home" },
  { href: "/descargar", label: "descargar" },
  { href: "/paste", label: "paste" },
  { href: "/donate", label: "donate" },
  { href: "/forum", label: "forum" },
  { href: "/auth/login", label: "login" },
  { href: "/auth/register", label: "register" },
];

function buildNavItems(user: User | null) {
  const items: Array<{ href: string; label: string }> = [];
  for (const item of NAV) {
    if (user && (item.href === "/auth/login" || item.href === "/auth/register")) {
      continue;
    }
    if (!user && (item.href === "/forum" || item.href === "/nexo")) {
      continue;
    }
    items.push(item);
  }
  if (user) {
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
  return items;
}

export default function Header() {
  const path = usePathname();
  const router = useRouter();
  const isPhone = useIsPhone();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  useEffect(() => {
    const unlock = () => unlockNotifyAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    // solo bloquear scroll de página en menú móvil
    if (!isPhone && !document.body.classList.contains("phone")) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isPhone, menuOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  const navItems = buildNavItems(user);

  function isActive(href: string) {
    return href === "/"
      ? path === "/"
      : path === href || path.startsWith(href + "/");
  }

  return (
    <header className={`site-header${menuOpen ? " menu-open" : ""}`}>
      <div className="header-top">
        <Link href="/" className="brand" onClick={() => setMenuOpen(false)}>
          knights<span>computer</span>.club
        </Link>

        <div className="header-end">
          {/* un solo NotificationCenter (desktop + mobile) */}
          {user ? (
            <span className="header-notify-slot">
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
                  setMenuOpen(false);
                  router.push(href);
                  router.refresh();
                }}
              />
            </span>
          ) : null}

          {/* Desktop status (CSS lo oculta en ≤720px) */}
          <div className="status-line status-line-desktop">
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

          {/* Mobile: avatar 👤 / foto → dropdown con nav + auth */}
          <div className="header-mobile-actions" ref={menuRef}>
          <button
            type="button"
            className={`header-menu-btn${menuOpen ? " open" : ""}`}
            aria-expanded={menuOpen}
            aria-controls="header-mobile-menu"
            aria-label={menuOpen ? "cerrar menú" : "abrir menú"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt=""
                className="header-menu-avatar"
              />
            ) : user ? (
              <span className="header-menu-avatar initials" aria-hidden>
                {user.username.slice(0, 2).toUpperCase()}
              </span>
            ) : (
              <span className="header-menu-avatar guest" aria-hidden>
                👤
              </span>
            )}
            <span className="header-menu-chevron" aria-hidden>
              {menuOpen ? "▴" : "▾"}
            </span>
          </button>

          <div
            id="header-mobile-menu"
            className={`header-dropdown${menuOpen ? " open" : ""}`}
            role="dialog"
            aria-label="menú de navegación"
            hidden={!menuOpen}
          >
            <div className="header-dropdown-frame">
              <div className="header-dropdown-title">
                <span className="glow">// nav</span>
                <button
                  type="button"
                  className="header-dropdown-close"
                  onClick={() => setMenuOpen(false)}
                  aria-label="cerrar"
                >
                  [x]
                </button>
              </div>

              <div className="header-dropdown-user">
                {loaded && user ? (
                  <>
                    {user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.avatar_url}
                        alt=""
                        className="header-dropdown-av"
                      />
                    ) : (
                      <span className="header-dropdown-av initials">
                        {user.username.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <div
                        className={rankNameClass(
                          getRank({
                            role: user.role,
                            username: user.username,
                            is_vip: user.is_vip,
                          })
                        )}
                      >
                        @{user.username}
                      </div>
                      <RankBadge
                        role={user.role}
                        username={user.username}
                        isVip={user.is_vip}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <span className="header-dropdown-av guest">👤</span>
                    <div>
                      <div className="muted">guest</div>
                      <div className="online" style={{ fontSize: "0.75rem" }}>
                        NODE ONLINE
                      </div>
                    </div>
                  </>
                )}
              </div>

              <nav className="header-dropdown-nav" aria-label="menú principal">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={isActive(item.href) ? "active" : ""}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {!user && (
                <div className="header-dropdown-auth">
                  <Link
                    href="/auth/login"
                    className="btn"
                    onClick={() => setMenuOpen(false)}
                  >
                    [ login ]
                  </Link>
                  <Link
                    href="/auth/register"
                    className="btn secondary"
                    onClick={() => setMenuOpen(false)}
                  >
                    [ register ]
                  </Link>
                </div>
              )}

              {user && (
                <div className="header-dropdown-auth">
                  <Link
                    href={`/u/${encodeURIComponent(user.username)}`}
                    className="btn secondary"
                    onClick={() => setMenuOpen(false)}
                  >
                    [ perfil ]
                  </Link>
                  <Link
                    href="/settings"
                    className="btn secondary"
                    onClick={() => setMenuOpen(false)}
                  >
                    [ settings ]
                  </Link>
                  <button type="button" className="btn" onClick={logout}>
                    [ logout ]
                  </button>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Desktop nav (CSS lo oculta en ≤720px) */}
      <nav className="nav nav-desktop" aria-label="main">
        {navItems.map((item, i) => (
          <span key={item.href}>
            {i > 0 && <span className="sep">|</span>}
            <Link href={item.href} className={isActive(item.href) ? "active" : ""}>
              {item.label}
            </Link>
          </span>
        ))}
      </nav>

      <div className="ticker" aria-hidden>
        <div className="ticker-inner">
          ::: KNIGHTSCOMPUTER.CLUB — NODO TECNOACTIVISTA — RXos OPEN DEV —
          FORUM // DEBATE // DONATE — PRIVACY IS NOT A CRIME — COMPUTACIÓN
          LIBRE PARA QUIEN LA NECESITE — UNDERGROUND BUILD 2000-STYLE — NO
          TRACKERS · NO ADS · SOLO SEÑAL — :::&nbsp;&nbsp;&nbsp;
        </div>
      </div>

      {menuOpen && (
        <button
          type="button"
          className="header-menu-backdrop"
          aria-label="cerrar menú"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </header>
  );
}
