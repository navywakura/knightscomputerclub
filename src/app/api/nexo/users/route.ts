import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";

/** Buscar usuarios para DM (prefijo username) */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    const q = String(new URL(req.url).searchParams.get("q") || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "")
      .slice(0, 32);
    if (q.length < 1) {
      return NextResponse.json({ users: [] });
    }
    await ensureSchema();
    const db = getDb();
    const like = `${q}%`;
    const rows = await db`
      SELECT id, username, role, is_vip
      FROM users
      WHERE banned IS NOT TRUE
        AND lower(username) LIKE ${like}
        AND id <> ${user.id}
      ORDER BY username ASC
      LIMIT 12
    `;
    return NextResponse.json({ users: rows });
  } catch (e) {
    console.error("[nexo users]", e);
    return NextResponse.json({ error: "error", users: [] }, { status: 500 });
  }
}
