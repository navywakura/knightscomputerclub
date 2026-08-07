import { NextResponse } from "next/server";
import { getSessionUser, requireVerified } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { extractMentions, resolveMentionUserIds } from "@/lib/mentions";
import {
  canEditMessageByAge,
  messageExcerpt,
  NEXO_MSG_MAX,
} from "@/lib/nexo";
import { safeNotifyMany } from "@/lib/notify";
import { isOwnerUser } from "@/lib/ranks";

function mapMsg(r: Record<string, unknown>) {
  const deleted = Boolean(r.deleted);
  return {
    id: Number(r.id),
    board_id: Number(r.board_id),
    author_id: Number(r.author_id),
    body: deleted ? "" : String(r.body || ""),
    created_at: r.created_at,
    edited_at: r.edited_at || null,
    deleted,
    pinned: Boolean(r.pinned),
    reply_to_id: r.reply_to_id ? Number(r.reply_to_id) : null,
    updated_at: r.updated_at || r.created_at,
    author_name: String(r.author_name || ""),
    author_display_name: r.author_display_name
      ? String(r.author_display_name)
      : null,
    author_role: String(r.author_role || "member"),
    author_is_vip: Boolean(r.author_is_vip),
    author_avatar_url: r.author_avatar_media_id
      ? `/api/media/${r.author_avatar_media_id}`
      : null,
  };
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const boardId = Number(searchParams.get("board"));
    const after = Number(searchParams.get("after") || 0);
    const since = searchParams.get("since"); // ISO — edits/deletes
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

    if (since && after) {
      const updated = await db`
        SELECT
          m.id, m.board_id, m.author_id, m.body, m.created_at,
          m.edited_at, m.deleted, m.pinned, m.reply_to_id, m.updated_at,
          u.username AS author_name,
          u.display_name AS author_display_name,
          u.role AS author_role,
          u.is_vip AS author_is_vip,
          u.avatar_media_id AS author_avatar_media_id
        FROM nexo_messages m
        JOIN users u ON u.id = m.author_id
        WHERE m.board_id = ${boardId}
          AND m.id <= ${after}
          AND m.updated_at > ${since}::timestamptz
        ORDER BY m.id ASC
        LIMIT 50
      `;
      const news = await db`
        SELECT
          m.id, m.board_id, m.author_id, m.body, m.created_at,
          m.edited_at, m.deleted, m.pinned, m.reply_to_id, m.updated_at,
          u.username AS author_name,
          u.display_name AS author_display_name,
          u.role AS author_role,
          u.is_vip AS author_is_vip,
          u.avatar_media_id AS author_avatar_media_id
        FROM nexo_messages m
        JOIN users u ON u.id = m.author_id
        WHERE m.board_id = ${boardId} AND m.id > ${after}
        ORDER BY m.id ASC
        LIMIT 100
      `;
      return NextResponse.json({
        board: board[0],
        messages: (news as Record<string, unknown>[]).map(mapMsg),
        updates: (updated as Record<string, unknown>[]).map(mapMsg),
        server_time: new Date().toISOString(),
      });
    }

    const messages = after
      ? await db`
          SELECT
            m.id, m.board_id, m.author_id, m.body, m.created_at,
            m.edited_at, m.deleted, m.pinned, m.reply_to_id, m.updated_at,
            u.username AS author_name,
            u.display_name AS author_display_name,
            u.role AS author_role,
            u.is_vip AS author_is_vip,
            u.avatar_media_id AS author_avatar_media_id
          FROM nexo_messages m
          JOIN users u ON u.id = m.author_id
          WHERE m.board_id = ${boardId} AND m.id > ${after}
          ORDER BY m.id ASC
          LIMIT 100
        `
      : await db`
          SELECT
            m.id, m.board_id, m.author_id, m.body, m.created_at,
            m.edited_at, m.deleted, m.pinned, m.reply_to_id, m.updated_at,
            u.username AS author_name,
            u.display_name AS author_display_name,
            u.role AS author_role,
            u.is_vip AS author_is_vip,
            u.avatar_media_id AS author_avatar_media_id
          FROM nexo_messages m
          JOIN users u ON u.id = m.author_id
          WHERE m.board_id = ${boardId}
          ORDER BY m.id DESC
          LIMIT 80
        `;

    const list = after
      ? (messages as Record<string, unknown>[]).map(mapMsg)
      : [...(messages as Record<string, unknown>[])].reverse().map(mapMsg);

    return NextResponse.json({
      board: board[0],
      messages: list,
      server_time: new Date().toISOString(),
    });
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
    const boardId = Number(body.board_id || body.board);
    const text = String(body.body || body.content || "").trim();
    const replyTo = body.reply_to_id ? Number(body.reply_to_id) : null;
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

    if (replyTo) {
      const parent = await db`
        SELECT id FROM nexo_messages
        WHERE id = ${replyTo} AND board_id = ${boardId} LIMIT 1
      `;
      if (!parent[0]) {
        return NextResponse.json({ error: "reply_to inválido" }, { status: 400 });
      }
    }

    const rows = await db`
      INSERT INTO nexo_messages (board_id, author_id, body, reply_to_id, updated_at)
      VALUES (${boardId}, ${me.id}, ${text}, ${replyTo}, NOW())
      RETURNING id, board_id, author_id, body, created_at, edited_at, deleted, pinned, reply_to_id, updated_at
    `;
    await db`
      UPDATE nexo_boards SET updated_at = NOW() WHERE id = ${boardId}
    `;
    await db`
      INSERT INTO nexo_board_members (board_id, user_id, joined_at, last_seen)
      VALUES (${boardId}, ${me.id}, NOW(), NOW())
      ON CONFLICT (board_id, user_id)
      DO UPDATE SET last_seen = NOW()
    `;

    const names = extractMentions(text);
    if (names.length) {
      const targets = await resolveMentionUserIds(db, names, me.id);
      if (targets.length) {
        const boardMeta = await db`
          SELECT slug, name FROM nexo_boards WHERE id = ${boardId} LIMIT 1
        `;
        const bname = boardMeta[0]
          ? String(boardMeta[0].name)
          : `board #${boardId}`;
        await safeNotifyMany(
          targets.map((t) => t.id),
          {
            type: "nexo.mention",
            title: `@${me.username} te mencionó en ${bname}`,
            body: messageExcerpt(text),
            href: `/nexo?board=${boardId}`,
            actorId: me.id,
            actorLabel: me.username,
            payload: {
              boardId,
              messageId: Number(rows[0].id),
              kind: "mention",
            },
          }
        );
      }
    }

    return NextResponse.json(
      {
        message: mapMsg({
          ...rows[0],
          author_name: me.username,
          author_display_name: me.display_name,
          author_role: me.role,
          author_is_vip: me.is_vip,
          author_avatar_media_id: me.avatar_url
            ? Number(String(me.avatar_url).replace(/^.*\//, "")) || null
            : null,
        }),
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[nexo messages POST]", e);
    return NextResponse.json({ error: "error al enviar" }, { status: 500 });
  }
}

/**
 * PATCH: edit | soft-delete | pin
 * { id, action: 'edit'|'delete'|'pin'|'unpin', body? }
 */
export async function PATCH(req: Request) {
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
    const id = Number(body.id || body.message_id);
    const action = String(body.action || "edit");
    if (!id) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();
    const rows = await db`
      SELECT m.*, b.owner_id
      FROM nexo_messages m
      JOIN nexo_boards b ON b.id = m.board_id
      WHERE m.id = ${id}
      LIMIT 1
    `;
    if (!rows[0]) {
      return NextResponse.json({ error: "mensaje no encontrado" }, { status: 404 });
    }
    const msg = rows[0] as {
      id: number;
      author_id: number;
      board_id: number;
      body: string;
      created_at: string;
      deleted: boolean;
      owner_id: number;
    };
    const isAuthor = Number(msg.author_id) === me.id;
    const isMod =
      isOwnerUser(me) ||
      Number(msg.owner_id) === me.id ||
      me.role === "mod";

    if (action === "delete") {
      if (!isAuthor && !isMod) {
        return NextResponse.json({ error: "sin permiso" }, { status: 403 });
      }
      await db`
        UPDATE nexo_messages
        SET deleted = TRUE, body = '', updated_at = NOW()
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true, id, deleted: true });
    }

    if (action === "pin" || action === "unpin") {
      if (!isMod && !isAuthor) {
        return NextResponse.json({ error: "sin permiso" }, { status: 403 });
      }
      const pinned = action === "pin";
      await db`
        UPDATE nexo_messages
        SET pinned = ${pinned}, updated_at = NOW()
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true, id, pinned });
    }

    // edit
    if (!isAuthor) {
      return NextResponse.json({ error: "solo el autor puede editar" }, { status: 403 });
    }
    if (msg.deleted) {
      return NextResponse.json({ error: "mensaje eliminado" }, { status: 400 });
    }
    if (!canEditMessageByAge(msg.created_at)) {
      return NextResponse.json(
        { error: "solo se puede editar durante las primeras 10 horas" },
        { status: 403 }
      );
    }
    const text = String(body.body || "").trim();
    if (text.length < 1 || text.length > NEXO_MSG_MAX) {
      return NextResponse.json({ error: "body inválido" }, { status: 400 });
    }
    const updated = await db`
      UPDATE nexo_messages
      SET body = ${text}, edited_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, board_id, author_id, body, created_at, edited_at, deleted, pinned, reply_to_id, updated_at
    `;
    return NextResponse.json({
      ok: true,
      message: {
        ...updated[0],
        author_name: me.username,
        author_display_name: me.display_name,
        author_role: me.role,
        author_is_vip: me.is_vip,
        author_avatar_url: me.avatar_url,
      },
    });
  } catch (e) {
    console.error("[nexo messages PATCH]", e);
    return NextResponse.json({ error: "error al actualizar" }, { status: 500 });
  }
}
