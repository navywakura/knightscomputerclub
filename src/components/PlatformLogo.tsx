/** Logos de plataforma — PNG oficiales en /public/icons/platforms */

type PlatformId = "windows" | "macos" | "linux" | "cli" | "android" | "ios";

type Props = {
  platform: PlatformId;
  className?: string;
  size?: number;
};

const PNG: Partial<Record<PlatformId, string>> = {
  windows: "/icons/platforms/windows.png",
  android: "/icons/platforms/android.png",
  linux: "/icons/platforms/linux.png",
  macos: "/icons/platforms/macos.png", // Finder face
  ios: "/icons/platforms/ios.png", // Apple
};

export default function PlatformLogo({
  platform,
  className = "",
  size = 48,
}: Props) {
  const src = PNG[platform];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`platform-logo platform-logo--img platform-logo--${platform} ${className}`.trim()}
        draggable={false}
      />
    );
  }

  // CLI: terminal SVG (sin PNG de usuario)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`platform-logo platform-logo--cli ${className}`.trim()}
      aria-hidden
    >
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
}
