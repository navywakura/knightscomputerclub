import { NextResponse } from "next/server";
import { getSessionUser, requireVerified } from "@/lib/auth";
import { verifyCaptcha } from "@/lib/captcha";
import { ensureSchema, getDb } from "@/lib/db";
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
    const category = searchParams.get("category");
    const limit = Math.min(Number(searchParams.get("limit") || 40), 100);

    let rows;
    // thumb: primer /api/media/N en el OP o en cualquier post del hilo
    if (category) {
      rows = await db`
        SELECT
          t.id, t.category_id, t.author_id, t.title, t.locked, t.sticky,
          t.created_at, t.updated_at,
          u.username AS author_name,
          u.role AS author_role,
          u.is_vip AS author_is_vip,
          c.slug AS category_slug,
          c.name AS category_name,
          COUNT(p.id)::int AS post_count,
          (
            SELECT substring(p2.body from '/api/media/([0-9]+)')
            FROM posts p2
            WHERE p2.thread_id = t.id
              AND p2.body ~ '/api/media/[0-9]+'
            ORDER BY p2.created_at ASC
            LIMIT 1
          ) AS thumb_media_id
        FROM threads t
        JOIN users u ON u.id = t.author_id
        JOIN categories c ON c.id = t.category_id
        LEFT JOIN posts p ON p.thread_id = t.id
        WHERE c.slug = ${category}
        GROUP BY t.id, u.username, u.role, u.is_vip, c.slug, c.name
        ORDER BY t.sticky DESC, t.updated_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await db`
        SELECT
          t.id, t.category_id, t.author_id, t.title, t.locked, t.sticky,
          t.created_at, t.updated_at,
          u.username AS author_name,
          u.role AS author_role,
          u.is_vip AS author_is_vip,
          c.slug AS category_slug,
          c.name AS category_name,
          COUNT(p.id)::int AS post_count,
          (
            SELECT substring(p2.body from '/api/media/([0-9]+)')
            FROM posts p2
            WHERE p2.thread_id = t.id
              AND p2.body ~ '/api/media/[0-9]+'
            ORDER BY p2.created_at ASC
            LIMIT 1
          ) AS thumb_media_id
        FROM threads t
        JOIN users u ON u.id = t.author_id
        JOIN categories c ON c.id = t.category_id
        LEFT JOIN posts p ON p.thread_id = t.id
        GROUP BY t.id, u.username, u.role, u.is_vip, c.slug, c.name
        ORDER BY t.sticky DESC, t.updated_at DESC
        LIMIT ${limit}
      `;
    }

    const threads = (rows as Record<string, unknown>[]).map((r) => ({
      ...r,
      thumb_url: r.thumb_media_id
        ? `/api/media/${r.thumb_media_id}`
        : null,
    }));

    return NextResponse.json({ threads });
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

    const body = await req.json();
    const categorySlug = String(body.category || body.category_slug || "").trim();
    const title = String(body.title || "").trim().slice(0, 200);
    const content = String(body.body || body.content || "").trim();

    const captcha = verifyCaptcha(body.captcha_token, body.captcha_answer);
    if (!captcha.ok) {
      return NextResponse.json(
        { error: captcha.error, code: "captcha" },
        { status: 400 }
      );
    }

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
      SELECT
        c.id,
        (
          SELECT COUNT(*)::int FROM categories ch WHERE ch.parent_id = c.id
        ) AS child_count
      FROM categories c
      WHERE c.slug = ${categorySlug}
      LIMIT 1
    `;
    if (!cats[0]) {
      return NextResponse.json({ error: "categoría no encontrada" }, { status: 404 });
    }
    if (Number(cats[0].child_count) > 0) {
      return NextResponse.json(
        {
          error:
            "este board es una sección; elegí una subcategoría (ej. // random)",
        },
        { status: 400 }
      );
    }
    const categoryId = cats[0].id as number;

    const threads = await db`
      INSERT INTO threads (category_id, author_id, title)
      VALUES (${categoryId}, ${me.id}, ${title})
      RETURNING id, category_id, author_id, title, locked, sticky, created_at, updated_at
    `;
    const thread = threads[0];

    await db`
      INSERT INTO posts (thread_id, author_id, body)
      VALUES (${thread.id}, ${me.id}, ${content})
    `;

    return NextResponse.json({ thread }, { status: 201 });
  } catch (e) {
    console.error("[threads POST]", e);
    return NextResponse.json({ error: "error al crear hilo" }, { status: 500 });
  }
}

/** Borrar hilo completo (cascade posts). Owner o autor del hilo. */
export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);
    const threadId = Number(
      body.id || body.thread_id || searchParams.get("id")
    );
    if (!threadId) {
      return NextResponse.json({ error: "id de hilo requerido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();

    const rows = await db`
      SELECT id, author_id, title FROM threads WHERE id = ${threadId} LIMIT 1
    `;
    if (!rows[0]) {
      return NextResponse.json({ error: "hilo no encontrado" }, { status: 404 });
    }

    const thread = rows[0] as {
      id: number;
      author_id: number;
      title: string;
    };
    const owner = isOwnerUser(user);
    if (!owner && thread.author_id !== user.id) {
      return NextResponse.json({ error: "sin permiso" }, { status: 403 });
    }

    // posts se borran por ON DELETE CASCADE
    await db`DELETE FROM threads WHERE id = ${threadId}`;

    return NextResponse.json({
      ok: true,
      deleted_thread_id: threadId,
      title: thread.title,
    });
  } catch (e) {
    console.error("[threads DELETE]", e);
    return NextResponse.json({ error: "error al borrar hilo" }, { status: 500 });
  }
}
