"use client";

import { useEffect, useRef, useState } from "react";
import { NEXO_EMOJI_GROUPS } from "@/lib/emojis";

type Props = {
  onPick: (emoji: string) => void;
  disabled?: boolean;
};

export default function NexoEmojiPicker({ onPick, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(NEXO_EMOJI_GROUPS[0].id);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const group =
    NEXO_EMOJI_GROUPS.find((g) => g.id === tab) || NEXO_EMOJI_GROUPS[0];

  return (
    <div className="nexo-emoji-wrap" ref={rootRef}>
      <button
        type="button"
        className="btn secondary nexo-emoji-btn"
        disabled={disabled}
        title="emojis"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        😊
      </button>
      {open ? (
        <div className="nexo-emoji-panel" role="dialog" aria-label="emojis">
          <div className="nexo-emoji-tabs">
            {NEXO_EMOJI_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={tab === g.id ? "on" : ""}
                onClick={() => setTab(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="nexo-emoji-grid">
            {group.emojis.map((em) => (
              <button
                key={em}
                type="button"
                className="nexo-emoji-cell"
                onClick={() => {
                  onPick(em);
                  setOpen(false);
                }}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
