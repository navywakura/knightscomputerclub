import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";

export async function GET(req: Request) {
  try {
    await ensureSchema();
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const limit = Math.min(Number(searchParams.get("limit") || 40), 100);

    let rows;
    if (category) {
      rows = await db`
        SELECT
          t.id, t.category_id, t.author_id, t.title, t.locked, t.sticky,
          t.created_at, t.updated_at,
          u.username AS author_name,
          c.slug AS category_slug,
          c.name AS category_name,
          COUNT(p.id)::int AS post_count
        FROM threads t
        JOIN users u ON u.id = t.author_id
        JOIN categories c ON c.id = t.category_id
        LEFT JOIN posts p ON p.thread_id = t.id
        WHERE c.slug = ${category}
        GROUP BY t.id, u.username, c.slug, c.name
        ORDER BY t.sticky DESC, t.updated_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await db`
        SELECT
          t.id, t.category_id, t.author_id, t.title, t.locked, t.sticky,
          t.created_at, t.updated_at,
          u.username AS author_name,
          c.slug AS category_slug,
          c.name AS category_name,
          COUNT(p.id)::int AS post_count
        FROM threads t
        JOIN users u ON u.id = t.author_id
        JOIN categories c ON c.id = t.category_id
        LEFT JOIN posts p ON p.thread_id = t.id
        GROUP BY t.id, u.username, c.slug, c.name
        ORDER BY t.sticky DESC, t.updated_at DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({ threads: rows });
  } catch (e) {
    console.error("[threads GET]", e);
    return NextResponse.json(
      { error: "no se pudieron cargar hilos" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }

    const body = await req.json();
    const categorySlug = String(body.category || body.category_slug || "").trim();
    const title = String(body.title || "").trim().slice(0, 200);
    const content = String(body.body || body.content || "").trim();

    if (!categorySlug || title.length < 3 || content.length < 3) {
      return NextResponse.json(
        { error: "category, title (≥3) y body (≥3) requeridos" },
        { status: 400 }
      );
    }
    if (content.length > 20000) {
      return NextResponse.json({ error: "body demasiado largo" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();

    const cats = await db`
      SELECT id FROM categories WHERE slug = ${categorySlug} LIMIT 1
    `;
    if (!cats[0]) {
      return NextResponse.json({ error: "categoría no encontrada" }, { status: 404 });
    }
    const categoryId = cats[0].id as number;

    const threads = await db`
      INSERT INTO threads (category_id, author_id, title)
      VALUES (${categoryId}, ${user.id}, ${title})
      RETURNING id, category_id, author_id, title, locked, sticky, created_at, updated_at
    `;
    const thread = threads[0];

    await db`
      INSERT INTO posts (thread_id, author_id, body)
      VALUES (${thread.id}, ${user.id}, ${content})
    `;

    return NextResponse.json({ thread }, { status: 201 });
  } catch (e) {
    console.error("[threads POST]", e);
    return NextResponse.json({ error: "error al crear hilo" }, { status: 500 });
  }
}
