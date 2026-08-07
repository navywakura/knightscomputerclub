import { NextResponse } from "next/server";
import { getSessionUser, requireVerified } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";

const ONLINE_MS = 3 * 60 * 1000; // 3 min

/** Lista miembros del board + join/heartbeat */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    const boardId = Number(new URL(req.url).searchParams.get("board") || 0);
    if (!boardId) {
      return NextResponse.json({ error: "board requerido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();

    const board = await db`
      SELECT id FROM nexo_boards WHERE id = ${boardId} LIMIT 1
    `;
    if (!board[0]) {
      return NextResponse.json({ error: "board no encontrado" }, { status: 404 });
    }

    const rows = await db`
      SELECT
        m.user_id AS id,
        m.joined_at,
        m.last_seen,
        u.username,
        u.display_name,
        u.role,
        u.is_vip,
        u.avatar_media_id
      FROM nexo_board_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.board_id = ${boardId}
        AND u.banned IS NOT TRUE
      ORDER BY
        CASE WHEN m.last_seen > NOW() - INTERVAL '3 minutes' THEN 0 ELSE 1 END,
        u.username ASC
      LIMIT 200
    `;

    const now = Date.now();
    const members = rows.map((r) => {
      const last = r.last_seen ? new Date(String(r.last_seen)).getTime() : 0;
      const online = last > 0 && now - last < ONLINE_MS;
      return {
        id: Number(r.id),
        username: String(r.username),
        display_name: r.display_name ? String(r.display_name) : null,
        role: String(r.role || "member"),
        is_vip: Boolean(r.is_vip),
        avatar_url: r.avatar_media_id
          ? `/api/media/${r.avatar_media_id}`
          : null,
        joined_at: r.joined_at,
        last_seen: r.last_seen,
        online,
      };
    });

    return NextResponse.json({
      board_id: boardId,
      members,
      online_count: members.filter((m) => m.online).length,
    });
  } catch (e) {
    console.error("[nexo members GET]", e);
    return NextResponse.json({ error: "error members" }, { status: 500 });
  }
}

/**
 * POST: unirse / heartbeat de presencia
 * { board_id } — upsert member + last_seen = now
 */
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
    if (user!.banned) {
      return NextResponse.json({ error: "baneado" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const boardId = Number(body.board_id || body.board || 0);
    if (!boardId) {
      return NextResponse.json({ error: "board_id requerido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();
    const board = await db`
      SELECT id FROM nexo_boards WHERE id = ${boardId} LIMIT 1
    `;
    if (!board[0]) {
      return NextResponse.json({ error: "board no encontrado" }, { status: 404 });
    }

    await db`
      INSERT INTO nexo_board_members (board_id, user_id, joined_at, last_seen)
      VALUES (${boardId}, ${user!.id}, NOW(), NOW())
      ON CONFLICT (board_id, user_id)
      DO UPDATE SET last_seen = NOW()
    `;

    return NextResponse.json({ ok: true, board_id: boardId });
  } catch (e) {
    console.error("[nexo members POST]", e);
    return NextResponse.json({ error: "error join" }, { status: 500 });
  }
}
