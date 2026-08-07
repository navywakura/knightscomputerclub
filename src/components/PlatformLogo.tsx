/** Logos de plataforma (SVG inline, estilo monocromo del nodo). */

type Props = {
  platform: "windows" | "macos" | "linux" | "cli" | "android" | "ios";
  className?: string;
  size?: number;
};

export default function PlatformLogo({
  platform,
  className = "",
  size = 48,
}: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: `platform-logo platform-logo--${platform} ${className}`.trim(),
    "aria-hidden": true as const,
  };

  switch (platform) {
    case "windows":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="18" height="18" fill="currentColor" />
          <rect x="26" y="4" width="18" height="18" fill="currentColor" />
          <rect x="4" y="26" width="18" height="18" fill="currentColor" />
          <rect x="26" y="26" width="18" height="18" fill="currentColor" />
        </svg>
      );
    case "macos":
      return (
        <svg {...common}>
          {/* manzana simplificada */}
          <path
            fill="currentColor"
            d="M34.2 26.5c.1 6.2 5.4 8.3 5.5 8.3-.05.15-1.7 5.9-5.6 11.7-3.4 5-6.95 10-12.55 9.8-4.85-.2-6.45-2.95-12.05-2.95s-7.4 2.9-12 3.1c-4.85.2-8.55-5.4-11.65-10.4C-21.9 33.1-16.8 14.5-8.9 14.3c4.7-.2 8.15 3.55 12 3.55 3.8 0 6.15-3.6 11.7-3.6 3.75 0 7.7 2.35 10 6.3-8.8 5.45-7.4 19.6-.9 24.6z"
            transform="translate(20 4) scale(0.52)"
          />
          <path
            fill="currentColor"
            d="M30 10c2.2-2.6 3.7-6.2 3.3-9.8-3.1.15-6.9 2.1-9.1 4.7-2 2.3-3.7 5.95-3.3 9.45 3.45.25 7-1.8 9.1-4.35z"
          />
        </svg>
      );
    case "linux":
      // Tux-inspired simple mark
      return (
        <svg {...common}>
          <ellipse cx="24" cy="30" rx="12" ry="10" fill="currentColor" opacity="0.9" />
          <circle cx="24" cy="16" r="9" fill="currentColor" />
          <circle cx="20.5" cy="15" r="1.5" fill="var(--bg-deep, #020403)" />
          <circle cx="27.5" cy="15" r="1.5" fill="var(--bg-deep, #020403)" />
          <ellipse cx="24" cy="20" rx="2.5" ry="1.5" fill="var(--amber, #ffb000)" />
          <path
            d="M12 28c2 6 6 10 12 10s10-4 12-10"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <path d="M15 8c2-4 6-5 9-5" stroke="currentColor" strokeWidth="2" />
          <path d="M33 8c-2-4-6-5-9-5" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "cli":
      return (
        <svg {...common}>
          <rect
            x="4"
            y="8"
            width="40"
            height="32"
            rx="3"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M12 18l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="square"
          />
          <path
            d="M22 30h14"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="square"
          />
        </svg>
      );
    case "android":
      return (
        <svg {...common}>
          <path
            d="M16 20c0-4.4 3.6-8 8-8s8 3.6 8 8v12H16V20z"
            fill="currentColor"
          />
          <rect x="10" y="22" width="5" height="12" rx="2" fill="currentColor" />
          <rect x="33" y="22" width="5" height="12" rx="2" fill="currentColor" />
          <rect x="18" y="34" width="4" height="8" rx="1.5" fill="currentColor" />
          <rect x="26" y="34" width="4" height="8" rx="1.5" fill="currentColor" />
          <circle cx="20" cy="18" r="1.2" fill="var(--bg-deep, #020403)" />
          <circle cx="28" cy="18" r="1.2" fill="var(--bg-deep, #020403)" />
          <path d="M18 10l-3-5M30 10l3-5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "ios":
      return (
        <svg {...common}>
          <rect
            x="12"
            y="4"
            width="24"
            height="40"
            rx="4"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <circle cx="24" cy="38" r="2" fill="currentColor" />
          <rect x="20" y="8" width="8" height="2" rx="1" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}
