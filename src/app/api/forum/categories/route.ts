import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";

export async function GET() {
  try {
    await ensureSchema();
    const db = getDb();
    const rows = await db`
      SELECT
        c.id, c.slug, c.name, c.description, c.sort_order,
        COUNT(t.id)::int AS thread_count
      FROM categories c
      LEFT JOIN threads t ON t.category_id = c.id
      GROUP BY c.id
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
