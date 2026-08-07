"use client";

import { useRef, useState } from "react";

const MAX = 8 * 1024 * 1024;

type Props = {
  onInsert: (markdown: string) => void;
  disabled?: boolean;
};

/** Comprime en el browser y sube a /api/media (máx 8MB) */
export default function ImageAttach({ onInsert, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onPick(file: File | null) {
    if (!file) return;
    setErr("");
    if (!file.type.startsWith("image/")) {
      setErr("solo imágenes");
      return;
    }
    if (file.size > MAX) {
      setErr("máx 8MB");
      return;
    }

    setBusy(true);
    try {
      const compressed = await compressImage(file);
      if (compressed.size > MAX) {
        setErr("sigue > 8MB tras comprimir");
        return;
      }
      const form = new FormData();
      form.append("file", compressed, compressed.name || "image.jpg");
      const res = await fetch("/api/media", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "upload falló");
        return;
      }
      onInsert(`\n${data.markdown}\n`);
    } catch {
      setErr("error al procesar imagen");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="image-attach">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        className="btn secondary"
        style={{ fontSize: "0.8rem", padding: "4px 10px" }}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "subiendo…" : "[ + imagen ≤8MB ]"}
      </button>
      {err ? <span className="form-error" style={{ display: "inline", marginLeft: 8 }}>{err}</span> : null}
    </div>
  );
}

async function compressImage(file: File): Promise<File> {
  // GIF: no reencode (pierde animación)
  if (file.type === "image/gif" || file.size < 400_000) return file;

  const bitmap = await createImageBitmap(file);
  const maxW = 1600;
  const scale = bitmap.width > maxW ? maxW / bitmap.width : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82)
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
    type: "image/jpeg",
  });
}
