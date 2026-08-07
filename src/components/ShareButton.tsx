"use client";

import { useState } from "react";

type Props = {
  /** Path absoluto del sitio, ej. /forum/post/12 o /u/roger */
  path: string;
  title?: string;
  text?: string;
  /** Texto del botón en idle (default [share]) */
  label?: string;
  className?: string;
};

export default function ShareButton({
  path,
  title,
  text,
  label = "[share]",
  className = "mod-btn share-btn",
}: Props) {
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  async function share() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`
        : path;

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: title || "knightscomputer.club",
          text: text || title,
          url,
        });
        setStatus("ok");
        setTimeout(() => setStatus("idle"), 2000);
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
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void share()}
      title={title || "Compartir enlace"}
    >
      {status === "ok" ? "[copied]" : status === "err" ? "[err]" : label}
    </button>
  );
}
