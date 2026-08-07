import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { excerptBody } from "@/lib/markdown";
import { absoluteUrl } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

/**
 * Feed RSS 2.0 por tablón del foro.
 * GET /api/rss/rxos  → // rxos-dev
 * GET /api/rss/ops   → // ops-infra (slug real: ops)
 * Público (guest) — SEO + suscriptores.
 */
export async function GET(_req: Request, { params }: Props) {
  try {
    const { slug: raw } = await params;
    const slug = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-]/g, "")
      .slice(0, 64);
    if (!slug) {
      return new NextResponse("slug requerido", { status: 400 });
    }

    await ensureSchema();
    const db = getDb();

    const cats = await db`
      SELECT id, slug, name, description
      FROM categories
      WHERE slug = ${slug}
      LIMIT 1
    `;
    if (!cats[0]) {
      return new NextResponse("board no encontrado", { status: 404 });
    }
    const cat = cats[0];

    const threads = await db`
      SELECT
        t.id, t.title, t.created_at, t.updated_at,
        u.username AS author_name,
        (
          SELECT p.body FROM posts p
          WHERE p.thread_id = t.id
          ORDER BY p.created_at ASC
          LIMIT 1
        ) AS op_body
      FROM threads t
      JOIN users u ON u.id = t.author_id
      WHERE t.category_id = ${cat.id}
      ORDER BY t.updated_at DESC
      LIMIT 40
    `;

    const channelUrl = absoluteUrl(`/forum/${slug}`);
    const selfUrl = absoluteUrl(`/api/rss/${slug}`);
    const items = (threads as Record<string, unknown>[])
      .map((t) => {
        const id = Number(t.id);
        const title = escapeXml(String(t.title || `thread #${id}`));
        const link = absoluteUrl(`/forum/thread/${id}`);
        const author = escapeXml(String(t.author_name || ""));
        const desc = escapeXml(
          excerptBody(String(t.op_body || ""), 280) || title
        );
        const pub = t.updated_at
          ? new Date(String(t.updated_at)).toUTCString()
          : new Date().toUTCString();
        return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <author>${author}@knightscomputer.club</author>
      <pubDate>${pub}</pubDate>
      <description>${desc}</description>
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>knightscomputer.club · ${escapeXml(String(cat.name))}</title>
    <link>${channelUrl}</link>
    <description>${escapeXml(String(cat.description || cat.name))}</description>
    <language>es</language>
    <atom:link href="${selfUrl}" rel="self" type="application/rss+xml"/>
    <generator>knightscomputer.club</generator>
${items}
  </channel>
</rss>
`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    console.error("[rss]", e);
    return new NextResponse("error rss", { status: 500 });
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
