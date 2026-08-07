#!/usr/bin/env node
/**
 * Release all-in-one: version bump → web (versions.json) → Electron build
 * → kcc-cli pack → GitHub Release.
 *
 * Uso:
 *   npm run release                 # minor: 1.2.0 → 1.3.0
 *   npm run release -- 1.4.0        # versión exacta
 *   npm run release -- minor
 *   npm run release -- major
 *   npm run release -- patch
 *   npm run release -- --dry-run
 *   npm run release -- --no-publish
 *   npm run release -- --skip-build # solo bump + pack + upload si hay dist
 *   npm run release:web             # solo alinear package.json + versions
 *
 * Requiere: Node 18+, gh (auth), y para build: deps en electron/
 * Token: GH_TOKEN o sesión `gh auth login` (scope repo).
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const VERSIONS_PATH = join(ROOT, "versions.json");
const ELECTRON_PKG = join(ROOT, "electron", "package.json");
const CLI_PKG = join(ROOT, "packages", "kcc-cli", "package.json");
const ELECTRON_DIR = join(ROOT, "electron");
const CLI_DIR = join(ROOT, "packages", "kcc-cli");
const DIST_DIR = join(ELECTRON_DIR, "dist");
const ENV_LOCAL = join(ROOT, ".env.local");

/** Carga KEY=VAL de .env.local sin pisar env ya exportado. No imprime secretos. */
function loadEnvLocal() {
  if (!existsSync(ENV_LOCAL)) return;
  const text = readFileSync(ENV_LOCAL, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = val;
    }
  }
  // alias habitual
  if (!process.env.GH_TOKEN && process.env.GITHUB_TOKEN) {
    process.env.GH_TOKEN = process.env.GITHUB_TOKEN;
  }
  if (!process.env.GITHUB_TOKEN && process.env.GH_TOKEN) {
    process.env.GITHUB_TOKEN = process.env.GH_TOKEN;
  }
}

loadEnvLocal();

const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(name);
}

function flagValue(name) {
  const i = args.indexOf(name);
  if (i === -1) return null;
  return args[i + 1] && !args[i + 1].startsWith("-") ? args[i + 1] : null;
}

const DRY = hasFlag("--dry-run");
const NO_PUBLISH = hasFlag("--no-publish") || DRY;
const SKIP_BUILD = hasFlag("--skip-build");
const SKIP_CLI = hasFlag("--skip-cli");
const SKIP_ELECTRON = hasFlag("--skip-electron");
const SKIP_WIN = hasFlag("--skip-win");
const SKIP_MAC = hasFlag("--skip-mac");
const WEB_ONLY = hasFlag("--web-only");
const YES = hasFlag("--yes") || hasFlag("-y");
const NOTES = flagValue("--notes") || "";

const bumpArg = args.find(
  (a) =>
    !a.startsWith("-") &&
    (a === "major" ||
      a === "minor" ||
      a === "patch" ||
      a === "same" ||
      /^\d+\.\d+\.\d+$/.test(a))
);

function die(msg, code = 1) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(code);
}

function log(msg) {
  console.log(msg);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function parseSemver(v) {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) die(`versión inválida: ${v} (usá X.Y.Z)`);
  return { major: +m[1], minor: +m[2], patch: +m[3], raw: `${m[1]}.${m[2]}.${m[3]}` };
}

function bumpSemver(current, kind) {
  const s = parseSemver(current);
  if (kind === "major") return `${s.major + 1}.0.0`;
  if (kind === "minor") return `${s.major}.${s.minor + 1}.0`;
  if (kind === "patch") return `${s.major}.${s.minor}.${s.patch + 1}`;
  if (kind === "same") return s.raw;
  if (/^\d+\.\d+\.\d+$/.test(kind)) return parseSemver(kind).raw;
  die(`bump desconocido: ${kind}`);
}

function run(cmd, opts = {}) {
  const cwd = opts.cwd || ROOT;
  log(`\n$ ${cmd}${cwd !== ROOT ? `  (cwd: ${cwd})` : ""}`);
  if (DRY && !opts.allowDry) {
    log("  → dry-run, no se ejecuta");
    return { status: 0, stdout: "", stderr: "" };
  }
  const r = spawnSync(cmd, {
    cwd,
    shell: true,
    encoding: "utf8",
    env: { ...process.env, ...(opts.env || {}) },
    stdio: opts.capture ? "pipe" : "inherit",
  });
  if (r.status !== 0 && !opts.okFail) {
    die(
      opts.err ||
        `comando falló (${r.status}): ${cmd}\n${r.stderr || r.stdout || ""}`
    );
  }
  return r;
}

