"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      setTimeout(() => setOk(false), 1800);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setOk(true);
      setTimeout(() => setOk(false), 1800);
    }
  }

  return (
    <button type="button" className="btn secondary copy-btn" onClick={copy}>
      {ok ? "copied ✓" : "copy address"}
    </button>
  );
}
