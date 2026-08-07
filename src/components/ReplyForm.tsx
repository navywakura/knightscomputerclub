"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import ImageAttach from "@/components/ImageAttach";

type Props = {
  threadId: number;
  /** Si se pasa, se llama al publicar (SPA) en vez de router.refresh() */
  onPosted?: () => void;
};

export default function ReplyForm({ threadId, onPosted }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "error al publicar");
        return;
      }
      setBody("");
      if (onPosted) onPosted();
      else router.refresh();
    } catch {
      setError("red caída");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="form-error">{error}</div>}
      <label htmlFor="reply">respuesta</label>
      <textarea
        id="reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="reply en texto plano (sin markdown) · links generan embed OG · podés adjuntar imagen"
        required
        maxLength={20000}
      />
      <div className="compose-toolbar">
        <ImageAttach
          disabled={loading}
          onInsert={(md) => setBody((b) => (b ? b + md : md.trim() + "\n"))}
        />
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "enviando…" : "[ post reply ]"}
        </button>
      </div>
    </form>
  );
}
