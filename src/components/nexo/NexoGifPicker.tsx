"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/platform";

type Gif = {
  id: string;
  title: string;
  url: string;
  preview: string;
};

type Props = {
  onPick: (gif: Gif) => void;
  disabled?: boolean;
};

export default function NexoGifPicker({ onPick, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "24" });
      if (query.trim()) params.set("q", query.trim());
      const res = await apiFetch(`/api/tenor?${params}`);
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error GIF");
        setGifs([]);
        return;
      }
      setGifs(d.gifs || []);
    } catch {
      setError("red caída");
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load(q);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function onQuery(v: string) {
    setQ(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void load(v), 350);
  }

  return (
    <div className="nexo-gif-wrap" ref={rootRef}>
      <button
        type="button"
        className="btn secondary nexo-compose-tool"
        disabled={disabled}
        title="GIF (Tenor)"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        GIF
      </button>
      {open ? (
        <div className="nexo-gif-panel" role="dialog" aria-label="buscar GIF">
          <input
            className="nexo-gif-search"
            value={q}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="buscar en Tenor…"
            autoFocus
          />
          {error ? <div className="form-error nexo-gif-err">{error}</div> : null}
          {loading ? (
            <p className="muted nexo-gif-status">cargando…</p>
          ) : gifs.length === 0 ? (
            <p className="muted nexo-gif-status">sin resultados</p>
          ) : (
            <div className="nexo-gif-grid">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="nexo-gif-cell"
                  title={g.title}
                  onClick={() => {
                    onPick(g);
                    setOpen(false);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.preview || g.url} alt={g.title} loading="lazy" />
                </button>
              ))}
            </div>
          )}
          <p className="muted nexo-gif-credit">powered by Tenor</p>
        </div>
      ) : null}
    </div>
  );
}
