import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";

export async function GET(req: Request) {
  try {
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

    return NextResponse.json({ thread: threads[0], posts });
  } catch (e) {
    console.error("[posts GET]", e);
    return NextResponse.json({ error: "error al cargar posts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }

    const body = await req.json();
    const threadId = Number(body.thread_id || body.thread);
    const content = String(body.body || body.content || "").trim();

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
      SELECT id, locked FROM threads WHERE id = ${threadId} LIMIT 1
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
