import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Búsqueda pública de usuarios y posts (perfil).
 * GET /api/search?q=...
 */
export async function GET(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const rl = rateLimit(`search:${ip}`, 40, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate limit", users: [], posts: [] },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec) },
        }
      );
    }

    const { searchParams } = new URL(req.url);
    const raw = String(searchParams.get("q") || "")
      .trim()
      .replace(/^@/, "")
      .slice(0, 64);
    if (raw.length < 2) {
      return NextResponse.json({ users: [], posts: [] });
    }

    await ensureSchema();
    const db = getDb();
    const q = raw.toLowerCase();
    const like = `%${escapeLike(q)}%`;
    const prefix = `${escapeLike(q)}%`;

    const [users, posts] = await Promise.all([
      db`
        SELECT
          id,
          username,
          display_name,
          role,
          is_vip,
          avatar_media_id
        FROM users
        WHERE banned IS NOT TRUE
          AND deleted_at IS NULL
          AND (
            lower(username) LIKE ${like} ESCAPE '\\'
            OR lower(COALESCE(display_name, '')) LIKE ${like} ESCAPE '\\'
          )
        ORDER BY
          CASE
            WHEN lower(username) = ${q} THEN 0
            WHEN lower(username) LIKE ${prefix} ESCAPE '\\' THEN 1
            ELSE 2
          END,
          username ASC
        LIMIT 8
      `,
      db`
        SELECT
          p.id,
          p.body,
          p.created_at,
          p.thread_id,
          t.title AS thread_title,
          u.username AS author_name
        FROM posts p
        JOIN threads t ON t.id = p.thread_id
        JOIN users u ON u.id = p.author_id
        WHERE lower(p.body) LIKE ${like} ESCAPE '\\'
           OR lower(t.title) LIKE ${like} ESCAPE '\\'
        ORDER BY p.created_at DESC
        LIMIT 10
      `,
    ]);

    return NextResponse.json({
      users: (users as Record<string, unknown>[]).map((u) => ({
        id: Number(u.id),
        username: String(u.username),
        display_name: u.display_name ? String(u.display_name) : null,
        role: String(u.role || "member"),
        is_vip: Boolean(u.is_vip),
        avatar_url: u.avatar_media_id
          ? `/api/media/${u.avatar_media_id}`
          : null,
      })),
      posts: (posts as Record<string, unknown>[]).map((p) => {
        const body = String(p.body || "")
          .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/[`*_~>#|]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const excerpt =
          body.length > 120 ? body.slice(0, 119).trimEnd() + "…" : body;
        return {
          id: Number(p.id),
          thread_id: Number(p.thread_id),
          thread_title: String(p.thread_title || ""),
          author_name: String(p.author_name || ""),
          excerpt: excerpt || "…",
          created_at: p.created_at,
        };
      }),
    });
  } catch (e) {
    console.error("[search GET]", e);
    return NextResponse.json(
      { error: "error", users: [], posts: [] },
      { status: 500 }
    );
  }
}
