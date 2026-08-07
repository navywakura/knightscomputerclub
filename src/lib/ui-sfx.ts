/**
 * Efectos de sonido de UI (opcionales, settings).
 * localStorage key: kc_ui_sfx = "1" | "0"
 */

const KEY = "kc_ui_sfx";

export function isUiSfxEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(KEY);
    if (v === null) return true; // default on
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

export function setUiSfxEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* */
  }
}

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

export function playUiSfx(kind: "key" | "click" | "boot" | "send"): void {
  if (!isUiSfxEnabled()) return;
  const c = ac();
  if (!c) return;
  if (c.state === "suspended") void c.resume();

  try {
    const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g);
    g.connect(c.destination);

    if (kind === "key") {
      o.type = "square";
      o.frequency.value = 180 + Math.random() * 80;
      g.gain.setValueAtTime(0.04, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      o.start(now);
      o.stop(now + 0.05);
    } else if (kind === "click") {
      o.type = "triangle";
      o.frequency.value = 420;
      g.gain.setValueAtTime(0.06, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      o.start(now);
      o.stop(now + 0.09);
    } else if (kind === "send") {
      o.type = "sine";
      o.frequency.setValueAtTime(520, now);
      o.frequency.exponentialRampToValueAtTime(780, now + 0.1);
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      o.start(now);
      o.stop(now + 0.16);
    } else if (kind === "boot") {
      // mini dial-up-ish chirp
      o.type = "sawtooth";
      o.frequency.setValueAtTime(200, now);
      o.frequency.linearRampToValueAtTime(1200, now + 0.35);
      o.frequency.linearRampToValueAtTime(400, now + 0.55);
      g.gain.setValueAtTime(0.03, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      o.start(now);
      o.stop(now + 0.62);
    }
  } catch {
    /* */
  }
}
