/**
 * Sonido de notificación (Web Audio, sin asset externo).
 * Suave “blip” al recibir unread / mención.
 */

let unlocked = false;
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
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

/** Llamar en primer click del usuario para desbloquear autoplay. */
export function unlockNotifyAudio(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    void c.resume().then(() => {
      unlocked = true;
    });
  } else {
    unlocked = true;
  }
}

export function playNotifySound(
  kind: "default" | "mention" | "dm" = "default"
): void {
  if (typeof window === "undefined") return;
  // respeto reduced motion / preferencias
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
  } catch {
    /* */
  }

  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    void c.resume();
  }

  try {
    const now = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g);
    g.connect(c.destination);

    // mención: más agudo; dm: más grave; default: medio
    const f0 =
      kind === "mention" ? 880 : kind === "dm" ? 440 : 660;
    const f1 =
      kind === "mention" ? 1320 : kind === "dm" ? 550 : 880;

    o.type = "sine";
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(f1, now + 0.08);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    o.start(now);
    o.stop(now + 0.25);
    unlocked = true;
  } catch {
    /* autoplay bloqueado */
  }
}

export function notifySoundKindFromType(type: string): "default" | "mention" | "dm" {
  if (type.includes("mention")) return "mention";
  if (type.includes("dm") || type.includes("friends")) return "dm";
  return "default";
}

export function isNotifyAudioUnlocked(): boolean {
  return unlocked;
}
