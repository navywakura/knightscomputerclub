"use client";

import { useState } from "react";

type Props = {
  /** Path absoluto del sitio, ej. /forum/post/12 */
  path: string;
  title?: string;
  text?: string;
};

export default function ShareButton({ path, title, text }: Props) {
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  async function share() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${path}`
        : path;

    try {
      if (navigator.share) {
        await navigator.share({
          title: title || "knightscomputer.club",
          text: text || title,
          url,
        });
        setStatus("ok");
        return;
      }
    } catch {
      // cancelado o no soportado → clipboard
    }

    try {
      await navigator.clipboard.writeText(url);
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("err");
      prompt("Copiá el link:", url);
    }
  }

  return (
    <button
      type="button"
      className="mod-btn share-btn"
      onClick={share}
      title="Compartir post (Open Graph)"
    >
      {status === "ok" ? "[copied]" : status === "err" ? "[err]" : "[share]"}
    </button>
  );
}
