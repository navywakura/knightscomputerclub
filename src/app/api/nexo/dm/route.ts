import { NextResponse } from "next/server";
import { getSessionUser, requireVerified } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { canOpenDm } from "@/lib/friends";
import {
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

      const messages = after
        ? await db`
            SELECT
              m.id, m.thread_id, m.author_id, m.body, m.created_at,
              u.username AS author_name
            FROM nexo_dm_messages m
            JOIN users u ON u.id = m.author_id
            WHERE m.thread_id = ${threadId} AND m.id > ${after}
            ORDER BY m.id ASC
            LIMIT 100
          `
        : await db`
            SELECT
              m.id, m.thread_id, m.author_id, m.body, m.created_at,
              u.username AS author_name
            FROM nexo_dm_messages m
            JOIN users u ON u.id = m.author_id
            WHERE m.thread_id = ${threadId}
            ORDER BY m.id DESC
            LIMIT 80
          `;
      const list = after ? messages : [...messages].reverse();

      return NextResponse.json({
        thread: thr[0],
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

      const rows = await db`
        INSERT INTO nexo_dm_messages (thread_id, author_id, body)
        VALUES (${threadId}, ${me.id}, ${text})
        RETURNING id, thread_id, author_id, body, created_at
      `;
      await db`
        UPDATE nexo_dm_threads SET updated_at = NOW() WHERE id = ${threadId}
      `;

      // notificar al otro participante
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
          },
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e) {
    console.error("[nexo dm POST]", e);
    return NextResponse.json({ error: "error dm" }, { status: 500 });
  }
}
