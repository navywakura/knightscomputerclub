/**
 * Canales de descarga de clientes KCC.
 * Las versiones viven en /versions.json (las actualiza `npm run release`).
 */

import versions from "../../versions.json";

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

const GH_OWNER = versions.github.owner;
const GH_REPO = versions.github.repo;
const ELECTRON_VER = versions.electron;
const CLI_VER = versions.cli;

/** Releases en GitHub (electron-builder + scripts/release.mjs) */
export const GH_RELEASES = `https://github.com/${GH_OWNER}/${GH_REPO}/releases`;
export const GH_LATEST = `${GH_RELEASES}/latest`;
export const GH_TAG = `v${ELECTRON_VER}`;
export const GH_TAG_URL = `${GH_RELEASES}/tag/${GH_TAG}`;

const winSetupName = versions.artifacts.winSetup.replace(
  "{version}",
  ELECTRON_VER
);
const winPortableName = versions.artifacts.winPortable.replace(
  "{version}",
  ELECTRON_VER
);

const WIN_SETUP = `${GH_RELEASES}/download/${GH_TAG}/${winSetupName}`;
const WIN_PORTABLE = `${GH_RELEASES}/download/${GH_TAG}/${winPortableName}`;
const CLI_TGZ = `${GH_RELEASES}/download/${GH_TAG}/kcc-cli-${CLI_VER}.tgz`;
const CLI_REPO =
  `https://github.com/${GH_OWNER}/${GH_REPO}/tree/main/packages/kcc-cli`;

export const CLIENT_VERSIONS = {
  electron: ELECTRON_VER,
  cli: CLI_VER,
  tag: GH_TAG,
} as const;

export const DOWNLOAD_PLATFORMS: DownloadPlatform[] = [
  {
    id: "windows",
    name: "Windows",
    subtitle: "KCC Nexo · Electron (x64)",
    status: "ready",
    logo: "windows",
    version: ELECTRON_VER,
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
    subtitle: "Terminal · // nexo only",
    status: "ready",
    logo: "cli",
    version: CLI_VER,
    cta: "Descargar package (.tgz)",
    href: CLI_TGZ,
    alt: [
      { label: "Código en el monorepo", href: CLI_REPO },
      {
        label: "README · comandos",
        href: `https://github.com/${GH_OWNER}/${GH_REPO}/blob/main/packages/kcc-cli/README.md`,
      },
      { label: "Release tag", href: GH_TAG_URL },
    ],
    notes: `npm i -g kcc-cli-${CLI_VER}.tgz  ·  o desde monorepo: cd packages/kcc-cli && npm link. Node ≥18.`,
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
