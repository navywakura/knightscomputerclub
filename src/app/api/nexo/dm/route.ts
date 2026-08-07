import { NextResponse } from "next/server";
import { getSessionUser, requireVerified } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { canOpenDm } from "@/lib/friends";
import {
  canEditMessageByAge,
  hashPin,
  isValidPin,
  NEXO_MSG_MAX,
  orderedUserPair,
  verifyPin,
} from "@/lib/nexo";
import { safeNotify } from "@/lib/notify";

/** Lista DMs del usuario + abrir/crear con PIN */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    await ensureSchema();
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const threadId = Number(searchParams.get("thread") || 0);
    const after = Number(searchParams.get("after") || 0);

    if (threadId) {
      const thr = await db`
        SELECT id, user_low, user_high, created_by, created_at, updated_at
        FROM nexo_dm_threads
        WHERE id = ${threadId}
          AND (user_low = ${user.id} OR user_high = ${user.id})
        LIMIT 1
      `;
      if (!thr[0]) {
        return NextResponse.json({ error: "dm no encontrado" }, { status: 404 });
      }

      const peerId =
        Number(thr[0].user_low) === user.id
          ? Number(thr[0].user_high)
          : Number(thr[0].user_low);
      const peer = await db`
        SELECT id, username, role, is_vip FROM users WHERE id = ${peerId} LIMIT 1
      `;

      // purgar efímeros vencidos de este hilo
      await db`
        DELETE FROM nexo_dm_messages
        WHERE thread_id = ${threadId}
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
      `;

      const messages = after
        ? await db`
            SELECT
              m.id, m.thread_id, m.author_id, m.body, m.created_at,
              m.edited_at, m.deleted, m.expires_at, m.updated_at,
              u.username AS author_name,
              u.display_name AS author_display_name,
              u.role AS author_role,
              u.is_vip AS author_is_vip,
              u.avatar_media_id AS author_avatar_media_id
            FROM nexo_dm_messages m
            JOIN users u ON u.id = m.author_id
            WHERE m.thread_id = ${threadId} AND m.id > ${after}
            ORDER BY m.id ASC
            LIMIT 100
          `
        : await db`
            SELECT
              m.id, m.thread_id, m.author_id, m.body, m.created_at,
              m.edited_at, m.deleted, m.expires_at, m.updated_at,
              u.username AS author_name,
              u.display_name AS author_display_name,
              u.role AS author_role,
              u.is_vip AS author_is_vip,
              u.avatar_media_id AS author_avatar_media_id
            FROM nexo_dm_messages m
            JOIN users u ON u.id = m.author_id
            WHERE m.thread_id = ${threadId}
            ORDER BY m.id DESC
            LIMIT 80
          `;
      const mapDm = (r: Record<string, unknown>) => {
        const deleted = Boolean(r.deleted);
        return {
          id: Number(r.id),
          thread_id: Number(r.thread_id),
          author_id: Number(r.author_id),
          body: deleted ? "" : String(r.body || ""),
          created_at: r.created_at,
          edited_at: r.edited_at || null,
          deleted,
          expires_at: r.expires_at || null,
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
      };
      const list = after
        ? (messages as Record<string, unknown>[]).map(mapDm)
        : [...(messages as Record<string, unknown>[])].reverse().map(mapDm);

      const thrFull = await db`
        SELECT id, user_low, user_high, created_by, created_at, updated_at,
          ephemeral_minutes
        FROM nexo_dm_threads WHERE id = ${threadId} LIMIT 1
      `;

      return NextResponse.json({
        thread: thrFull[0] || thr[0],
        peer: peer[0] || null,
        messages: list,
      });
    }

    // lista de threads del user
    const threads = await db`
      SELECT
        t.id, t.user_low, t.user_high, t.created_by, t.created_at, t.updated_at,
        CASE WHEN t.user_low = ${user.id} THEN t.user_high ELSE t.user_low END AS peer_id
      FROM nexo_dm_threads t
      WHERE t.user_low = ${user.id} OR t.user_high = ${user.id}
      ORDER BY t.updated_at DESC
      LIMIT 50
    `;

    const withPeers = [];
    for (const t of threads) {
      const p = await db`
        SELECT id, username, role, is_vip FROM users WHERE id = ${t.peer_id} LIMIT 1
      `;
      withPeers.push({
        ...t,
        peer: p[0] || null,
      });
    }

    return NextResponse.json({ threads: withPeers });
  } catch (e) {
    console.error("[nexo dm GET]", e);
    return NextResponse.json({ error: "error dm" }, { status: 500 });
  }
}

