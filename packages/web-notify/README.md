# @knights/web-notify

Kit de **notificaciones in-app** portable para webs con Postgres (Neon OK).

- Multi-app (`app_id`) — misma tabla, muchas webs
- API de servicio desacoplada de auth/UI
- UI React (`NotificationCenter`) que solo habla HTTP
- Adapter Neon listo

## Copiar a otra web

```bash
# copiá la carpeta entera
cp -R packages/web-notify /path/a/otra-web/packages/web-notify
```

En `tsconfig.json` de la otra web:

```json
{
  "compilerOptions": {
    "paths": {
      "@web-notify": ["./packages/web-notify/src/index.ts"],
      "@web-notify/react": ["./packages/web-notify/src/react/index.ts"]
    }
  }
}
```

## Schema

```ts
import { createNotifyService, createNeonNotifyDb } from "@web-notify";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const notify = createNotifyService({
  db: createNeonNotifyDb(sql),
  appId: "mi-otra-web", // ¡importante en multi-site!
});

await notify.ensureSchema();
```

O ejecutá `packages/web-notify/src/schema.sql` a mano.

## Emitir

```ts
await notify.notify({
  userId: 42,
  type: "order.shipped",
  title: "Tu pedido salió",
  body: "Tracking #123",
  href: "/orders/123",
  actorLabel: "system",
  payload: { orderId: 123 },
});

// varios destinatarios
await notify.notifyMany([1, 2, 3], {
  type: "announce",
  title: "Mantenimiento 22:00 UTC",
  href: "/status",
});
```

## API routes (Next.js App Router)

```ts
// app/api/notifications/route.ts
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth"; // tu auth
import { notify } from "@/lib/notify";       // tu instancia

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const limit = Number(new URL(req.url).searchParams.get("limit") || 25);
  const inbox = await notify.inbox(user.id, limit);
  return NextResponse.json(inbox);
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const body = await req.json();
  if (body.all) {
    const n = await notify.markAllRead(user.id);
    return NextResponse.json({ ok: true, marked: n });
  }
  const ids = (body.ids || []).map(Number).filter(Boolean);
  const n = await notify.markRead(user.id, ids);
  return NextResponse.json({ ok: true, marked: n });
}
```

## UI

```tsx
import { NotificationCenter } from "@web-notify/react";
// importá estilos del kit o copiá classes .wn-*
import "@web-notify/../src/react/styles.css"; // o copiá el CSS

{user && (
  <NotificationCenter
    apiBase="/api/notifications"
    enabled
    onNavigate={(href) => router.push(href)}
  />
)}
```

## Contratos

| Método | Descripción |
|--------|-------------|
| `notify(input)` | Crea 1 notificación |
| `notifyMany(ids, shared)` | Fan-out |
| `inbox(userId)` | `{ items, unread }` |
| `markRead` / `markAllRead` | Lectura |
| `purgeOld(days)` | Limpieza |

`user_id` es un entero de **tu** tabla de usuarios — el kit no conoce tu schema de auth.

## Multi-web

Misma DB Neon, apps distintas:

| Web | `appId` |
|-----|---------|
| knightscomputer.club | `knightscomputer` |
| otra.example | `otra` |

Las queries siempre filtran por `app_id`.
