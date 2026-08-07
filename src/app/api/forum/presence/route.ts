import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";

/** Usuarios vistos en los últimos N minutos = "en línea" */
const ONLINE_WINDOW_MIN = 5;

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido", online: [] }, { status: 401 });
    }
    await ensureSchema();
    const db = getDb();
    const rows = await db`
      SELECT
        id,
        username,
        role,
        is_vip,
        last_seen
      FROM users
      WHERE banned IS NOT TRUE
        AND last_seen IS NOT NULL
        AND last_seen > NOW() - INTERVAL '5 minutes'
      ORDER BY last_seen DESC
      LIMIT 80
    `;
    return NextResponse.json({
      online: rows,
      window_minutes: ONLINE_WINDOW_MIN,
    });
  } catch (e) {
    console.error("[presence GET]", e);
    return NextResponse.json(
      { error: "no se pudo cargar presencia", online: [] },
      { status: 500 }
    );
  }
}

/** Heartbeat: marca last_seen del usuario logueado */
export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    await ensureSchema();
    const db = getDb();
    await db`
      UPDATE users SET last_seen = NOW() WHERE id = ${user.id}
    `;
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    console.error("[presence POST]", e);
    return NextResponse.json({ error: "error de presencia" }, { status: 500 });
  }
}
