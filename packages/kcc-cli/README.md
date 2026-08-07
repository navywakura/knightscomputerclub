# kcc-cli

Shell de terminal para **// nexo** en [knightscomputer.club](https://www.knightscomputer.club).

Solo habla con el hub de tablones Nexo. **Avatar y banner de perfil se configuran desde esta CLI** (no hace falta la web, aunque la web sigue funcionando).

## Requisitos

- Node.js **≥ 18**
- Cuenta en knightscomputer.club (email verificado para chatear)

## Install

### Desde GitHub Release (recomendado)

```bash
# VER = misma que en https://github.com/navywakura/knightscomputerclub/releases
VER=1.2.0
curl -fsSL -o kcc-cli-$VER.tgz \
  "https://github.com/navywakura/knightscomputerclub/releases/download/v$VER/kcc-cli-$VER.tgz"
npm i -g ./kcc-cli-$VER.tgz
kcc --version
```

También en la web: [/descargar](https://www.knightscomputer.club/descargar).

### Desde el monorepo

```bash
cd packages/kcc-cli
npm link          # expone el binario `kcc` global
# o sin link
node bin/kcc.js
```

### Publicar un release (maintainers)

Desde la raíz del repo:

```bash
npm run release          # minor + build Electron + pack CLI + gh release
# docs: docs/release.md
```

## Uso rápido

```bash
kcc                    # shell interactiva
kcc login roger '***'
kcc boards
kcc join general       # o id numérico
# escribí mensajes; se actualizan solos cada ~3.5s

kcc avatar ~/Pics/me.jpg
kcc banner ~/Pics/wide.png   # solo VIP
kcc nick "Nombre Visible"
```

## Shell (comandos)

| Comando | Descripción |
|---------|-------------|
| `login [u] [p]` | Sesión (cookie en `~/.kcc/session.json`) |
| `logout` | Cierra sesión |
| `boards` / `ls` | Lista tablones nexo |
| `join <id\|slug>` | Entra al chat |
| `leave` | Sale del board |
| *(texto libre)* | Envía mensaje (dentro de un board) |
| `avatar <file>` | Sube y asigna foto de perfil |
| `banner <file>` | Sube banner (VIP) |
| `nick <nombre>` | display name |
| `bio <texto>` | biografía ≤100 |
| `me` | quién soy |
| `help` | ayuda |
| `exit` | salir |

## API base

Por defecto: `https://www.knightscomputer.club`

```bash
kcc base http://localhost:3000   # dev local
export KCC_API_URL=https://www.knightscomputer.club
```

## Seguridad

- Cookie `kc_session` con modo `0600` en `~/.kcc/session.json`
- No se guardan passwords
- Solo endpoints `/api/nexo/*` + `/api/auth/*` + `/api/media` + `/api/profile`

## Limitaciones

- Solo **boards** nexo (no DMs con PIN todavía)
- Requiere Node 18+ (fetch + FormData nativos)
- Captcha no aplica a mensajes nexo; sí login normal
