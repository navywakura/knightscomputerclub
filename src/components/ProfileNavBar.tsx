"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type UserHit = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type PostHit = {
  id: number;
  thread_id: number;
  thread_title: string;
  author_name: string;
  excerpt: string;
};

/**
 * Navbar exclusivo de la página de perfil:
 * - salir del perfil (home / foro / atrás)
 * - búsqueda de usuarios y posts (solo aquí)
 */
export default function ProfileNavBar() {
  const router = useRouter();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserHit[]>([]);
  const [posts, setPosts] = useState<PostHit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (term: string) => {
    const t = term.trim().replace(/^@/, "");
    if (t.length < 2) {
      setUsers([]);
      setPosts([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(t)}`);
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error de búsqueda");
        setUsers([]);
        setPosts([]);
        return;
      }
      setUsers(Array.isArray(d.users) ? d.users : []);
      setPosts(Array.isArray(d.posts) ? d.posts : []);
    } catch {
      setError("sin red");
      setUsers([]);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setUsers([]);
      setPosts([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = window.setTimeout(() => {
      void runSearch(t);
    }, 280);
    return () => window.clearTimeout(id);
  }, [q, runSearch]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  const hasQuery = q.trim().length >= 2;
  const empty =
    hasQuery && !loading && !error && users.length === 0 && posts.length === 0;
  const showPanel = open && (hasQuery || loading);

  return (
    <nav className="profile-navbar" aria-label="navegación de perfil">
      <div className="profile-navbar-left">
        <button
          type="button"
          className="profile-navbar-exit"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/forum");
            }
          }}
        >
          ← salir
        </button>
        <span className="profile-navbar-sep" aria-hidden>
          |
        </span>
        <Link href="/" className="profile-navbar-link">
          home
        </Link>
        <span className="profile-navbar-sep" aria-hidden>
          |
        </span>
        <Link href="/forum" className="profile-navbar-link">
          foro
        </Link>
      </div>

      <div className="profile-navbar-center" ref={wrapRef}>
        <label className="profile-navbar-search-label" htmlFor="profile-search">
          <span className="sr-only">buscar usuarios o posts</span>
          <input
            id="profile-search"
            type="search"
            className="profile-navbar-search"
            placeholder="buscar usuarios / posts…"
            value={q}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && users[0]) {
                e.preventDefault();
                go(`/u/${encodeURIComponent(users[0].username)}`);
              }
            }}
          />
          {loading ? (
            <span className="profile-navbar-search-hint" aria-hidden>
              …
            </span>
          ) : (
            <span className="profile-navbar-search-hint" aria-hidden>
              ⌕
            </span>
          )}
        </label>

        {showPanel ? (
          <div
            id={listId}
            className="profile-search-panel"
            role="listbox"
            aria-label="resultados de búsqueda"
          >
            {error ? (
              <p className="profile-search-empty">{error}</p>
            ) : null}
            {empty ? (
              <p className="profile-search-empty">sin resultados</p>
            ) : null}
            {users.length > 0 ? (
              <div className="profile-search-group">
                <div className="profile-search-group-title">usuarios</div>
                <ul className="profile-search-list">
                  {users.map((u) => (
                    <li key={`u-${u.id}`}>
                      <button
                        type="button"
                        className="profile-search-item"
                        role="option"
                        onClick={() =>
                          go(`/u/${encodeURIComponent(u.username)}`)
                        }
                      >
                        {u.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.avatar_url}
                            alt=""
                            className="profile-search-av"
                          />
                        ) : (
                          <span className="profile-search-av initials">
                            {u.username.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="profile-search-item-text">
                          <strong>@{u.username}</strong>
                          {u.display_name ? (
                            <span className="profile-search-sub">
                              {u.display_name}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {posts.length > 0 ? (
              <div className="profile-search-group">
                <div className="profile-search-group-title">posts</div>
                <ul className="profile-search-list">
                  {posts.map((p) => (
                    <li key={`p-${p.id}`}>
                      <button
                        type="button"
                        className="profile-search-item post"
                        role="option"
                        onClick={() => go(`/forum/post/${p.id}`)}
                      >
                        <span className="profile-search-item-text">
                          <strong>{p.thread_title || `post #${p.id}`}</strong>
                          <span className="profile-search-sub">
                            @{p.author_name} · {p.excerpt}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {loading && !users.length && !posts.length && !error ? (
              <p className="profile-search-empty">buscando…</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="profile-navbar-right">
        <Link href="/nexo" className="profile-navbar-link">
          nexo
        </Link>
        <span className="profile-navbar-sep" aria-hidden>
          |
        </span>
        <Link href="/settings" className="profile-navbar-link">
          settings
        </Link>
      </div>
    </nav>
  );
}
