# kcc-cli

Shell de terminal para **// nexo** en [knightscomputer.club](https://www.knightscomputer.club).

> **Comando real: `kcc-cli`**  
> En **macOS**, `kcc` es el cliente Kerberos (Heimdal) del sistema.  
> Si corrés `kcc --version` y ves “Heimdal”, no es este package.

## Requisitos

- **Node.js ≥ 18** ([nodejs.org](https://nodejs.org) o `nvm`)
- `npm` y `curl` (mac/Linux) · PowerShell (Windows)
- Cuenta en knightscomputer.club (email verificado para chatear)

## Install (recomendado)

### macOS / Linux / WSL

```bash
curl -fsSL https://raw.githubusercontent.com/navywakura/knightscomputerclub/main/scripts/install-kcc-cli.sh | bash
```

El script detecta la **última versión** del release (no hace falta `VER=` a mano).

Versión fija:

```bash
curl -fsSL https://raw.githubusercontent.com/navywakura/knightscomputerclub/main/scripts/install-kcc-cli.sh | VER=1.3.1 bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/navywakura/knightscomputerclub/main/scripts/install-kcc-cli.ps1 | iex
```

### Manual (si sabés la versión)

```bash
# ⚠️ VER tiene que existir y no estar vacío
VER=1.3.1
curl -fsSL -o "kcc-cli-${VER}.tgz" \
  "https://github.com/navywakura/knightscomputerclub/releases/download/v${VER}/kcc-cli-${VER}.tgz"
npm i -g "./kcc-cli-${VER}.tgz"
kcc-cli --version
```

Errores típicos:

| síntoma | causa | fix |
|---------|--------|-----|
| `curl: 404` + `kcc-cli-.tgz` | `VER` vacío | usá el install.sh o `VER=1.3.1` |
| `kcc` imprime Heimdal | macOS Kerberos | usá **`kcc-cli`** |
| `command not found: kcc-cli` | npm global fuera del PATH | `export PATH="$(npm bin -g):$PATH"` o `~/.local/bin` |
| `EACCES` al `npm i -g` | sin permisos en `/usr/local` | el install.sh cae a `~/.local`; o `npm config set prefix ~/.local` |
| Node viejo | < 18 | actualizá Node |
| curl 302 / tgz vacío | faltó seguir redirect | usá el install.sh (usa `curl -L`) |

### Desde el monorepo

```bash
cd packages/kcc-cli
npm link
kcc-cli --version
```

## Uso rápido

```bash
kcc-cli                    # shell interactiva
kcc-cli login roger '***'
kcc-cli boards
kcc-cli join general       # o id numérico
# escribí mensajes; se actualizan solos

kcc-cli avatar ~/Pics/me.jpg
kcc-cli banner ~/Pics/wide.png   # solo VIP
kcc-cli nick "Nombre Visible"
kcc-cli --version
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
kcc-cli base http://localhost:3000   # dev local
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