/**
 * POST:
 * - action=open: { username, pin } → crea o abre DM (PIN de 4 dígitos de la conversación)
 * - action=message: { thread_id, body, pin } → envía (requiere pin válido)
 * - action=unlock: { thread_id, pin } → verifica pin
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
    const me = user!;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "open");

    await ensureSchema();
    const db = getDb();

    if (action === "unlock" || action === "open") {
      const pin = String(body.pin || "").trim();
      if (!isValidPin(pin)) {
        return NextResponse.json(
          { error: "PIN de 4 dígitos requerido" },
          { status: 400 }
        );
      }

      if (action === "unlock") {
        const threadId = Number(body.thread_id);
        if (!threadId) {
          return NextResponse.json({ error: "thread_id requerido" }, { status: 400 });
        }
        const thr = await db`
          SELECT id, pin_hash, user_low, user_high
          FROM nexo_dm_threads
          WHERE id = ${threadId}
            AND (user_low = ${me.id} OR user_high = ${me.id})
          LIMIT 1
        `;
        if (!thr[0]) {
          return NextResponse.json({ error: "dm no encontrado" }, { status: 404 });
        }
        const ok = await verifyPin(pin, String(thr[0].pin_hash));
        if (!ok) {
          return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
        }
        return NextResponse.json({ ok: true, thread_id: threadId });
      }

      // open/create
      const username = String(body.username || "")
        .trim()
        .toLowerCase()
        .replace(/^@/, "");
      if (!username || username === me.username.toLowerCase()) {
        return NextResponse.json(
          { error: "username de otro usuario requerido" },
          { status: 400 }
        );
      }
      const peers = await db`
        SELECT id, username FROM users
        WHERE lower(username) = ${username} AND banned IS NOT TRUE
        LIMIT 1
      `;
      if (!peers[0]) {
        return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
      }
      const peerId = Number(peers[0].id);
      // privacidad DMs del destinatario (everyone | friends)
      const allowed = await canOpenDm(db, me.id, peerId);
      if (!allowed.ok) {
        return NextResponse.json(
          { error: allowed.error, code: "dm_privacy" },
          { status: 403 }
        );
      }

      const [low, high] = orderedUserPair(me.id, peerId);

      const existing = await db`
        SELECT id, pin_hash FROM nexo_dm_threads
        WHERE user_low = ${low} AND user_high = ${high}
        LIMIT 1
      `;

      if (existing[0]) {
        const ok = await verifyPin(pin, String(existing[0].pin_hash));
        if (!ok) {
          return NextResponse.json(
            { error: "PIN incorrecto para este DM" },
            { status: 403 }
          );
        }
        return NextResponse.json({
          thread_id: existing[0].id,
          peer: peers[0],
          created: false,
        });
      }

      const pin_hash = await hashPin(pin);
      const created = await db`
        INSERT INTO nexo_dm_threads (user_low, user_high, pin_hash, created_by)
        VALUES (${low}, ${high}, ${pin_hash}, ${me.id})
        RETURNING id
      `;
      return NextResponse.json(
        { thread_id: created[0].id, peer: peers[0], created: true },
        { status: 201 }
      );
    }

    if (action === "message") {
      const threadId = Number(body.thread_id);
      const pin = String(body.pin || "").trim();
      const text = String(body.body || "").trim();
      if (!threadId || !text) {
        return NextResponse.json(
          { error: "thread_id y body requeridos" },
          { status: 400 }
        );
      }
      if (text.length > NEXO_MSG_MAX) {
        return NextResponse.json({ error: "mensaje demasiado largo" }, { status: 400 });
      }
      if (!isValidPin(pin)) {
        return NextResponse.json({ error: "PIN de 4 dígitos requerido" }, { status: 400 });
      }

      const thr = await db`
        SELECT id, pin_hash, user_low, user_high, ephemeral_minutes
        FROM nexo_dm_threads
        WHERE id = ${threadId}
          AND (user_low = ${me.id} OR user_high = ${me.id})
        LIMIT 1
      `;
      if (!thr[0]) {
        return NextResponse.json({ error: "dm no encontrado" }, { status: 404 });
      }
      const ok = await verifyPin(pin, String(thr[0].pin_hash));
      if (!ok) {
        return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
      }

      const eph = Number(thr[0].ephemeral_minutes || 0);
      const expiresSql =
        eph > 0
          ? await db`
              INSERT INTO nexo_dm_messages (thread_id, author_id, body, expires_at, updated_at)
              VALUES (
                ${threadId}, ${me.id}, ${text},
                NOW() + (${eph} * INTERVAL '1 minute'),
                NOW()
              )
              RETURNING id, thread_id, author_id, body, created_at, edited_at, deleted, expires_at
            `
          : await db`
              INSERT INTO nexo_dm_messages (thread_id, author_id, body, updated_at)
              VALUES (${threadId}, ${me.id}, ${text}, NOW())
              RETURNING id, thread_id, author_id, body, created_at, edited_at, deleted, expires_at
            `;
      const rows = expiresSql;
      await db`
        UPDATE nexo_dm_threads SET updated_at = NOW() WHERE id = ${threadId}
      `;

      const peerId =
        Number(thr[0].user_low) === me.id
          ? Number(thr[0].user_high)
          : Number(thr[0].user_low);
      const excerpt =
        text.length > 120 ? text.slice(0, 119).trimEnd() + "…" : text;
      await safeNotify({
        userId: peerId,
        type: "nexo.dm",
        title: `DM de @${me.username}`,
        body: excerpt,
        href: `/nexo?dm=${threadId}`,
        actorId: me.id,
        actorLabel: me.username,
        payload: { threadId, messageId: Number(rows[0].id) },
      });

      return NextResponse.json(
        {
          message: {
            ...rows[0],
            author_name: me.username,
            author_display_name: me.display_name,
            author_role: me.role,
            author_is_vip: me.is_vip,
            author_avatar_url: me.avatar_url,
            deleted: false,
          },
        },
        { status: 201 }
      );
    }

    // editar / borrar mensaje DM
    if (action === "edit" || action === "delete") {
      const messageId = Number(body.message_id || body.id);
      const pin = String(body.pin || "").trim();
      if (!messageId || !isValidPin(pin)) {
        return NextResponse.json(
          { error: "message_id y pin requeridos" },
          { status: 400 }
        );
      }
      const msg = await db`
        SELECT m.*, t.pin_hash, t.user_low, t.user_high
        FROM nexo_dm_messages m
        JOIN nexo_dm_threads t ON t.id = m.thread_id
        WHERE m.id = ${messageId}
          AND (t.user_low = ${me.id} OR t.user_high = ${me.id})
        LIMIT 1
      `;
      if (!msg[0]) {
        return NextResponse.json({ error: "mensaje no encontrado" }, { status: 404 });
      }
      const ok = await verifyPin(pin, String(msg[0].pin_hash));
      if (!ok) {
        return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
      }
      if (Number(msg[0].author_id) !== me.id) {
        return NextResponse.json({ error: "solo el autor" }, { status: 403 });
      }
      if (action === "delete") {
        await db`
          UPDATE nexo_dm_messages
          SET deleted = TRUE, body = '', updated_at = NOW()
          WHERE id = ${messageId}
        `;
        return NextResponse.json({ ok: true, id: messageId, deleted: true });
      }
      if (!canEditMessageByAge(String(msg[0].created_at))) {
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
        UPDATE nexo_dm_messages
        SET body = ${text}, edited_at = NOW(), updated_at = NOW()
        WHERE id = ${messageId}
        RETURNING id, thread_id, author_id, body, created_at, edited_at, deleted, expires_at
      `;
      return NextResponse.json({
        ok: true,
        message: { ...updated[0], author_name: me.username },
      });
    }

    // chats efímeros: TTL en minutos (0 = off)
    if (action === "ephemeral") {
      const threadId = Number(body.thread_id);
      const pin = String(body.pin || "").trim();
      let minutes = Number(body.minutes ?? body.ephemeral_minutes ?? 0);
      if (!Number.isFinite(minutes) || minutes < 0) minutes = 0;
      minutes = Math.min(Math.floor(minutes), 60 * 24 * 7); // max 7 días
      if (!threadId || !isValidPin(pin)) {
        return NextResponse.json(
          { error: "thread_id y pin requeridos" },
          { status: 400 }
        );
      }
      const thr = await db`
        SELECT id, pin_hash FROM nexo_dm_threads
        WHERE id = ${threadId}
          AND (user_low = ${me.id} OR user_high = ${me.id})
        LIMIT 1
      `;
      if (!thr[0]) {
        return NextResponse.json({ error: "dm no encontrado" }, { status: 404 });
      }
      const ok = await verifyPin(pin, String(thr[0].pin_hash));
      if (!ok) {
        return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
      }
      await db`
        UPDATE nexo_dm_threads
        SET ephemeral_minutes = ${minutes}, updated_at = NOW()
        WHERE id = ${threadId}
      `;
      return NextResponse.json({ ok: true, ephemeral_minutes: minutes });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e) {
    console.error("[nexo dm POST]", e);
    return NextResponse.json({ error: "error dm" }, { status: 500 });
  }
}
