# Code signing — macOS Gatekeeper + Windows SmartScreen/Defender

**Hecho crudo:** sin certificados de **pago** no se puede silenciar del todo
Gatekeeper ni SmartScreen. No hay truco gratuito que reemplace:

| Plataforma | Qué hace falta | Coste aprox. |
|------------|----------------|--------------|
| **macOS** | Apple Developer Program + **Developer ID Application** + **notarización** | 99 USD/año |
| **Windows** | Certificado **Authenticode** OV o EV (DigiCert, Sectigo, SSL.com…) | ~200–400+ USD/año (EV más caro, reputación SmartScreen más rápida) |

Hasta tenerlos, los builds usan:

- **macOS:** firma **ad-hoc** (`codesign -`) — evita “app dañada” *después* de quitar cuarentena
- **Windows:** sin firmar — SmartScreen avisa en PCs sin reputación del publisher

## Workaround inmediato (macOS)

Tras instalar el DMG:

```bash
# desde el monorepo, o copiá el script
bash scripts/fix-macos-kcc-nexo.sh
# o a mano:
xattr -cr "/Applications/KCC Nexo.app"
codesign --force --deep --sign - "/Applications/KCC Nexo.app"
open -a "KCC Nexo"
```

## Configurar firma real

Variables en `.env.local` (gitignored) o exportadas antes de `npm run release`:

### macOS — Developer ID + notarize

1. [developer.apple.com](https://developer.apple.com) → Membership ($99)
2. Certificates → **Developer ID Application** → instalar en Keychain
3. App-specific password: appleid.apple.com → Sign-In and Security → App-Specific Passwords
4. Anotar **Team ID** (Membership details)

```bash
# .env.local
APPLE_ID=tu@email.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=XXXXXXXXXX
# opcional si hay varias identidades:
# CSC_NAME=Developer ID Application: Knights Labs (XXXXXXXXXX)
```

Instalar helper de notarize en el shell:

```bash
cd electron && npm i -D @electron/notarize
```

`npm run dist:mac:all` / `npm run release` detectan las vars y:

1. Firman con Developer ID (no ad-hoc)
2. Ejecutan `electron/scripts/notarize.js` (afterSign)
3. Staplean el ticket en el `.app` / DMG

### Windows — Authenticode

1. Comprar cert OV/EV (organización; a menudo pide validación de empresa)
2. Exportar `.pfx` con password

```bash
# .env.local
CSC_LINK=/ruta/absoluta/kcc-codesign.pfx
CSC_KEY_PASSWORD=********
# opcional timestamp (recomendado):
# TIMESTAMP_SERVER=http://timestamp.digicert.com
```

En el Mac, electron-builder puede firmar el `.exe` de Windows si `osslsigncode`
está disponible o usando el stack de mono/wine que trae el builder.

```bash
brew install osslsigncode   # a veces ayuda en Darwin
```

## Comportamiento del build

| Condición | macOS | Windows |
|-----------|-------|---------|
| Sin credenciales | ad-hoc (`identity: "-"`, `CSC_IDENTITY_AUTO_DISCOVERY=false`) | unsigned |
| `APPLE_*` + Developer ID en keychain | sign + notarize | — |
| `CSC_LINK` + password | — | Authenticode |

`scripts/release.mjs` **no** fuerza unsigned si hay `CSC_LINK` / `APPLE_ID` + `APPLE_TEAM_ID`.

## Verificar

```bash
# mac — debe decir "Notarized Developer ID" cuando esté bien
spctl --assess --verbose=2 "/Applications/KCC Nexo.app"
codesign -dv --verbose=2 "/Applications/KCC Nexo.app"

# win (en Windows)
# signtool verify /pa KCC-Nexo-Setup-x.y.z.exe
```

## Por qué Windows Defender / SmartScreen sigue igual sin cert

SmartScreen usa **reputación del certificado + del hash del archivo**.
Binarios nuevos sin firma → “Windows protegió tu PC”.
Incluso con OV tarda un tiempo en “calentar” reputación; EV acelera.

Defender antivirus es otro motor (heurísticas/ML). Firma no lo apaga al 100 %,
pero reduce falsos positivos y quita el banner de SmartScreen con el tiempo.
