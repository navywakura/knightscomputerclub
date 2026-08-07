"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

/**
 * Captcha aritmético anti-bot.
 * - onChange se guarda en ref para no re-fetch infinito (bug típico en Electron/desktop).
 * - La pregunta se pinta en canvas (texto estable; no renderiza objetos raros).
 */
export default function CaptchaField({
  onChange,
  disabled,
  refreshKey = 0,
}: Props) {
  const [ch, setCh] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const paintQuestion = useCallback((question: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      2
    );
    const w = 168;
    const h = 40;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // fondo
    ctx.fillStyle = "#0a0e0c";
    ctx.fillRect(0, 0, w, h);
    // ruido sutil
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = `rgba(120,180,100,${0.04 + Math.random() * 0.08})`;
      ctx.fillRect(
        Math.random() * w,
        Math.random() * h,
        1 + Math.random() * 3,
        1 + Math.random() * 2
      );
    }
    ctx.strokeStyle = "rgba(200,160,60,0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.font = "bold 18px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#e8b84a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // solo string plano — nunca objetos
    const label = String(question || "?").slice(0, 24);
    ctx.fillText(label, w / 2, h / 2 + 1);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    setAnswer("");
    try {
      const res = await fetch("/api/captcha", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        question?: unknown;
        token?: unknown;
      };
      if (!res.ok) throw new Error(data.error || "error captcha");

      const question = String(data.question ?? "").trim();
      const token = String(data.token ?? "").trim();
      if (!question || !token || question === "[object Object]") {
        throw new Error("captcha malformado");
      }

      setCh({ question, token });
      onChangeRef.current({ token, answer: "" });
      // paint after state commit
      requestAnimationFrame(() => paintQuestion(question));
    } catch {
      setErr("no se pudo cargar captcha");
      setCh(null);
      onChangeRef.current({ token: "", answer: "" });
    } finally {
      setLoading(false);
    }
  }, [paintQuestion]);

  useEffect(() => {
    void load();
    // refreshKey fuerza nuevo challenge; onChange NO está en deps a propósito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    if (ch?.question) paintQuestion(ch.question);
  }, [ch, paintQuestion]);

  function onAnswer(v: string) {
    setAnswer(v);
    if (ch) onChangeRef.current({ token: ch.token, answer: v });
  }

  return (
    <div className="captcha-field">
      <label htmlFor="captcha-ans">captcha anti-bot</label>
      <div className="captcha-row">
        <canvas
          ref={canvasRef}
          className="captcha-canvas"
          width={168}
          height={40}
          aria-label={loading ? "cargando captcha" : ch?.question || "captcha"}
          role="img"
        />
        <input
          id="captcha-ans"
          inputMode="numeric"
          autoComplete="off"
          value={answer}
          disabled={disabled || loading || !ch}
          onChange={(e) =>
            onAnswer(e.target.value.replace(/[^\d-]/g, "").slice(0, 4))
          }
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
