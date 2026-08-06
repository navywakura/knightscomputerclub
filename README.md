# knightscomputer.club

Landing + foro tecnoactivista (estética 2000 / hacker / underground).

- Donaciones: PayPal, Ko-fi, Bitcoin, Solana, USDT (placeholders vía env)
- Foro con registro, login, categorías, hilos y respuestas
- DB en nube: [Neon](https://neon.tech) Postgres
- Deploy: Vercel

**No hay commits ni pushes en el setup de este proyecto** — eso lo controlás vos.

## Stack

| Capa | Tech |
|------|------|
| Frontend | Next.js 15 (App Router), React 19 |
| Auth | JWT en cookie `httpOnly` + bcrypt |
| DB | Neon serverless Postgres |
| Host | Vercel |

## Setup local

```bash
cd landing_knightscomputer.club
cp .env.example .env.local
# editá DATABASE_URL y JWT_SECRET
npm install
npm run db:setup   # crea tablas + categorías seed
npm run dev
```

Abrí `http://localhost:3000`.

### Variables

| Var | Uso |
|-----|-----|
| `DATABASE_URL` | connection string Neon |
| `JWT_SECRET` | ≥16 chars, aleatorio |
| `NEXT_PUBLIC_PAYPAL_URL` | link PayPal |
| `NEXT_PUBLIC_KOFI_URL` | link Ko-fi |
| `NEXT_PUBLIC_BTC_ADDRESS` | address BTC |
| `NEXT_PUBLIC_SOL_ADDRESS` | address SOL |
| `NEXT_PUBLIC_USDT_ADDRESS` | address USDT |
| `NEXT_PUBLIC_SITE_URL` | URL canónica (prod) |

## Deploy Vercel

1. Importá **solo** el directorio `landing_knightscomputer.club` como root del proyecto (o monorepo con Root Directory = esa carpeta).
2. En Vercel → Settings → Environment Variables, pegá las mismas vars que en `.env.local`.
3. Deploy. En el primer request autenticado/foro, `ensureSchema()` crea tablas si faltan (también podés correr `npm run db:setup` localmente contra la misma DB).

```bash
# opcional, desde esta carpeta:
npx vercel
```

## Rutas

| Path | Descripción |
|------|-------------|
| `/` | Landing / manifesto |
| `/donate` | Botones y addresses de donación |
| `/forum` | Boards + hilos recientes |
| `/forum/[slug]` | Lista de hilos por categoría |
| `/forum/thread/[id]` | Hilo + replies |
| `/forum/new` | Crear hilo (login) |
| `/auth/login` | Login |
| `/auth/register` | Registro |
| `POST /api/admin/vip` | Marcar donante como VIP (`ADMIN_SECRET`) |

## VIP (donantes)

Los usuarios con `is_vip = true` muestran el rango **`[VIP]`** en el foro (handle oro eléctrico + badge animado).

Tras verificar una donación:

```bash
curl -X POST https://tu-dominio/api/admin/vip \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"username":"handle","is_vip":true}'
```

Para revocar: `"is_vip": false`.

## Categorías seed

- `// general`
- `// rxos-dev`
- `// debate`
- `// ops-infra`

## Seguridad (mínimo viable)

- Passwords con bcrypt (cost 12)
- Sesión JWT firmada, cookie `httpOnly` + `SameSite=lax` + `secure` en prod
- Validación básica de username/email/password y límites de body
- **No** es un foro hardened para internet hostil: falta rate-limit, captcha, email verify, moderación avanzada. Añadilos antes de abrir el nodo al público masivo.

## Estética

CRT scanlines, VT323 / Share Tech Mono, verde terminal, paneles tipo ventana 2000, ticker, glitch titles. Sin frameworks de componentes corporativos.
