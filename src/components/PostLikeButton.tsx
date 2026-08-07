"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  postId: number;
  initialCount?: number;
  initialLiked?: boolean;
  disabled?: boolean;
  /** poll opcional para “tiempo real” sin websocket */
  pollMs?: number;
};

export default function PostLikeButton({
  postId,
  initialCount = 0,
  initialLiked = false,
  disabled = false,
  pollMs = 8000,
}: Props) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [busy, setBusy] = useState(false);

  // sync si el padre recarga posts
  useEffect(() => {
    setCount(initialCount);
    setLiked(initialLiked);
  }, [postId, initialCount, initialLiked]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/forum/likes?post=${postId}`, {
        credentials: "include",
      });
      const d = await res.json();
      const row = d.likes?.[String(postId)];
      if (row) {
        setCount(Number(row.count) || 0);
        setLiked(Boolean(row.liked));
      }
    } catch {
      /* */
    }
  }, [postId]);

  useEffect(() => {
    if (!pollMs || pollMs < 2000) return;
    const iv = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(iv);
  }, [pollMs, refresh]);

  async function toggle() {
    if (disabled || busy) return;
    // optimistic
    const prevLiked = liked;
    const prevCount = count;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
    setBusy(true);
    try {
      const res = await fetch("/api/forum/likes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, action: "toggle" }),
      });
      const d = await res.json();
      if (!res.ok) {
        setLiked(prevLiked);
        setCount(prevCount);
        return;
      }
      setLiked(Boolean(d.liked));
      setCount(Number(d.count) || 0);
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`post-like-btn${liked ? " on" : ""}`}
      onClick={() => void toggle()}
      disabled={disabled || busy}
      title={
        disabled
          ? "login para likear"
          : liked
            ? "quitar like"
            : "me gusta"
      }
      aria-pressed={liked}
      aria-label={liked ? `like (${count}), quitar` : `like (${count})`}
    >
      <span className="post-like-heart" aria-hidden>
        {liked ? "♥" : "♡"}
      </span>
      <span className="post-like-count">{count}</span>
    </button>
  );
}
