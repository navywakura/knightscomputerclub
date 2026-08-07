"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  username: string;
  /** si es el propio perfil, solo muestra contadores */
  isSelf?: boolean;
  loggedIn?: boolean;
};

export default function FollowButton({
  username,
  isSelf = false,
  loggedIn = false,
}: Props) {
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [iFollow, setIFollow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showList, setShowList] = useState<"followers" | "following" | null>(
    null
  );
  const [list, setList] = useState<
    Array<{
      id: number;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    }>
  >([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/follows?user=${encodeURIComponent(username)}`,
        { credentials: "include" }
      );
      const d = await res.json();
      if (!res.ok) return;
      setFollowers(Number(d.followers_count) || 0);
      setFollowing(Number(d.following_count) || 0);
      setIFollow(Boolean(d.following));
      if (showList === "following") setList(d.following_list || []);
      if (showList === "followers") setList(d.followers || []);
    } catch {
      /* */
    }
  }, [username, showList]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!loggedIn || isSelf || busy) return;
    setBusy(true);
    // optimistic
    const prev = iFollow;
    setIFollow(!prev);
    setFollowers((n) => Math.max(0, n + (prev ? -1 : 1)));
    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, action: "toggle" }),
      });
      const d = await res.json();
      if (!res.ok) {
        setIFollow(prev);
        setFollowers((n) => Math.max(0, n + (prev ? 1 : -1)));
        return;
      }
      setIFollow(Boolean(d.following));
      setFollowers(Number(d.followers_count) || 0);
      setFollowing(Number(d.following_count) || 0);
    } catch {
      setIFollow(prev);
      setFollowers((n) => Math.max(0, n + (prev ? 1 : -1)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="follow-block">
      <div className="follow-stats">
        <button
          type="button"
          className="follow-stat"
          onClick={() =>
            setShowList((s) => (s === "followers" ? null : "followers"))
          }
        >
          <strong>{followers}</strong> seguidores
        </button>
        <button
          type="button"
          className="follow-stat"
          onClick={() =>
            setShowList((s) => (s === "following" ? null : "following"))
          }
        >
          <strong>{following}</strong> seguidos
        </button>
        {!isSelf && loggedIn ? (
          <button
            type="button"
            className={`btn follow-btn${iFollow ? " secondary" : ""}`}
            disabled={busy}
            onClick={() => void toggleFollow()}
          >
            {iFollow ? "[ dejando de seguir ]" : "[ seguir ]"}
          </button>
        ) : null}
        {!isSelf && !loggedIn ? (
          <Link href="/auth/login" className="btn secondary">
            [ login para seguir ]
          </Link>
        ) : null}
      </div>
      {showList ? (
        <div className="follow-list-panel">
          <div className="follow-list-head">
            {showList === "followers" ? "seguidores" : "seguidos"}
            <button
              type="button"
              className="linkish"
              onClick={() => setShowList(null)}
            >
              [x]
            </button>
          </div>
          {list.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              nadie aún.
            </p>
          ) : (
            <ul className="follow-list">
              {list.map((u) => (
                <li key={u.id}>
                  <Link href={`/u/${encodeURIComponent(u.username)}`}>
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar_url} alt="" className="follow-av" />
                    ) : (
                      <span className="follow-av initials">
                        {u.username.slice(0, 2)}
                      </span>
                    )}
                    <span>
                      {u.display_name || `@${u.username}`}
                      {u.display_name ? (
                        <span className="muted"> @{u.username}</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
