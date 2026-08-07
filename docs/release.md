# Releases por terminal (Electron + CLI + web)

Una sola fuente de verdad: **`versions.json`** en la raíz del repo.

La página `/descargar` lee esa versión. El script de release la bumpea,
buildea el shell, empaqueta la CLI y publica en **GitHub Releases**.

## Requisitos

```bash
# GitHub CLI autenticado (scope repo)
brew install gh
gh auth login

# deps del shell (una vez)
cd electron && npm install && cd ..
```

Opcional: `export GH_TOKEN=…` si no usás la sesión de `gh`.

## Comandos (desde la raíz del monorepo)

| Comando | Qué hace |
|---------|----------|
| `npm run release` | **minor** (1.2.0 → 1.3.0): bump + build + pack CLI + GitHub Release + alinea web |
| `npm run release -- 1.4.0` | Versión exacta |
| `npm run release -- major` | 1.x.0 → 2.0.0 |
| `npm run release -- patch` | 1.3.0 → 1.3.1 (hotfix) |
| `npm run release -- same` | Re-publica la versión actual (rebuild/reupload) |
| `npm run release:dry` | Simula sin escribir ni subir |
| `npm run release:web` | Solo actualiza `versions.json` + package.jsons (sin build) |
| `npm run release -- --no-publish` | Build + pack local, no toca GitHub |
| `npm run release -- --skip-build` | Usa `electron/dist/*` ya generado |
| `npm run release -- --skip-cli` | Sin tarball de kcc-cli |
| `npm run release -- --skip-electron` | Solo CLI (+ web version) |
| `npm run release -- --notes "fix"` | Notas custom del release |

## Flujo recomendado cada minor (1.3.0, 1.4.0, …)

```bash
# 1) release completo
npm run release
# o: npm run release -- 1.3.0

# 2) commitear la web (Vercel deploy)
git add versions.json electron/package.json packages/kcc-cli/package.json src/lib/downloads.ts
git status
git commit -m "chore(release): v$(node -p "require('./versions.json').electron")"
git push origin main

# 3) verificar
# https://github.com/navywakura/knightscomputerclub/releases
# https://www.knightscomputer.club/descargar
```

## Qué se sube al tag `vX.Y.Z`

- `KCC-Nexo-Setup-X.Y.Z.exe` — instalador
- `KCC-Nexo-Setup-X.Y.Z.exe.blockmap` — auto-update
- `KCC-Nexo-Portable-X.Y.Z.exe` — portable
- `latest.yml` — **electron-updater** (imprescindible)
- `kcc-cli-X.Y.Z.tgz` — package instalable con npm

## Instalar CLI desde el release

```bash
# recomendado (mac/linux): detecta la última versión
curl -fsSL https://raw.githubusercontent.com/navywakura/knightscomputerclub/main/scripts/install-kcc-cli.sh | bash

# manual — VER no puede estar vacío
VER=1.3.1
curl -fsSL -o "kcc-cli-${VER}.tgz" \
  "https://github.com/navywakura/knightscomputerclub/releases/download/v${VER}/kcc-cli-${VER}.tgz"
npm i -g "./kcc-cli-${VER}.tgz"
kcc-cli --version   # en macOS NO uses `kcc` (es Kerberos/Heimdal)
```

## Esquema de versiones

Subimos el **minor** de a 1:

```text
1.2.0 → 1.3.0 → 1.4.0 → 1.5.0
```

Electron y kcc-cli comparten el mismo número en `versions.json` para no
marear. Hotfix del shell: `npm run release -- patch`.

## Auto-update del shell

`electron-updater` mira el release **Latest** + `latest.yml`.
El script marca cada release nuevo con `--latest`.

## Archivos tocados por el script

| Archivo | Rol |
|---------|-----|
| `versions.json` | Fuente de verdad (web + script) |
| `electron/package.json` | Versión del binario |
| `packages/kcc-cli/package.json` | Versión del package |
| `src/lib/downloads.ts` | Importa `versions.json` (no hardcode) |
| `electron/dist/*` | Artefactos de build |
| GitHub Release `vX.Y.Z` | Distribución pública |

## Troubleshooting

| Síntoma | Qué mirar |
|---------|-----------|
| `gh` 401 / 404 | `gh auth status`, permisos en `navywakura/knightscomputerclub` |
| Auto-update no salta | Falta `latest.yml` o el release no es Latest |
| `/descargar` viejo | No pusheaste `versions.json` a `main` / Vercel no deployó |
| Build falla en Mac sin wine | electron-builder win en CI Windows, o local con deps ok (en macOS suele buildar win) |
| Tag ya existe | El script hace upload `--clobber` + edit notes |

## Solo alinear web a una versión ya publicada

```bash
npm run release -- 1.3.0 --web-only
git add versions.json electron/package.json packages/kcc-cli/package.json
git commit -m "chore(release): align web to v1.3.0"
git push
```
