"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RankBadge from "@/components/RankBadge";
import { getRank, rankNameClass } from "@/lib/ranks";

type User = {
  id: number;
  username: string;
  role: string;
  is_vip?: boolean;
};

const NAV = [
  { href: "/", label: "home" },
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
        {NAV.map((item, i) => {
          const active =
            item.href === "/"
              ? path === "/"
              : path === item.href || path.startsWith(item.href + "/");
          // hide login/register when logged in
          if (user && (item.href === "/auth/login" || item.href === "/auth/register")) {
            return null;
          }
          return (
            <span key={item.href}>
              {i > 0 && <span className="sep">|</span>}
              <Link href={item.href} className={active ? "active" : ""}>
                {item.label}
              </Link>
            </span>
          );
        })}
        {user && (
          <>
            <span className="sep">|</span>
            <Link
              href="/forum/new"
              className={path.startsWith("/forum/new") ? "active" : ""}
            >
              new_thread
            </Link>
          </>
        )}
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
