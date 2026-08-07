# Electron shell (futuro)

La UI de **Nexo** y el menú contextual (`AppContextMenu`) están en React
y evitan menús nativos del SO. Para empaquetar como app de escritorio:

1. **Renderer**: reutilizar componentes de `src/components/nexo` y
   `src/components/ui` sin cambios de UI.
2. **API**: en web van a Next (`/api/nexo/*`). En Electron, apuntar
   `apiFetch` (`src/lib/platform.ts`) al mismo backend HTTPS de
   knightscomputer.club o a un proceso local.
3. **Storage**: `getStorage` / `getLocalStorage` usan Web Storage; en
   Electron el mismo renderer Chromium las soporta.
4. **Auth**: cookies de sesión (`credentials: "include"`) o token
   inyectado vía `window.electronAPI` (extender `platform.ts`).
5. **No** uses `dialog.showMessageBox` para menús de la app: mantener
   `AppContextMenu` para look & feel unificado.

Crear boards bajo `// nexo` sigue siendo **exclusivo [VIP]** en el API
(`canCreateNexoBoard`), independientemente del shell.
