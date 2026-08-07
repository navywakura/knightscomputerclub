import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";

/**
 * GET ?post=ID | ?posts=1,2,3
 *   → { likes: { [postId]: { count, liked } } }
 * POST { post_id, action?: 'like' | 'unlike' | 'toggle' }
 *   → { post_id, count, liked }
 */
export async function GET(req: Request) {
  try {
    const me = await getSessionUser().catch(() => null);
    await ensureSchema();
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const one = Number(searchParams.get("post") || 0);
    const many = String(searchParams.get("posts") || "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    const ids = one ? [one] : many;
    if (!ids.length) {
      return NextResponse.json({ error: "post(s) requerido" }, { status: 400 });
    }
    // cap
    const limited = ids.slice(0, 200);

    // Neon serverless: prefer unnest(array) over ANY with raw JS arrays
    const counts = await db`
      SELECT pl.post_id, COUNT(*)::int AS n
      FROM post_likes pl
      JOIN unnest(${limited}::int[]) AS pid(id) ON pl.post_id = pid.id
      GROUP BY pl.post_id
    `;
    const countMap = new Map<number, number>();
    for (const r of counts) {
      countMap.set(Number(r.post_id), Number(r.n));
    }

    const likedSet = new Set<number>();
    if (me) {
      const mine = await db`
        SELECT pl.post_id
        FROM post_likes pl
        JOIN unnest(${limited}::int[]) AS pid(id) ON pl.post_id = pid.id
        WHERE pl.user_id = ${me.id}
      `;
      for (const r of mine) likedSet.add(Number(r.post_id));
    }

    const likes: Record<string, { count: number; liked: boolean }> = {};
    for (const id of limited) {
      likes[String(id)] = {
        count: countMap.get(id) || 0,
        liked: likedSet.has(id),
      };
    }

    return NextResponse.json({ likes });
  } catch (e) {
    console.error("[likes GET]", e);
    return NextResponse.json({ error: "error likes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getSessionUser();
    if (!me || me.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const postId = Number(body.post_id || body.post || 0);
    const action = String(body.action || "toggle");
    if (!postId) {
      return NextResponse.json({ error: "post_id requerido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();

    const post = await db`
      SELECT id FROM posts WHERE id = ${postId} LIMIT 1
    `;
    if (!post[0]) {
      return NextResponse.json({ error: "post no encontrado" }, { status: 404 });
    }

    const existing = await db`
      SELECT 1 FROM post_likes
      WHERE post_id = ${postId} AND user_id = ${me.id}
      LIMIT 1
    `;
    const has = Boolean(existing[0]);

    let liked = has;
    if (action === "like" || (action === "toggle" && !has)) {
      await db`
        INSERT INTO post_likes (post_id, user_id)
        VALUES (${postId}, ${me.id})
        ON CONFLICT DO NOTHING
      `;
      liked = true;
    } else if (action === "unlike" || (action === "toggle" && has)) {
      await db`
        DELETE FROM post_likes
        WHERE post_id = ${postId} AND user_id = ${me.id}
      `;
      liked = false;
    }

    const c = await db`
      SELECT COUNT(*)::int AS n FROM post_likes WHERE post_id = ${postId}
    `;

    return NextResponse.json({
      post_id: postId,
      count: Number(c[0]?.n || 0),
      liked,
    });
  } catch (e) {
    console.error("[likes POST]", e);
    return NextResponse.json({ error: "error al likear" }, { status: 500 });
  }
}
