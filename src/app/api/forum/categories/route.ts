import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";

export async function GET() {
  try {
    // público (guest puede ver boards en post compartido)
    const user = await getSessionUser().catch(() => null);
    if (user?.banned) {
      return NextResponse.json({ error: "baneado" }, { status: 403 });
    }
    await ensureSchema();
    const db = getDb();
    const rows = await db`
      SELECT
        c.id,
        c.slug,
        c.name,
        c.description,
        c.sort_order,
        c.parent_id,
        p.slug AS parent_slug,
        p.name AS parent_name,
        COUNT(t.id)::int AS thread_count,
        (
          SELECT COUNT(*)::int FROM categories ch WHERE ch.parent_id = c.id
        ) AS child_count
      FROM categories c
      LEFT JOIN categories p ON p.id = c.parent_id
      LEFT JOIN threads t ON t.category_id = c.id
      GROUP BY c.id, p.slug, p.name
      ORDER BY c.sort_order ASC, c.id ASC
    `;
    return NextResponse.json({ categories: rows });
  } catch (e) {
    console.error("[categories]", e);
    return NextResponse.json(
      { error: "no se pudieron cargar categorías" },
      { status: 500 }
    );
  }
}
