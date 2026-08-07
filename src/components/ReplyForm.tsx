"use client";

import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import CaptchaField from "@/components/CaptchaField";
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
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [signPgp, setSignPgp] = useState(false);
  const [pgpSig, setPgpSig] = useState("");

  const onCaptcha = useCallback(
    (p: { token: string; answer: string }) => {
      setCaptchaToken(p.token);
      setCaptchaAnswer(p.answer);
    },
    []
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          body,
          captcha_token: captchaToken,
          captcha_answer: captchaAnswer,
          sign_pgp: signPgp,
          pgp_signature: signPgp ? pgpSig : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "error al publicar");
        setCaptchaKey((k) => k + 1);
        return;
      }
      setBody("");
      setPgpSig("");
      setSignPgp(false);
      setCaptchaAnswer("");
      setCaptchaKey((k) => k + 1);
      if (onPosted) onPosted();
      else router.refresh();
    } catch {
      setError("red caída");
      setCaptchaKey((k) => k + 1);
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
      <label className="settings-radio" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={signPgp}
          onChange={(e) => setSignPgp(e.target.checked)}
          disabled={loading}
        />
        firmar post con PGP (fingerprint de /settings)
      </label>
      {signPgp ? (
        <textarea
          value={pgpSig}
          onChange={(e) => setPgpSig(e.target.value)}
          placeholder="(opcional) pegá firma clearsign/detached aquí"
          rows={3}
          maxLength={16000}
          disabled={loading}
        />
      ) : null}
      <CaptchaField
        onChange={onCaptcha}
        disabled={loading}
        refreshKey={captchaKey}
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
