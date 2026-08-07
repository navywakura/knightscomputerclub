import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { NEXO_MSG_MAX } from "@/lib/nexo";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const boardId = Number(searchParams.get("board"));
    const after = Number(searchParams.get("after") || 0);
    if (!boardId) {
      return NextResponse.json({ error: "board requerido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();

    const board = await db`
      SELECT id, slug, name FROM nexo_boards WHERE id = ${boardId} LIMIT 1
    `;
    if (!board[0]) {
      return NextResponse.json({ error: "board no encontrado" }, { status: 404 });
    }

    const messages = after
      ? await db`
          SELECT
            m.id, m.board_id, m.author_id, m.body, m.created_at,
            u.username AS author_name,
            u.role AS author_role,
            u.is_vip AS author_is_vip
          FROM nexo_messages m
          JOIN users u ON u.id = m.author_id
          WHERE m.board_id = ${boardId} AND m.id > ${after}
          ORDER BY m.id ASC
          LIMIT 100
        `
      : await db`
          SELECT
            m.id, m.board_id, m.author_id, m.body, m.created_at,
            u.username AS author_name,
            u.role AS author_role,
            u.is_vip AS author_is_vip
          FROM nexo_messages m
          JOIN users u ON u.id = m.author_id
          WHERE m.board_id = ${boardId}
          ORDER BY m.id DESC
          LIMIT 80
        `;

    // historial: devolver cronológico
    const list = after
      ? messages
      : [...messages].reverse();

    return NextResponse.json({ board: board[0], messages: list });
  } catch (e) {
    console.error("[nexo messages GET]", e);
    return NextResponse.json(
      { error: "no se pudieron cargar mensajes" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const boardId = Number(body.board_id || body.board);
    const text = String(body.body || body.content || "").trim();
    if (!boardId || text.length < 1) {
      return NextResponse.json(
        { error: "board_id y body requeridos" },
        { status: 400 }
      );
    }
    if (text.length > NEXO_MSG_MAX) {
      return NextResponse.json({ error: "mensaje demasiado largo" }, { status: 400 });
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
      INSERT INTO nexo_messages (board_id, author_id, body)
      VALUES (${boardId}, ${user.id}, ${text})
      RETURNING id, board_id, author_id, body, created_at
    `;
    await db`
      UPDATE nexo_boards SET updated_at = NOW() WHERE id = ${boardId}
    `;

    return NextResponse.json(
      {
        message: {
          ...rows[0],
          author_name: user.username,
          author_role: user.role,
          author_is_vip: user.is_vip,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[nexo messages POST]", e);
    return NextResponse.json({ error: "error al enviar" }, { status: 500 });
  }
}
