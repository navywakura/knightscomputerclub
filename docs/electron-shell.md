# Electron shell — KCC Nexo

La UI de **Nexo** se carga desde producción
(`https://www.knightscomputer.club/nexo`). El backend sigue en Next/Vercel.

## Actualizaciones automáticas (dos capas)

### 1. UI / API web (siempre fresca)

El shell **no empaqueta** React/Next. Al abrir la app (o con
*Recargar web*) se pide de nuevo el sitio con `Cache-Control: no-cache`.
Cualquier deploy a Vercel se ve en Electron **sin reinstalar**.

### 2. Shell binario (electron-updater)

`electron-updater` comprueba **GitHub Releases** del repo
`navywakura/knightscomputerclub` al arrancar y cada 6 h.

Para publicar un update del `.exe` **y** alinear la web + CLI:

```bash
# desde la raíz del monorepo (recomendado)
npm run release              # 1.2.0 → 1.3.0 + GitHub + versions.json
# ver docs/release.md
```

Manual (solo Electron):

```bash
cd electron
npm version 1.3.0 --no-git-tag-version
npm run dist:win       # Windows
npm run dist:mac:all   # macOS arm64 + x64 (solo en Mac)
# subir dist/* + latest.yml + latest-mac.yml al tag v1.3.0
```

## Build local

```bash
cd electron
npm install
npm start              # dev
npm run dist:win       # instalador + portable en dist/
npm run dist:mac:all   # DMG Apple Silicon + Intel (requiere macOS)
npm run dist:mac:arm64 # solo M1/M2/M3/M4
npm run dist:mac:x64   # solo Intel
```

### macOS sin certificado Apple

Los DMG se firman con `identity: null` (unsigned). Gatekeeper bloqueará
el primer arranque:

1. Abrí el DMG → arrastrá **KCC Nexo** a Aplicaciones
2. Clic derecho en la app → **Abrir** → Abrir
3. O en Terminal: `xattr -cr "/Applications/KCC Nexo.app"`

Con un Apple Developer ID se puede firmar + notarizar después
(`CSC_LINK` / `APPLE_ID` en el entorno de build).

## Notas

- Menú contextual de la app: `AppContextMenu` (no nativo del SO).
- Crear boards = **[VIP]** (`canCreateNexoBoard`).
- Notificaciones desktop: Notification API del Chromium embebido + campana in-app.
