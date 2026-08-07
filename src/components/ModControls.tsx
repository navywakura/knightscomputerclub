"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PostDeleteProps = {
  postId: number;
  /** Si al borrar se vacía el hilo, redirige al board */
  categorySlug?: string;
};

export function DeletePostButton({ postId, categorySlug }: PostDeleteProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(`¿Borrar post #${postId}?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/forum/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: postId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "error al borrar");
        return;
      }
      if (data.thread_deleted) {
        router.push(categorySlug ? `/forum/${categorySlug}` : "/forum");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="mod-btn danger"
      disabled={busy}
      onClick={onDelete}
      title="Borrar post"
    >
      {busy ? "…" : "[del]"}
    </button>
  );
}

type ThreadDeleteProps = {
  threadId: number;
  categorySlug?: string;
};

export function DeleteThreadButton({
  threadId,
  categorySlug,
}: ThreadDeleteProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (
      !confirm(
        `¿Borrar hilo #${threadId} completo (todos los posts)? Esta acción no se deshace.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/forum/threads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: threadId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "error al borrar hilo");
        return;
      }
      router.push(categorySlug ? `/forum/${categorySlug}` : "/forum");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="mod-btn danger"
      disabled={busy}
      onClick={onDelete}
      title="Borrar hilo completo"
    >
      {busy ? "…" : "[borrar hilo]"}
    </button>
  );
}
