import { NextResponse } from "next/server";
import { getSessionUser, requireVerified } from "@/lib/auth";
import { verifyCaptcha } from "@/lib/captcha";
import { ensureSchema, getDb } from "@/lib/db";
import { previewsForPosts, type LinkPreview } from "@/lib/link-preview";
import { safeNotifyMany } from "@/lib/notify";
import { isOwnerUser } from "@/lib/ranks";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    await ensureSchema();
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const threadId = Number(searchParams.get("thread"));
    if (!threadId) {
      return NextResponse.json({ error: "thread requerido" }, { status: 400 });
    }

    const threads = await db`
      SELECT
        t.id, t.category_id, t.author_id, t.title, t.locked, t.sticky,
        t.created_at, t.updated_at,
        u.username AS author_name,
        u.role AS author_role,
        u.is_vip AS author_is_vip,
        c.slug AS category_slug,
        c.name AS category_name
      FROM threads t
      JOIN users u ON u.id = t.author_id
      JOIN categories c ON c.id = t.category_id
      WHERE t.id = ${threadId}
      LIMIT 1
    `;
    if (!threads[0]) {
      return NextResponse.json({ error: "hilo no encontrado" }, { status: 404 });
    }

    const posts = await db`
      SELECT
        p.id, p.thread_id, p.author_id, p.body, p.created_at, p.updated_at,
        u.username AS author_name,
        u.role AS author_role,
        u.is_vip AS author_is_vip
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.thread_id = ${threadId}
      ORDER BY p.created_at ASC
    `;

    // Open Graph embeds por post (cache + fetch)
    let previews: Record<string, LinkPreview[]> = {};
    try {
      const map = await previewsForPosts(
        posts.map((p) => ({
          id: Number(p.id),
          body: String(p.body || ""),
        }))
      );
      previews = Object.fromEntries(
        [...map.entries()].map(([id, list]) => [String(id), list])
      );
    } catch (e) {
      console.error("[posts GET previews]", e);
    }

    return NextResponse.json({ thread: threads[0], posts, previews });
  } catch (e) {
    console.error("[posts GET]", e);
    return NextResponse.json({ error: "error al cargar posts" }, { status: 500 });
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

    const body = await req.json();
    const threadId = Number(body.thread_id || body.thread);
    const content = String(body.body || body.content || "").trim();

    const captcha = verifyCaptcha(body.captcha_token, body.captcha_answer);
    if (!captcha.ok) {
      return NextResponse.json(
        { error: captcha.error, code: "captcha" },
        { status: 400 }
      );
    }

    if (!threadId || content.length < 1) {
      return NextResponse.json(
        { error: "thread_id y body requeridos" },
        { status: 400 }
      );
    }
    if (content.length > 20000) {
      return NextResponse.json({ error: "body demasiado largo" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();

    const threads = await db`
      SELECT id, locked, author_id, title FROM threads WHERE id = ${threadId} LIMIT 1
    `;
    if (!threads[0]) {
      return NextResponse.json({ error: "hilo no encontrado" }, { status: 404 });
    }
    if (threads[0].locked) {
      return NextResponse.json({ error: "hilo bloqueado" }, { status: 403 });
    }

    const posts = await db`
      INSERT INTO posts (thread_id, author_id, body)
      VALUES (${threadId}, ${user.id}, ${content})
      RETURNING id, thread_id, author_id, body, created_at, updated_at
    `;

    await db`
      UPDATE threads SET updated_at = NOW() WHERE id = ${threadId}
    `;

    // Notificar autor del hilo + participantes (excepto quien escribió)
    const participants = await db`
      SELECT DISTINCT author_id FROM posts WHERE thread_id = ${threadId}
    `;
    const recipientIds = new Set<number>();
    recipientIds.add(Number(threads[0].author_id));
    for (const row of participants) {
      recipientIds.add(Number(row.author_id));
    }
    recipientIds.delete(user.id);

    const postId = Number(posts[0].id);
    const title = String(threads[0].title || `thread #${threadId}`);
    const excerpt =
      content.length > 120 ? content.slice(0, 119).trimEnd() + "…" : content;

    await safeNotifyMany([...recipientIds], {
      type: "forum.reply",
      title: `respuesta en: ${title.slice(0, 80)}`,
      body: `@${user.username}: ${excerpt}`,
      href: `/forum/post/${postId}`,
      actorId: user.id,
      actorLabel: user.username,
      payload: { threadId, postId },
    });

    return NextResponse.json(
      {
        post: {
          ...posts[0],
          author_name: user.username,
          author_role: user.role,
          author_is_vip: user.is_vip,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[posts POST]", e);
    return NextResponse.json({ error: "error al publicar" }, { status: 500 });
  }
}

/** Borrar post: owner o autor del post */
export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);
    const postId = Number(body.id || body.post_id || searchParams.get("id"));
    if (!postId) {
      return NextResponse.json({ error: "id de post requerido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();

    const rows = await db`
      SELECT id, thread_id, author_id FROM posts WHERE id = ${postId} LIMIT 1
    `;
    if (!rows[0]) {
      return NextResponse.json({ error: "post no encontrado" }, { status: 404 });
    }

    const post = rows[0] as {
      id: number;
      thread_id: number;
      author_id: number;
    };
    const owner = isOwnerUser(user);
    if (!owner && post.author_id !== user.id) {
      return NextResponse.json({ error: "sin permiso" }, { status: 403 });
    }

    await db`DELETE FROM posts WHERE id = ${postId}`;

    // Si el hilo quedó vacío, borrar el hilo
    const left = await db`
      SELECT COUNT(*)::int AS n FROM posts WHERE thread_id = ${post.thread_id}
    `;
    let threadDeleted = false;
    if ((left[0]?.n as number) === 0) {
      await db`DELETE FROM threads WHERE id = ${post.thread_id}`;
      threadDeleted = true;
    } else {
      await db`
        UPDATE threads SET updated_at = NOW() WHERE id = ${post.thread_id}
      `;
    }

    return NextResponse.json({
      ok: true,
      deleted_post_id: postId,
      thread_id: post.thread_id,
      thread_deleted: threadDeleted,
    });
  } catch (e) {
    console.error("[posts DELETE]", e);
    return NextResponse.json({ error: "error al borrar post" }, { status: 500 });
  }
}
