#!/usr/bin/env bash
# install-kcc-cli.sh — instala KCC CLI en macOS / Linux / WSL / Git Bash
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/navywakura/knightscomputerclub/main/scripts/install-kcc-cli.sh | bash
#   VER=1.3.1 bash scripts/install-kcc-cli.sh
#   bash scripts/install-kcc-cli.sh --version 1.3.1
#
# El comando es:  kcc-cli
# (en macOS, `kcc` es Kerberos/Heimdal — no lo uses)

set -euo pipefail

REPO_OWNER="navywakura"
REPO_NAME="knightscomputerclub"
GH_API="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}"
GH_REL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases"

die() { echo "error: $*" >&2; exit 1; }
info() { echo "→ $*"; }
ok() { echo "✓ $*"; }

# ── args ──────────────────────────────────────────────
VER="${VER:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --version|-v) VER="${2:-}"; shift 2 || die "falta valor de --version" ;;
    --help|-h)
      cat <<'EOF'
install-kcc-cli.sh — KCC CLI (// nexo)

  curl -fsSL https://raw.githubusercontent.com/navywakura/knightscomputerclub/main/scripts/install-kcc-cli.sh | bash

  VER=1.3.1 bash install-kcc-cli.sh
  bash install-kcc-cli.sh --version 1.3.1

Requisitos: Node.js ≥ 18, npm, curl
Comando final: kcc-cli  (NO uses `kcc` en macOS)
EOF
      exit 0
      ;;
    *) die "flag desconocida: $1 (probá --help)" ;;
  esac
done

# ── checks ────────────────────────────────────────────
command -v curl >/dev/null || die "necesitás curl"
command -v npm >/dev/null || die "necesitás npm (Node ≥ 18). https://nodejs.org"
command -v node >/dev/null || die "necesitás node"

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if [ "${NODE_MAJOR}" -lt 18 ]; then
  die "Node ${NODE_MAJOR} es viejo. Instalá Node ≥ 18 (https://nodejs.org o nvm)"
fi

# ── versión ───────────────────────────────────────────
if [ -z "${VER}" ]; then
  info "detectando último release en GitHub…"
  # 1) tag del latest release (v1.3.1)
  TAG="$(curl -fsSL "${GH_API}/releases/latest" 2>/dev/null \
    | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' \
    | head -1)" || true
  if [ -z "${TAG}" ]; then
    # fallback: versions.json en main
    VER="$(curl -fsSL "https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/versions.json" 2>/dev/null \
      | sed -n 's/.*"cli"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      | head -1)" || true
  else
    VER="${TAG#v}"
  fi
fi

[ -n "${VER}" ] || die "no pude detectar la versión. Pasá VER=1.3.1 a mano"
# limpiar v prefijo
VER="${VER#v}"
case "${VER}" in
  [0-9]*.[0-9]*.[0-9]*) ;;
  *) die "versión rara: '${VER}' (esperaba X.Y.Z)" ;;
esac

TGZ="kcc-cli-${VER}.tgz"
URL="${GH_REL}/download/v${VER}/${TGZ}"
TMPDIR="${TMPDIR:-/tmp}"
OUT="${TMPDIR}/${TGZ}"

info "versión: ${VER}"
info "bajando: ${URL}"

rm -f "${OUT}"
CODE="$(curl -sS -L -o "${OUT}" -w '%{http_code}' "${URL}" || true)"
if [ "${CODE}" != "200" ] || [ ! -s "${OUT}" ]; then
  rm -f "${OUT}"
  die "no se pudo bajar el package (HTTP ${CODE}). URL: ${URL}
  Revisá: ${GH_REL}
  O pasá una versión que exista: VER=1.3.1 bash $0"
fi

# sanity: no debe ser HTML de error de GitHub
if head -c 200 "${OUT}" | grep -qi '<!DOCTYPE\|<html'; then
  rm -f "${OUT}"
  die "GitHub devolvió HTML (¿404?). URL: ${URL}"
fi

# ── install (global o prefix de usuario si EACCES) ────
USER_PREFIX="${HOME}/.local"
INSTALLED_PREFIX=""

info "instalando…"
set +e
NPM_ERR="$(npm i -g "${OUT}" 2>&1)"
NPM_RC=$?
set -e

if [ "${NPM_RC}" -ne 0 ]; then
  if echo "${NPM_ERR}" | grep -qiE 'EACCES|permission denied'; then
    info "npm global sin permisos → instalando en ${USER_PREFIX}"
    mkdir -p "${USER_PREFIX}"
    npm i -g --prefix "${USER_PREFIX}" "${OUT}"
    INSTALLED_PREFIX="${USER_PREFIX}"
    # hint permanente
    SHELL_RC=""
    if [ -n "${ZSH_VERSION:-}" ] || [ "$(basename "${SHELL:-}")" = "zsh" ]; then
      SHELL_RC="${HOME}/.zshrc"
    elif [ -n "${BASH_VERSION:-}" ] || [ "$(basename "${SHELL:-}")" = "bash" ]; then
      SHELL_RC="${HOME}/.bashrc"
    fi
    PATH_LINE="export PATH=\"${USER_PREFIX}/bin:\$PATH\""
    if [ -n "${SHELL_RC}" ] && [ -f "${SHELL_RC}" ]; then
      if ! grep -qF "${USER_PREFIX}/bin" "${SHELL_RC}" 2>/dev/null; then
        echo "" >> "${SHELL_RC}"
        echo "# kcc-cli (knightscomputer.club)" >> "${SHELL_RC}"
        echo "${PATH_LINE}" >> "${SHELL_RC}"
        info "agregué PATH en ${SHELL_RC} — reabrí la terminal o: source ${SHELL_RC}"
      fi
    fi
    export PATH="${USER_PREFIX}/bin:${PATH}"
  else
    echo "${NPM_ERR}" >&2
    die "npm install falló"
  fi
else
  INSTALLED_PREFIX="$(npm prefix -g 2>/dev/null || true)"
fi

# ── PATH / conflictos ─────────────────────────────────
ok "instalado kcc-cli ${VER}"

if command -v kcc-cli >/dev/null 2>&1; then
  echo
  kcc-cli --version || true
else
  NPM_BIN="$(npm bin -g 2>/dev/null || echo "${INSTALLED_PREFIX}/bin")"
  if [ -n "${INSTALLED_PREFIX}" ] && [ -x "${INSTALLED_PREFIX}/bin/kcc-cli" ]; then
    NPM_BIN="${INSTALLED_PREFIX}/bin"
  fi
  echo
  echo "aviso: kcc-cli no está en el PATH actual."
  echo "  bin: ${NPM_BIN}/kcc-cli"
  echo "  agregá al shell (zsh):"
  echo "    export PATH=\"${NPM_BIN}:\$PATH\""
  echo "  y reabrí la terminal, o corré:"
  echo "    ${NPM_BIN}/kcc-cli --version"
fi

# macOS: kcc de Heimdal
if [ "$(uname -s)" = "Darwin" ] && command -v kcc >/dev/null 2>&1; then
  KCC_PATH="$(command -v kcc)"
  if ! head -c 120 "${KCC_PATH}" 2>/dev/null | grep -q node; then
    echo
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  macOS: el comando \`kcc\` NO es este CLI             ║"
    echo "║  es el cliente Kerberos (Heimdal) del sistema.       ║"
    echo "║  Usá siempre:   kcc-cli                              ║"
    echo "╚══════════════════════════════════════════════════════╝"
  fi
fi

echo
ok "listo. Probá:  kcc-cli login <usuario> <pass>"
ok "docs: https://www.knightscomputer.club/descargar"
