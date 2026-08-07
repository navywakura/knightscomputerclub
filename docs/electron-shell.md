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

Para publicar un update del `.exe`:

```bash
cd electron
npm version patch   # o editar version en package.json
npm run dist:win
# subir el release + latest.yml a GitHub Releases (tag vX.Y.Z)
```

Con token `GH_TOKEN` / `GH_TOKEN` de GitHub, `electron-builder` puede
publicar solo:

```bash
GH_TOKEN=… npx electron-builder --win --publish always
```

## Build local

```bash
cd electron
npm install
npm start              # dev
npm run dist:win       # instalador + portable en dist/
```

## Notas

- Menú contextual de la app: `AppContextMenu` (no nativo del SO).
- Crear boards = **[VIP]** (`canCreateNexoBoard`).
- Notificaciones desktop: Notification API del Chromium embebido + campana in-app.
