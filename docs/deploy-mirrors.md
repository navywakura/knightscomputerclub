# Deploy: Vercel + mirror OpenBSD (VPS)

El mismo código Next.js corre en **Vercel** (edge/serverless) y puede
desplegarse en un **VPS OpenBSD** (o Linux) con Node detrás de `relayd`/`httpd`
o `nginx`. Objetivo: **mirrors** del nodo sin reescribir la app.

## Stack común (portable)

| Capa | Vercel | OpenBSD VPS |
|------|--------|-------------|
| App | Next.js 15 (Node runtime routes) | `next start` o `node server.js` |
| DB | Neon Postgres (serverless) | **misma** Neon (o mirror read-only) |
| Auth cookies | HTTPS + `SameSite=Lax` | HTTPS obligatorio |
| Secrets | Vercel Env | `/etc/knightscomputer.env` + `rcctl` |
| Health | `GET /api/health` | monitor `cron` / `monit` |
| Files media | BYTEA en Neon | igual (sin FS local) |

**No** dependemos de Vercel Blob, Edge Config ni middleware exclusivo de
Vercel. Rutas `runtime = "nodejs"` donde hace falta (media, NSFW).

## Variables de entorno (prod)

```bash
DATABASE_URL=postgresql://…neon…
JWT_SECRET=…                 # ≥16 chars
NEXT_PUBLIC_SITE_URL=https://www.knightscomputer.club
OAUTH_SITE_URL=https://www.knightscomputer.club

# Google OAuth (producción)
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
# Redirect exacto en Google Cloud Console:
#   https://www.knightscomputer.club/api/auth/oauth/google/callback

GITHUB_CLIENT_ID=…
GITHUB_CLIENT_SECRET=…

GEMINI_API_KEY=…             # NSFW free
GIPHY_API_KEY=…              # GIF picker
CAPTCHA_SECRET=…
ADMIN_SECRET=…
NOTIFY_APP_ID=knightscomputer

# Opcional mirror id (aparece en /api/health)
MIRROR_ID=openbsd-ams1
```

## Vercel

```bash
npx vercel --prod
```

Dominio custom → `www.knightscomputer.club`. Env en dashboard.

## OpenBSD VPS (mirror / primary futuro)

### 1. Paquetes

```sh
doas pkg_add node npm git
# o node lts desde ports
```

### 2. Build

```sh
git clone https://github.com/navywakura/knightscomputerclub.git
cd knightscomputerclub
cp .env.example .env.local   # rellenar secrets
npm ci
npm run build
```

### 3. Proceso (simple)

```sh
# /etc/rc.d/knightscomputer (ejemplo)
# o screen/tmux +:
NODE_ENV=production PORT=3000 npm run start
```

### 4. TLS + reverse proxy

`httpd`/`relayd` o `nginx` en `443` → `127.0.0.1:3000`.

### 5. Health

```sh
curl -fsS https://mirror.example/api/health
```

## Escalabilidad hacia OpenBSD

1. **Hoy**: Vercel + Neon (prod).
2. **Mirror**: VPS OpenBSD con el mismo `DATABASE_URL` (read-write o
   read-only + write en primary).
3. **DNS**: geo / failover (Cloudflare, dual A/AAAA).
4. **Sesiones**: JWT en cookie; cualquier mirror valida con el mismo
   `JWT_SECRET`.
5. **Media**: en DB (BYTEA); si crece, mover a object storage S3-compatible
   manteniendo `/api/media/[id]` como facade.
6. **Realtime**: hoy poll; en VPS se puede añadir SSE/WebSocket sin romper
   el cliente web (feature-detect).

## Electron desktop

- UI = URL remota (`https://www.knightscomputer.club/nexo`) → **siempre
  actual** tras deploy web.
- Shell binario: `electron-updater` + **GitHub Releases**
  (`navywakura/knightscomputerclub`).
- Publicar todo (Electron + CLI + alinear `/descargar`) desde la raíz:

```bash
npm run release          # ver docs/release.md
git add versions.json packages/kcc-cli/package.json src/lib/downloads.ts
git commit -m "chore(release): vX.Y.Z" && git push
```

## Google Auth a producción

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. OAuth client **Web**
3. Authorized redirect URIs:
   - `https://www.knightscomputer.club/api/auth/oauth/google/callback`
   - (opcional preview) `https://*.vercel.app/api/auth/oauth/google/callback`
4. Env en Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `OAUTH_SITE_URL=https://www.knightscomputer.club`
5. Sin localhost en prod (el código ya fuerza www vía `site.ts`).
