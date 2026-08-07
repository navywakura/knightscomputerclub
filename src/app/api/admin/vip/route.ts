import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { sanitizeUsername } from "@/lib/auth";
import { safeNotify } from "@/lib/notify";

/**
 * Marca / desmarca VIP (donante) en el foro.
 * Header: Authorization: Bearer <ADMIN_SECRET>
 * Body: { "username": "handle", "is_vip": true }
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || secret.length < 12) {
      return NextResponse.json(
        { error: "ADMIN_SECRET no configurado" },
        { status: 503 }
      );
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token || token !== secret) {
      return NextResponse.json({ error: "no autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const username = sanitizeUsername(String(body.username || ""));
    const isVip = body.is_vip !== false && body.is_vip !== "false";

    if (username.length < 3) {
      return NextResponse.json({ error: "username inválido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();

    const rows = await db`
      UPDATE users
      SET is_vip = ${isVip}
      WHERE username = ${username}
      RETURNING id, username, role, is_vip, created_at
    `;

    if (!rows[0]) {
      return NextResponse.json(
        { error: "usuario no encontrado" },
        { status: 404 }
      );
    }

    if (isVip) {
      await safeNotify({
        userId: Number(rows[0].id),
        type: "rank.vip",
        title: "rango [VIP] activado",
        body: "Gracias por apoyar el nodo. Tu handle brilla en oro.",
        href: "/forum",
        actorLabel: "system",
        payload: { is_vip: true },
      });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: rows[0].id,
        username: rows[0].username,
        role: rows[0].role,
        is_vip: Boolean(rows[0].is_vip),
      },
    });
  } catch (e) {
    console.error("[admin/vip]", e);
    return NextResponse.json({ error: "error interno" }, { status: 500 });
  }
}
