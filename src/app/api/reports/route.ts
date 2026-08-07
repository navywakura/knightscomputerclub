import { NextResponse } from "next/server";
import { getSessionUser, requireVerified } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { isOwnerUser } from "@/lib/ranks";
import { safeNotify } from "@/lib/notify";

const TYPES = new Set([
  "forum_post",
  "forum_thread",
  "nexo_message",
  "nexo_dm",
  "user",
]);

const REASONS = new Set([
  "spam",
  "harassment",
  "nsfw",
  "illegal",
  "impersonation",
  "other",
]);

/** Crear reporte */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    const gate = requireVerified(user);
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.error, code: gate.code },
        { status: gate.code === "auth" ? 401 : 403 }
      );
    }
    const me = user!;
    if (me.banned) {
      return NextResponse.json({ error: "baneado" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const target_type = String(body.target_type || body.type || "");
    const target_id = Number(body.target_id || body.id || 0);
    const reason = String(body.reason || "other").toLowerCase();
    const details = String(body.details || body.body || "")
      .trim()
      .slice(0, 500);

    if (!TYPES.has(target_type) || !target_id) {
      return NextResponse.json(
        { error: "target_type y target_id requeridos" },
        { status: 400 }
      );
    }
    if (!REASONS.has(reason)) {
      return NextResponse.json({ error: "reason inválido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();

    // anti-spam: max 5 reportes abiertos por user
    const open = await db`
      SELECT COUNT(*)::int AS n FROM reports
      WHERE reporter_id = ${me.id} AND status = 'open'
    `;
    if (Number(open[0]?.n || 0) >= 15) {
      return NextResponse.json(
        { error: "demasiados reportes abiertos" },
        { status: 429 }
      );
    }

    const rows = await db`
      INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
      VALUES (${me.id}, ${target_type}, ${target_id}, ${reason}, ${details})
      RETURNING id, created_at
    `;

    // notificar owners (best-effort)
    try {
      const owners = await db`
        SELECT id FROM users
        WHERE role = 'owner' OR lower(username) = 'roger'
        LIMIT 5
      `;
      for (const o of owners) {
        if (Number(o.id) === me.id) continue;
        await safeNotify({
          userId: Number(o.id),
          type: "mod.report",
          title: `reporte: ${target_type} #${target_id}`,
          body: `@${me.username}: ${reason}${details ? ` — ${details.slice(0, 80)}` : ""}`,
          href: "/admin",
          actorId: me.id,
          actorLabel: me.username,
          payload: { reportId: Number(rows[0].id), target_type, target_id },
        });
      }
    } catch {
      /* */
    }

    return NextResponse.json(
      { ok: true, id: rows[0].id },
      { status: 201 }
    );
  } catch (e) {
    console.error("[reports POST]", e);
    return NextResponse.json({ error: "error al reportar" }, { status: 500 });
  }
}

/** Lista reportes (solo owner) */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || !isOwnerUser(user)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    await ensureSchema();
    const db = getDb();
    const rows = await db`
      SELECT
        r.*,
        u.username AS reporter_name
      FROM reports r
      JOIN users u ON u.id = r.reporter_id
      ORDER BY r.created_at DESC
      LIMIT 100
    `;
    return NextResponse.json({ reports: rows });
  } catch (e) {
    console.error("[reports GET]", e);
    return NextResponse.json({ error: "error" }, { status: 500 });
  }
}
