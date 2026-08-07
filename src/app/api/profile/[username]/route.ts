import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { parseConnections } from "@/lib/auth";

type Props = { params: Promise<{ username: string }> };

/** Perfil público por username (sin login) */
export async function GET(_req: Request, { params }: Props) {
  try {
    const { username: raw } = await params;
    const username = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/[^a-z0-9_\-]/g, "")
      .slice(0, 32);
    if (username.length < 2) {
      return NextResponse.json({ error: "username inválido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();
    const rows = await db`
      SELECT
        id, username, role, is_vip, created_at,
        display_name, avatar_media_id, banner_media_id, bio, connections,
        pgp_fingerprint, pgp_public_key
      FROM users
      WHERE lower(username) = ${username}
        AND banned IS NOT TRUE
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows[0]) {
      return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
    }
    const u = rows[0] as Record<string, unknown>;
    const pubKey = u.pgp_public_key ? String(u.pgp_public_key) : null;

    return NextResponse.json({
      user: {
        id: Number(u.id),
        username: String(u.username),
        display_name: u.display_name ? String(u.display_name) : null,
        role: String(u.role || "member"),
        is_vip: Boolean(u.is_vip),
        created_at: u.created_at,
        bio: u.bio ? String(u.bio).slice(0, 100) : "",
        avatar_url: u.avatar_media_id
          ? `/api/media/${u.avatar_media_id}`
          : null,
        banner_url: u.banner_media_id
          ? `/api/media/${u.banner_media_id}`
          : null,
        connections: parseConnections(u.connections),
        pgp_fingerprint: u.pgp_fingerprint
          ? String(u.pgp_fingerprint)
          : null,
        // clave pública completa solo si está vinculada (perfil público intencional)
        pgp_public_key: pubKey ? pubKey.slice(0, 8000) : null,
      },
    });
  } catch (e) {
    console.error("[profile username GET]", e);
    return NextResponse.json({ error: "error" }, { status: 500 });
  }
}
