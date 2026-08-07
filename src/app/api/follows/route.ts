import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";

/**
 * GET ?user=username | ?user_id=N
 *   → { followers_count, following_count, following: bool, followers[], following_list[] }
 * POST { username | user_id, action?: 'follow' | 'unfollow' | 'toggle' }
 */
export async function GET(req: Request) {
  try {
    const me = await getSessionUser().catch(() => null);
    await ensureSchema();
    const db = getDb();
    const { searchParams } = new URL(req.url);
    let targetId: number | null = null;
    const uid = Number(searchParams.get("user_id") || 0);
    const uname = String(searchParams.get("user") || "")
      .toLowerCase()
      .replace(/^@/, "")
      .trim();

    if (uid) {
      targetId = uid;
    } else if (uname) {
      const rows = await db`
        SELECT id FROM users
        WHERE lower(username) = ${uname}
          AND banned IS NOT TRUE
          AND deleted_at IS NULL
        LIMIT 1
      `;
      if (!rows[0]) {
        return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
      }
      targetId = Number(rows[0].id);
    } else if (me) {
      targetId = me.id;
    } else {
      return NextResponse.json({ error: "user requerido" }, { status: 400 });
    }

    const counts = await db`
      SELECT
        (SELECT COUNT(*)::int FROM follows WHERE following_id = ${targetId}) AS followers,
        (SELECT COUNT(*)::int FROM follows WHERE follower_id = ${targetId}) AS following
    `;

    let iFollow = false;
    if (me && me.id !== targetId) {
      const f = await db`
        SELECT 1 FROM follows
        WHERE follower_id = ${me.id} AND following_id = ${targetId}
        LIMIT 1
      `;
      iFollow = Boolean(f[0]);
    }

    // lista de seguidos (por el target)
    const followingList = await db`
      SELECT
        u.id, u.username, u.display_name, u.role, u.is_vip,
        u.avatar_media_id
      FROM follows f
      JOIN users u ON u.id = f.following_id
      WHERE f.follower_id = ${targetId}
        AND u.banned IS NOT TRUE
        AND u.deleted_at IS NULL
      ORDER BY f.created_at DESC
      LIMIT 100
    `;

    const followersList = await db`
      SELECT
        u.id, u.username, u.display_name, u.role, u.is_vip,
        u.avatar_media_id
      FROM follows f
      JOIN users u ON u.id = f.follower_id
      WHERE f.following_id = ${targetId}
        AND u.banned IS NOT TRUE
        AND u.deleted_at IS NULL
      ORDER BY f.created_at DESC
      LIMIT 100
    `;

    const mapU = (r: Record<string, unknown>) => ({
      id: Number(r.id),
      username: String(r.username),
      display_name: r.display_name ? String(r.display_name) : null,
      role: String(r.role || "member"),
      is_vip: Boolean(r.is_vip),
      avatar_url: r.avatar_media_id
        ? `/api/media/${r.avatar_media_id}`
        : null,
    });

    return NextResponse.json({
      user_id: targetId,
      followers_count: Number(counts[0]?.followers || 0),
      following_count: Number(counts[0]?.following || 0),
      following: iFollow,
      following_list: followingList.map((r) =>
        mapU(r as Record<string, unknown>)
      ),
      followers: followersList.map((r) => mapU(r as Record<string, unknown>)),
    });
  } catch (e) {
    console.error("[follows GET]", e);
    return NextResponse.json({ error: "error follows" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me || me.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "toggle");
    let targetId = Number(body.user_id || 0);
    const uname = String(body.username || "")
      .toLowerCase()
      .replace(/^@/, "")
      .trim();

    await ensureSchema();
    const db = getDb();

    if (!targetId && uname) {
      const rows = await db`
        SELECT id FROM users
        WHERE lower(username) = ${uname}
          AND banned IS NOT TRUE
          AND deleted_at IS NULL
        LIMIT 1
      `;
      if (!rows[0]) {
        return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
      }
      targetId = Number(rows[0].id);
    }
    if (!targetId) {
      return NextResponse.json({ error: "user_id o username requerido" }, { status: 400 });
    }
    if (targetId === me.id) {
      return NextResponse.json(
        { error: "no podés seguirte a vos mismo" },
        { status: 400 }
      );
    }

    const existing = await db`
      SELECT 1 FROM follows
      WHERE follower_id = ${me.id} AND following_id = ${targetId}
      LIMIT 1
    `;
    const isFollowing = Boolean(existing[0]);

    let following = isFollowing;
    if (action === "follow" || (action === "toggle" && !isFollowing)) {
      await db`
        INSERT INTO follows (follower_id, following_id)
        VALUES (${me.id}, ${targetId})
        ON CONFLICT DO NOTHING
      `;
      following = true;
    } else if (action === "unfollow" || (action === "toggle" && isFollowing)) {
      await db`
        DELETE FROM follows
        WHERE follower_id = ${me.id} AND following_id = ${targetId}
      `;
      following = false;
    }

    const counts = await db`
      SELECT
        (SELECT COUNT(*)::int FROM follows WHERE following_id = ${targetId}) AS followers,
        (SELECT COUNT(*)::int FROM follows WHERE follower_id = ${targetId}) AS following
    `;

    return NextResponse.json({
      ok: true,
      following,
      followers_count: Number(counts[0]?.followers || 0),
      following_count: Number(counts[0]?.following || 0),
    });
  } catch (e) {
    console.error("[follows POST]", e);
    return NextResponse.json({ error: "error al seguir" }, { status: 500 });
  }
}
