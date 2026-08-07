"use client";

import { useCallback, useEffect, useState } from "react";

type Challenge = {
  question: string;
  token: string;
};

type Props = {
  /** se llama al cambiar token/answer para que el form padre los envíe */
  onChange: (payload: { token: string; answer: string }) => void;
  disabled?: boolean;
  /** forzar reload externo (p.ej. tras error) */
  refreshKey?: number;
};

export default function CaptchaField({
  onChange,
  disabled,
  refreshKey = 0,
}: Props) {
  const [ch, setCh] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    setAnswer("");
    try {
      const res = await fetch("/api/captcha", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error captcha");
      setCh({ question: data.question, token: data.token });
      onChange({ token: data.token, answer: "" });
    } catch {
      setErr("no se pudo cargar captcha");
      setCh(null);
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function onAnswer(v: string) {
    setAnswer(v);
    if (ch) onChange({ token: ch.token, answer: v });
  }

  return (
    <div className="captcha-field">
      <label htmlFor="captcha-ans">captcha anti-bot</label>
      <div className="captcha-row">
        <span className="captcha-q" aria-live="polite">
          {loading ? "…" : ch?.question || "—"}
        </span>
        <input
          id="captcha-ans"
          inputMode="numeric"
          autoComplete="off"
          value={answer}
          disabled={disabled || loading || !ch}
          onChange={(e) => onAnswer(e.target.value.replace(/[^\d-]/g, "").slice(0, 4))}
          placeholder="?"
          required
          className="captcha-input"
        />
        <button
          type="button"
          className="btn secondary captcha-refresh"
          disabled={disabled || loading}
          onClick={() => void load()}
          title="nuevo captcha"
        >
          ↻
        </button>
      </div>
      {err ? <div className="form-error">{err}</div> : null}
      <p className="muted captcha-hint">resolvé la suma · expira en 10 min</p>
    </div>
  );
}