function which(bin) {
  const r = spawnSync(`command -v ${bin}`, {
    shell: true,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "";
}

function artifactPaths(version) {
  const setup = join(DIST_DIR, `KCC-Nexo-Setup-${version}.exe`);
  const portable = join(DIST_DIR, `KCC-Nexo-Portable-${version}.exe`);
  const blockmap = join(DIST_DIR, `KCC-Nexo-Setup-${version}.exe.blockmap`);
  const latest = join(DIST_DIR, "latest.yml");
  // macOS (Apple Silicon + Intel) — solo se generan en Darwin
  const dmgArm64 = join(DIST_DIR, `KCC-Nexo-${version}-arm64.dmg`);
  const dmgX64 = join(DIST_DIR, `KCC-Nexo-${version}-x64.dmg`);
  const dmgArm64Blockmap = join(DIST_DIR, `KCC-Nexo-${version}-arm64.dmg.blockmap`);
  const dmgX64Blockmap = join(DIST_DIR, `KCC-Nexo-${version}-x64.dmg.blockmap`);
  const latestMac = join(DIST_DIR, "latest-mac.yml");
  return {
    setup,
    portable,
    blockmap,
    latest,
    dmgArm64,
    dmgX64,
    dmgArm64Blockmap,
    dmgX64Blockmap,
    latestMac,
  };
}

const IS_DARWIN = process.platform === "darwin";

function ensureTools({ needBuild, needPublish }) {
  if (!which("node")) die("node no encontrado");
  if (needPublish && !which("gh")) {
    die(
      "gh (GitHub CLI) no está instalado. brew install gh && gh auth login"
    );
  }
  if (needBuild && !existsSync(join(ELECTRON_DIR, "node_modules", "electron-builder"))) {
    log("→ instalando deps de electron…");
    run("npm install", { cwd: ELECTRON_DIR });
  }
}

function applyVersions(version) {
  const versions = readJson(VERSIONS_PATH);
  versions.electron = version;
  versions.cli = version;
  writeJson(VERSIONS_PATH, versions);

  const ePkg = readJson(ELECTRON_PKG);
  ePkg.version = version;
  writeJson(ELECTRON_PKG, ePkg);

  const cPkg = readJson(CLI_PKG);
  cPkg.version = version;
  writeJson(CLI_PKG, cPkg);

  log(`✓ versions.json  electron=${version}  cli=${version}`);
  log(`✓ electron/package.json → ${version}`);
  log(`✓ packages/kcc-cli/package.json → ${version}`);
  log(`✓ /descargar leerá v${version} desde versions.json (sin hardcode)`);
  return versions;
}

function buildElectron(version) {
  const doWin = !SKIP_WIN;
  const doMac = !SKIP_MAC && IS_DARWIN;

  if (!doWin && !doMac) {
    die(
      "nada que buildear: --skip-win y macOS deshabilitado (o no estás en Darwin). Usá un Mac para DMG o quitá --skip-win."
    );
  }

  const envBase = {
    GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "",
    // sin Apple Developer cert: no fallar buscando identity
    CSC_IDENTITY_AUTO_DISCOVERY: "false",
  };

  if (doWin) {
    log("\n── build Electron (win nsis + portable) ──");
    run("npx electron-builder --win --publish never", {
      cwd: ELECTRON_DIR,
      env: envBase,
    });
  } else {
    log("\n→ --skip-win: no se buildea Windows");
  }

  if (doMac) {
    // secuencial: en paralelo hdiutil pelea por /Volumes/KCC Nexo …
    log("\n── build Electron (mac dmg arm64) ──");
    run("npx electron-builder --mac --arm64 --publish never", {
      cwd: ELECTRON_DIR,
      env: envBase,
    });
    log("\n── build Electron (mac dmg x64) ──");
    run("npx electron-builder --mac --x64 --publish never", {
      cwd: ELECTRON_DIR,
      env: envBase,
    });
  } else if (!SKIP_MAC && !IS_DARWIN) {
    log(
      "\n→ macOS DMG omitido (este host no es Darwin). Buildeá en un Mac con: cd electron && npm run dist:mac:all"
    );
  } else if (SKIP_MAC) {
    log("\n→ --skip-mac: no se buildea macOS");
  }

  const { setup, portable, latest, dmgArm64, dmgX64, latestMac } =
    artifactPaths(version);
  if (!DRY) {
    if (doWin) {
      if (!existsSync(setup)) die(`falta artefacto: ${setup}`);
      if (!existsSync(portable)) die(`falta artefacto: ${portable}`);
      if (!existsSync(latest)) die(`falta latest.yml (auto-update)`);
    }
    if (doMac) {
      if (!existsSync(dmgArm64)) die(`falta artefacto: ${dmgArm64}`);
      if (!existsSync(dmgX64)) die(`falta artefacto: ${dmgX64}`);
      if (!existsSync(latestMac)) {
        log(
          `⚠ sin latest-mac.yml (${latestMac}) — auto-update mac puede fallar`
        );
      }
    }
  }
  log("✓ build listo en electron/dist/");
}

function packCli(version) {
  log("\n── pack kcc-cli ──");
  const r = run("npm pack --pack-destination .", {
    cwd: CLI_DIR,
    capture: true,
    allowDry: false,
  });
  // npm pack imprime el nombre del tgz en la última línea
  let tgzName = `kcc-cli-${version}.tgz`;
  if (!DRY) {
    const out = (r.stdout || "").trim().split("\n").filter(Boolean);
    const last = out[out.length - 1] || "";
    if (last.endsWith(".tgz")) tgzName = last.trim();
    const tgzPath = join(CLI_DIR, tgzName);
    if (!existsSync(tgzPath)) {
      // a veces pack-destination deja en cwd con nombre del package
      const found = readdirSync(CLI_DIR).find(
        (f) => f.startsWith("kcc-cli-") && f.endsWith(".tgz")
      );
      if (!found) die(`no se generó el tgz de kcc-cli en ${CLI_DIR}`);
      tgzName = found;
    }
  }
  const tgzPath = join(CLI_DIR, tgzName);
  log(`✓ ${tgzPath}`);
  return tgzPath;
}

function releaseNotes(version, { cliTgz, hasMac = false }) {
  if (NOTES) return NOTES;
  const desktop = [
    `### Desktop (Electron)`,
    `- KCC-Nexo-Setup-${version}.exe — instalador Windows x64`,
    `- KCC-Nexo-Portable-${version}.exe — portable`,
    `- Auto-update Windows: \`latest.yml\` (electron-updater)`,
  ];
  if (hasMac) {
    desktop.push(
      `- KCC-Nexo-${version}-arm64.dmg — macOS Apple Silicon (M1/M2/M3/M4)`,
      `- KCC-Nexo-${version}-x64.dmg — macOS Intel`,
      `- Auto-update macOS: \`latest-mac.yml\``,
      ``,
      `**macOS sin firma de Apple:** al abrir la primera vez, clic derecho → Abrir (o \`xattr -cr "/Applications/KCC Nexo.app"\`).`
    );
  }
  return [
    `## KCC ${version}`,
    ``,
    ...desktop,
    ``,
    `### CLI`,
    cliTgz
      ? `- \`${cliTgz.split("/").pop()}\` — \`npm i -g ./${cliTgz.split("/").pop()}\``
      : `- ver packages/kcc-cli en el monorepo`,
    ``,
    `### Web`,
    `- La UI de /nexo se sirve desde producción; no hace falta reinstalar por cambios de foro/chat.`,
    `- Links de descarga: https://www.knightscomputer.club/descargar`,
    ``,
    `### Install CLI`,
    "```bash",
    `# macOS / Linux (detecta versión sola):`,
    `curl -fsSL https://raw.githubusercontent.com/navywakura/knightscomputerclub/main/scripts/install-kcc-cli.sh | bash`,
    ``,
    `# o manual:`,
    `VER=${version}`,
    `curl -fsSL -o kcc-cli-$VER.tgz \\`,
    `  https://github.com/navywakura/knightscomputerclub/releases/download/v$VER/kcc-cli-$VER.tgz`,
    `npm i -g ./kcc-cli-$VER.tgz`,
    `kcc-cli --version   # NO uses "kcc" en macOS (es Kerberos)`,
    "```",
  ].join("\n");
}

function publishGithub(version, versionsMeta, cliTgz) {
  const tag = `v${version}`;
  const { owner, repo } = versionsMeta.github;
  const {
    setup,
    portable,
    blockmap,
    latest,
    dmgArm64,
    dmgX64,
    dmgArm64Blockmap,
    dmgX64Blockmap,
    latestMac,
  } = artifactPaths(version);

  const assets = [];
  let hasMac = false;
  if (!SKIP_ELECTRON) {
    if (!SKIP_WIN) {
      for (const p of [setup, portable, blockmap, latest]) {
        if (existsSync(p)) assets.push(p);
        else if (p === blockmap) log(`⚠ sin blockmap (${p}), se sigue`);
        else if (!DRY) die(`asset requerido ausente: ${p}`);
      }
    }
    // mac: opcionales si no se buildearon en este host
    for (const p of [
      dmgArm64,
      dmgX64,
      dmgArm64Blockmap,
      dmgX64Blockmap,
      latestMac,
    ]) {
      if (existsSync(p)) {
        assets.push(p);
        if (p === dmgArm64 || p === dmgX64) hasMac = true;
      }
    }
  }
  if (cliTgz && existsSync(cliTgz)) assets.push(cliTgz);

  if (assets.length === 0 && !DRY) die("no hay assets para subir");

  const notesFile = join(ROOT, `.release-notes-${version}.md`);
  const body = releaseNotes(version, { cliTgz, hasMac });
  if (!DRY) writeFileSync(notesFile, body, "utf8");

  log(`\n── GitHub Release ${tag} (${owner}/${repo}) ──`);

  // ¿existe el release?
  const check = run(`gh release view ${tag} --repo ${owner}/${repo}`, {
    capture: true,
    okFail: true,
    allowDry: true,
  });
  const exists = !DRY && check.status === 0;

  if (exists) {
    log(`release ${tag} ya existe → subiendo assets (clobber)`);
    run(
      `gh release upload ${tag} ${assets.map((a) => `"${a}"`).join(" ")} --clobber --repo ${owner}/${repo}`,
      {}
    );
    // actualizar notes
    run(
      `gh release edit ${tag} --repo ${owner}/${repo} --notes-file "${notesFile}" --latest`,
      {}
    );
  } else {
    run(
      `gh release create ${tag} ${assets.map((a) => `"${a}"`).join(" ")} ` +
        `--repo ${owner}/${repo} ` +
        `--title "KCC ${version}" ` +
        `--notes-file "${notesFile}" ` +
        `--latest`,
      {}
    );
  }

  if (!DRY && existsSync(notesFile)) {
    try {
      // cleanup temp notes
      run(`rm -f "${notesFile}"`, { allowDry: true, okFail: true });
    } catch {
      /* */
    }
  }

  log(`✓ https://github.com/${owner}/${repo}/releases/tag/${tag}`);
}

function printNextSteps(version) {
  log(`
══════════════════════════════════════════════════════
  Release v${version} listo (o preparado en dry-run)
══════════════════════════════════════════════════════

Web alineada vía versions.json:
  - electron/cli = ${version}
  - /descargar usa esas URLs al deployar

Commit + push de la web (Vercel):
  git add versions.json electron/package.json packages/kcc-cli/package.json src/lib/downloads.ts
  git commit -m "chore(release): v${version}"
  git push origin main

Comprobar:
  open https://github.com/navywakura/knightscomputerclub/releases/tag/v${version}
  open https://www.knightscomputer.club/descargar

CLI:
  npm i -g ./packages/kcc-cli/kcc-cli-${version}.tgz
  # o desde el asset del release
`);
}

function main() {
  log("KCC release — Electron + kcc-cli + web (versions.json)\n");

  const versionsMeta = readJson(VERSIONS_PATH);
  const current = versionsMeta.electron || "1.2.0";
  const kind = bumpArg || "minor";
  const version = bumpSemver(current, kind);

  if (version === current && kind !== "same" && !/^\d+\.\d+\.\d+$/.test(kind)) {
    // minor from 1.2.0 → 1.3.0 always different
  }

  log(`versión actual : ${current}`);
  log(`versión target : ${version}  (bump: ${kind})`);
  log(`flags: dry=${DRY} publish=${!NO_PUBLISH} build=${!SKIP_BUILD && !SKIP_ELECTRON && !WEB_ONLY}`);

  if (!YES && !DRY && !WEB_ONLY) {
    log("\n(continuá; usá --yes para silenciar este aviso en CI)");
  }

  ensureTools({
    needBuild: !SKIP_BUILD && !SKIP_ELECTRON && !WEB_ONLY,
    needPublish: !NO_PUBLISH && !WEB_ONLY,
  });

  // 1) alinear archivos de versión (web lee versions.json)
  if (!DRY) applyVersions(version);
  else {
    log(`[dry-run] aplicaría version ${version} a versions.json + package.jsons`);
  }

  if (WEB_ONLY) {
    log("\n✓ --web-only: solo versions. Listo.");
    printNextSteps(version);
    return;
  }

  // 2) build electron
  if (!SKIP_ELECTRON && !SKIP_BUILD) {
    buildElectron(version);
  } else if (!SKIP_ELECTRON && SKIP_BUILD) {
    log("→ --skip-build: se usan artefactos existentes en electron/dist/");
    const { setup } = artifactPaths(version);
    if (!DRY && !existsSync(setup)) {
      die(
        `no hay build para ${version} (${setup}). Corré sin --skip-build`
      );
    }
  }

  // 3) pack cli
  let cliTgz = null;
  if (!SKIP_CLI) {
    cliTgz = packCli(version);
  }

  // 4) publish github
  if (!NO_PUBLISH) {
    publishGithub(version, versionsMeta, cliTgz);
  } else {
    log("\n→ sin publish (--no-publish / --dry-run)");
    log("  assets locales listos para subir a mano con gh release create");
  }

  printNextSteps(version);
}

main();
