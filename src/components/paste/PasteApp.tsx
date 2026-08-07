"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  decryptPaste,
  encryptPaste,
  generatePasteKey,
  hashWithKey,
  keyFromHash,
} from "@/lib/zk-crypto";

type Mode = "create" | "view";

type Props = {
  mode: Mode;
  pasteId?: string | null;
};

export default function PasteApp({ mode, pasteId = null }: Props) {
  const [text, setText] = useState("");
  const [hours, setHours] = useState(168); // 7d
  const [burn, setBurn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [plain, setPlain] = useState<string | null>(null);
  const [meta, setMeta] = useState<string>("");

  const loadPaste = useCallback(async () => {
    if (mode !== "view" || !pasteId) return;
    setBusy(true);
    setError("");
    setPlain(null);
    try {
      const key = keyFromHash(
        typeof window !== "undefined" ? window.location.hash : ""
      );
      if (!key) {
        setError(
          "falta la clave en el fragmento de la URL (#k=…). Sin ella el server no puede descifrar (ZK)."
        );
        return;
      }
      const res = await fetch(`/api/paste/${encodeURIComponent(pasteId)}`);
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "no se pudo cargar");
        return;
      }
      const pt = await decryptPaste(d.ciphertext, d.iv, key);
      setPlain(pt);
      setMeta(
        `creado ${new Date(d.created_at).toLocaleString()} · expira ${new Date(d.expires_at).toLocaleString()}` +
          (d.burn_after_read ? " · burn-after-read" : "")
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "no se pudo descifrar (clave incorrecta o datos corruptos)"
      );
    } finally {
      setBusy(false);
    }
  }, [mode, pasteId]);

  useEffect(() => {
    void loadPaste();
  }, [loadPaste]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    setShareUrl("");
    try {
      const key = await generatePasteKey();
      const { ciphertext, iv } = await encryptPaste(text, key);
      const res = await fetch("/api/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ciphertext,
          iv,
          expires_in_hours: hours,
          burn_after_read: burn,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error al crear");
        return;
      }
      const url = `${window.location.origin}${d.path}${hashWithKey(key)}`;
      setShareUrl(url);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "error crypto");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "view") {
    return (
      <div className="paste-app">
        <h1 className="glow">// paste ZK</h1>
        <p className="muted">
          Cifrado en tu navegador. El servidor solo ve ciphertext.
        </p>
        {busy ? <p className="muted">descifrando…</p> : null}
        {error ? <div className="form-error">{error}</div> : null}
        {plain !== null ? (
          <>
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              {meta}
            </p>
            <pre className="paste-plain">{plain}</pre>
          </>
        ) : null}
        <p>
          <Link href="/paste">[ nuevo paste ]</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="paste-app">
      <h1 className="glow">// paste ZK</h1>
      <p>
        Pastebin cifrado de extremo a extremo. La clave va en el{" "}
        <code>#fragmento</code> de la URL y <strong>nunca</strong> se envía al
        nodo.
      </p>
      {error ? <div className="form-error">{error}</div> : null}
      {shareUrl ? (
        <div className="form-ok paste-share">
          <p>listo — copiá el enlace completo (incluye la clave):</p>
          <input
            readOnly
            value={shareUrl}
            className="paste-share-input"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            className="btn"
            onClick={() => void navigator.clipboard?.writeText(shareUrl)}
          >
            [ copiar ]
          </button>
        </div>
      ) : null}
      <form onSubmit={onCreate} className="paste-form">
        <label htmlFor="paste-body">texto</label>
        <textarea
          id="paste-body"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          maxLength={200_000}
          placeholder="logs, configs, secrets… se cifran antes de salir del browser"
          required
          disabled={busy}
        />
        <div className="paste-opts">
          <label>
            expira
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              disabled={busy}
            >
              <option value={1}>1 hora</option>
              <option value={24}>24 horas</option>
              <option value={168}>7 días</option>
              <option value={720}>30 días</option>
            </select>
          </label>
          <label className="settings-radio">
            <input
              type="checkbox"
              checked={burn}
              onChange={(e) => setBurn(e.target.checked)}
              disabled={busy}
            />
            burn after read (se borra al abrir)
          </label>
        </div>
        <button className="btn" type="submit" disabled={busy || !text.trim()}>
          {busy ? "cifrando…" : "[ crear paste cifrado ]"}
        </button>
      </form>
    </div>
  );
}
