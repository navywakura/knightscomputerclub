/**
 * Canales de descarga de clientes KCC.
 * Windows Electron está listo; el resto se marca como próximamente.
 */

export type DownloadPlatform = {
  id: string;
  name: string;
  subtitle: string;
  /** ready | soon */
  status: "ready" | "soon";
  /** href de descarga (solo ready) */
  href?: string;
  /** etiqueta del botón principal */
  cta?: string;
  /** enlaces secundarios (portable, etc.) */
  alt?: Array<{ label: string; href: string }>;
  version?: string;
  notes?: string;
  /** id del logo SVG */
  logo: "windows" | "macos" | "linux" | "cli" | "android" | "ios";
};

/** Releases en GitHub (electron-builder publish) */
const GH_RELEASES =
  "https://github.com/navywakura/knightscomputerclub/releases";
const GH_LATEST = `${GH_RELEASES}/latest`;

/** Artefactos nombrados por electron-builder (v1.2.0+) */
const WIN_SETUP = `${GH_RELEASES}/download/v1.2.0/KCC-Nexo-Setup-1.2.0.exe`;
const WIN_PORTABLE = `${GH_RELEASES}/download/v1.2.0/KCC-Nexo-Portable-1.2.0.exe`;

export const DOWNLOAD_PLATFORMS: DownloadPlatform[] = [
  {
    id: "windows",
    name: "Windows",
    subtitle: "KCC Nexo · Electron (x64)",
    status: "ready",
    logo: "windows",
    version: "1.2.0",
    cta: "Descargar instalador (.exe)",
    href: WIN_SETUP,
    alt: [
      { label: "Portable (.exe)", href: WIN_PORTABLE },
      { label: "Todas las releases", href: GH_LATEST },
    ],
    notes:
      "App de escritorio para // nexo. La UI se actualiza sola desde la web; el shell usa auto-update vía GitHub Releases.",
  },
  {
    id: "macos",
    name: "macOS",
    subtitle: "KCC Nexo · Electron (Apple Silicon / Intel)",
    status: "soon",
    logo: "macos",
    notes: "DMG en preparación. Mientras tanto usá la web en Safari/Chrome.",
  },
  {
    id: "linux",
    name: "Linux",
    subtitle: "KCC Nexo · AppImage / deb",
    status: "soon",
    logo: "linux",
    notes: "Build Linux planeado. Usá https://www.knightscomputer.club/nexo",
  },
  {
    id: "cli",
    name: "KCC CLI",
    subtitle: "Terminal · tools del nodo",
    status: "soon",
    logo: "cli",
    notes: "CLI para ops y desarrollo (RXos / nodo). Próximamente.",
  },
  {
    id: "android",
    name: "Android",
    subtitle: "App nativa / WebAPK",
    status: "soon",
    logo: "android",
    notes: "Cliente móvil en roadmap. Abrí nexo en Chrome/Firefox móvil.",
  },
  {
    id: "ios",
    name: "iOS",
    subtitle: "App nativa / PWA",
    status: "soon",
    logo: "ios",
    notes: "Cliente iOS en roadmap. Usá Safari → Añadir a inicio.",
  },
];

export function getReadyDownloads() {
  return DOWNLOAD_PLATFORMS.filter((p) => p.status === "ready");
}
