#!/usr/bin/env bash
# Quita la cuarentena de Gatekeeper y aplica firma ad-hoc a KCC Nexo.
# Necesario mientras no haya Developer ID + notarización de Apple.
set -euo pipefail

APP="${1:-/Applications/KCC Nexo.app}"

if [[ ! -d "$APP" ]]; then
  echo "No encontré: $APP"
  echo "Uso: $0 \"/ruta/a/KCC Nexo.app\""
  exit 1
fi

echo "→ quitando com.apple.quarantine…"
xattr -cr "$APP"

echo "→ firma ad-hoc (codesign -)…"
codesign --force --deep --sign - "$APP" 2>/dev/null || \
  codesign --force --sign - "$APP"

echo "→ verificación:"
codesign -dv --verbose=2 "$APP" 2>&1 | head -12 || true
spctl --assess --verbose=2 "$APP" 2>&1 || true

echo ""
echo "Listo. Abrí la app con:"
echo "  open \"$APP\""
echo ""
echo "Si macOS sigue bloqueando: Ajustes del Sistema → Privacidad y seguridad → 'Abrir de todos modos'."
