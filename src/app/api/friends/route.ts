import { NextResponse } from "next/server";
import { getSessionUser, requireVerified } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { friendshipBetween } from "@/lib/friends";
import { safeNotify } from "@/lib/notify";
import { friendsPostSchema, readJsonBody } from "@/lib/validate";

/** Lista amigos + solicitudes entrantes/salientes */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    await ensureSchema();
    const db = getDb();

    const friends = await db`
      SELECT
        f.id AS friendship_id,
        f.updated_at,
        u.id, u.username, u.display_name, u.role, u.is_vip,
        u.avatar_media_id
      FROM friendships f
      JOIN users u ON u.id = CASE
        WHEN f.requester_id = ${user.id} THEN f.addressee_id
        ELSE f.requester_id
      END
      WHERE f.status = 'accepted'
        AND (f.requester_id = ${user.id} OR f.addressee_id = ${user.id})
        AND u.banned IS NOT TRUE
      ORDER BY u.username ASC
    `;

    const incoming = await db`
      SELECT
        f.id AS friendship_id,
        f.created_at,
        u.id, u.username, u.display_name, u.role, u.is_vip,
        u.avatar_media_id
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = ${user.id} AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;

    const outgoing = await db`
      SELECT
        f.id AS friendship_id,
        f.created_at,
        u.id, u.username, u.display_name, u.role, u.is_vip,
        u.avatar_media_id
      FROM friendships f
      JOIN users u ON u.id = f.addressee_id
      WHERE f.requester_id = ${user.id} AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;

    const mapUser = (r: Record<string, unknown>) => ({
      friendship_id: Number(r.friendship_id),
      id: Number(r.id),
      username: String(r.username),
      display_name: r.display_name ? String(r.display_name) : null,
      role: String(r.role || "member"),
      is_vip: Boolean(r.is_vip),
      avatar_url: r.avatar_media_id
        ? `/api/media/${r.avatar_media_id}`
        : null,
      created_at: r.created_at || r.updated_at,
    });

    return NextResponse.json({
      friends: friends.map((r) => mapUser(r as Record<string, unknown>)),
      incoming: incoming.map((r) => mapUser(r as Record<string, unknown>)),
      outgoing: outgoing.map((r) => mapUser(r as Record<string, unknown>)),
    });
  } catch (e) {
    console.error("[friends GET]", e);
    return NextResponse.json({ error: "error amigos" }, { status: 500 });
  }
}

/**
 * POST actions:
 * - request { username }
 * - accept { friendship_id }
 * - reject { friendship_id }
 * - cancel { friendship_id }  (outgoing pending)
 * - remove { user_id }        (unfriend)
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    const parsed = await readJsonBody(req, friendsPostSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;
    const action = String(body.action || "request");

    // solicitar amistad requiere email verificado; accept/reject/remove no
    if (action === "request") {
      const gate = requireVerified(user);
      if (!gate.ok) {
        return NextResponse.json(
          { error: gate.error, code: gate.code },
          { status: gate.code === "auth" ? 401 : 403 }
        );
      }
    } else if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    const me = user;

    await ensureSchema();
    const db = getDb();

    if (action === "request") {
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
      const targets = await db`
        SELECT id, username FROM users
        WHERE lower(username) = ${username} AND banned IS NOT TRUE
        LIMIT 1
      `;
      if (!targets[0]) {
        return NextResponse.json(
          { error: "usuario no encontrado" },
          { status: 404 }
        );
      }
      const otherId = Number(targets[0].id);
      const cur = await friendshipBetween(db, me.id, otherId);

      if (cur.status === "friends") {
        return NextResponse.json({ error: "ya son amigos" }, { status: 400 });
      }
      if (cur.status === "pending_out") {
        return NextResponse.json(
          { error: "solicitud ya enviada" },
          { status: 400 }
        );
      }
      if (cur.status === "pending_in") {
        // auto-accept reciprocal
        await db`
          UPDATE friendships
          SET status = 'accepted', updated_at = NOW()
          WHERE id = ${cur.id}
        `;
        await safeNotify({
          userId: otherId,
          type: "friends.accepted",
          title: `@${me.username} aceptó tu amistad`,
          body: "Ahora pueden abrirse DMs si su privacidad lo permite.",
          href: "/settings",
          actorId: me.id,
          actorLabel: me.username,
        });
        return NextResponse.json({ ok: true, status: "friends" });
      }

      // rejected or none → new pending (delete old rejected pair first)
      if (cur.id) {
        await db`DELETE FROM friendships WHERE id = ${cur.id}`;
      }
      const rows = await db`
        INSERT INTO friendships (requester_id, addressee_id, status)
        VALUES (${me.id}, ${otherId}, 'pending')
        RETURNING id
      `;

      await safeNotify({
        userId: otherId,
        type: "friends.request",
        title: `solicitud de amistad de @${me.username}`,
        body: "Aceptá o rechazá en Configuración.",
        href: "/settings?tab=friends",
        actorId: me.id,
        actorLabel: me.username,
        payload: { friendship_id: Number(rows[0].id) },
      });

      return NextResponse.json(
        { ok: true, status: "pending_out", friendship_id: rows[0].id },
        { status: 201 }
      );
    }

    if (action === "accept") {
      const fid = Number(body.friendship_id);
      if (!fid) {
        return NextResponse.json(
          { error: "friendship_id requerido" },
          { status: 400 }
        );
      }
      const rows = await db`
        SELECT id, requester_id, addressee_id, status
        FROM friendships
        WHERE id = ${fid} AND addressee_id = ${me.id} AND status = 'pending'
        LIMIT 1
      `;
      if (!rows[0]) {
        return NextResponse.json(
          { error: "solicitud no encontrada" },
          { status: 404 }
        );
      }
      await db`
        UPDATE friendships
        SET status = 'accepted', updated_at = NOW()
        WHERE id = ${fid}
      `;
      const requesterId = Number(rows[0].requester_id);
      await safeNotify({
        userId: requesterId,
        type: "friends.accepted",
        title: `@${me.username} aceptó tu amistad`,
        body: "Ya son amigos en el nodo.",
        href: "/settings?tab=friends",
        actorId: me.id,
        actorLabel: me.username,
      });
      return NextResponse.json({ ok: true, status: "friends" });
    }

    if (action === "reject") {
      const fid = Number(body.friendship_id);
      if (!fid) {
        return NextResponse.json(
          { error: "friendship_id requerido" },
          { status: 400 }
        );
      }
      await db`
        UPDATE friendships
        SET status = 'rejected', updated_at = NOW()
        WHERE id = ${fid}
          AND addressee_id = ${me.id}
          AND status = 'pending'
      `;
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    if (action === "cancel") {
      const fid = Number(body.friendship_id);
      if (!fid) {
        return NextResponse.json(
          { error: "friendship_id requerido" },
          { status: 400 }
        );
      }
      await db`
        DELETE FROM friendships
        WHERE id = ${fid}
          AND requester_id = ${me.id}
          AND status = 'pending'
      `;
      return NextResponse.json({ ok: true });
    }

    if (action === "remove") {
      const otherId = Number(body.user_id);
      if (!otherId) {
        return NextResponse.json({ error: "user_id requerido" }, { status: 400 });
      }
      await db`
        DELETE FROM friendships
        WHERE status = 'accepted'
          AND (
            (requester_id = ${me.id} AND addressee_id = ${otherId})
            OR (requester_id = ${otherId} AND addressee_id = ${me.id})
          )
      `;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e) {
    console.error("[friends POST]", e);
    return NextResponse.json({ error: "error amigos" }, { status: 500 });
  }
}
