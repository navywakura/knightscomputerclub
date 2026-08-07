import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getNotify } from "@/lib/notify";

/** Inbox del usuario logueado */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 25), 50);
    const inbox = await getNotify().inbox(user.id, limit);
    return NextResponse.json(inbox);
  } catch (e) {
    console.error("[notifications GET]", e);
    return NextResponse.json({ error: "error al cargar" }, { status: 500 });
  }
}

/** Marcar leídas: { ids: number[] } | { all: true } */
export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const notify = getNotify();

    if (body.all === true) {
      const n = await notify.markAllRead(user.id);
      return NextResponse.json({ ok: true, marked: n });
    }

    const ids = Array.isArray(body.ids)
      ? body.ids.map(Number).filter((n: number) => Number.isFinite(n))
      : [];
    const n = await notify.markRead(user.id, ids);
    return NextResponse.json({ ok: true, marked: n });
  } catch (e) {
    console.error("[notifications PATCH]", e);
    return NextResponse.json({ error: "error al actualizar" }, { status: 500 });
  }
}
