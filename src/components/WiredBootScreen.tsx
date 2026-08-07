"use client";

const DEFAULT_TEXT = "Accediendo a la Wired...";

type Props = {
  /** texto serpiente VHS */
  text?: string;
  label?: string;
  sub?: string;
};

/**
 * Boot cyberpunk VHS compartido (foro + nexo).
 */
export default function WiredBootScreen({
  text = DEFAULT_TEXT,
  label = "SERIAL EXPERIMENTS · NODE",
  sub = "PRESENT DAY · PRESENT TIME",
}: Props) {
  return (
    <div className="wired-boot" role="status" aria-live="polite" aria-busy="true">
      <div className="wired-boot-noise" aria-hidden />
      <div className="wired-boot-scan" aria-hidden />
      <div className="wired-boot-vignette" aria-hidden />
      <div className="wired-boot-inner">
        <p className="wired-boot-label muted">{label}</p>
        <p className="wired-snake" aria-label={text}>
          {text.split("").map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              className="wired-snake-char"
              style={{ animationDelay: `${i * 0.055}s` }}
            >
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
        </p>
        <div className="wired-boot-bar" aria-hidden>
          <div className="wired-boot-bar-fill" />
        </div>
        <p className="wired-boot-sub">{sub}</p>
      </div>
    </div>
  );
}

export const WIRED_BOOT_MIN_MS = 1600;
export const WIRED_BOOT_TEXT = DEFAULT_TEXT;
