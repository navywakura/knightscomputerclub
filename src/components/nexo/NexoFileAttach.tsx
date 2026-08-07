"use client";

import { useRef, useState } from "react";

type Props = {
  onInsert: (markdown: string) => void;
  disabled?: boolean;
  /** image | pdf | both */
  accept?: "image" | "pdf" | "both";
  label?: string;
};

const MAX = 8 * 1024 * 1024;

/**
 * Adjunta imagen o PDF a un mensaje Nexo (markdown).
 * PDFs: se suben al media store; el chat los abre en pestaña/navegador externo.
 */
export default function NexoFileAttach({
  onInsert,
  disabled,
  accept = "both",
  label,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const acceptAttr =
    accept === "pdf"
      ? "application/pdf,.pdf"
      : accept === "image"
        ? "image/jpeg,image/png,image/webp,image/gif"
        : "image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf";

  async function onPick(file: File | null) {
    if (!file) return;
    setErr("");
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");

    if (!isPdf && !isImage) {
      setErr("solo imagen o PDF");
      return;
    }
    if (accept === "pdf" && !isPdf) {
      setErr("solo PDF");
      return;
    }
    if (accept === "image" && !isImage) {
      setErr("solo imagen");
      return;
    }
    if (file.size > MAX) {
      setErr("máx 8MB");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await fetch("/api/media", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "upload falló");
        return;
      }
      if (data.markdown) {
        onInsert(`\n${data.markdown}\n`);
      } else if (isPdf) {
        const name = file.name.replace(/[\[\]]/g, "") || "archivo.pdf";
        onInsert(`\n[📎 ${name}](${data.url}?download=1)\n`);
      } else {
        onInsert(`\n![imagen](${data.url})\n`);
      }
    } catch {
      setErr("error al subir");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="nexo-file-attach">
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        hidden
        onChange={(e) => void onPick(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        className="btn secondary nexo-compose-tool"
        disabled={disabled || busy}
        title={
          accept === "pdf"
            ? "adjuntar PDF (abre fuera del chat)"
            : accept === "image"
              ? "adjuntar imagen"
              : "imagen o PDF"
        }
        onClick={() => inputRef.current?.click()}
      >
        {busy
          ? "…"
          : label ||
            (accept === "pdf" ? "PDF" : accept === "image" ? "img" : "+file")}
      </button>
      {err ? (
        <span className="form-error" style={{ fontSize: "0.75rem" }}>
          {err}
        </span>
      ) : null}
    </div>
  );
}
