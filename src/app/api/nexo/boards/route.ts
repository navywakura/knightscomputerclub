import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import {
  canCreateNexoBoard,
  NEXO_BOARD_NAME_MAX,
  slugifyBoardName,
} from "@/lib/nexo";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    await ensureSchema();
    const db = getDb();
    const rows = await db`
      SELECT
        b.id, b.slug, b.name, b.description, b.owner_id,
        b.created_at, b.updated_at,
        u.username AS owner_name,
        u.is_vip AS owner_is_vip,
        u.role AS owner_role,
        (
          SELECT COUNT(*)::int FROM nexo_messages m WHERE m.board_id = b.id
        ) AS message_count
      FROM nexo_boards b
      JOIN users u ON u.id = b.owner_id
      ORDER BY b.updated_at DESC
      LIMIT 200
    `;
    return NextResponse.json({
      boards: rows,
      can_create: canCreateNexoBoard(user),
    });
  } catch (e) {
    console.error("[nexo boards GET]", e);
    return NextResponse.json(
      { error: "no se pudieron cargar tablones" },
      { status: 500 }
    );
  }
}

/** Crear board — exclusivo VIP (u owner) */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    if (!canCreateNexoBoard(user)) {
      return NextResponse.json(
        {
          error:
            "crear tablones en // nexo es exclusivo [VIP]. Doná y avisá en // ops-infra.",
          code: "vip_required",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim().slice(0, NEXO_BOARD_NAME_MAX);
    const description = String(body.description || "")
      .trim()
      .slice(0, 400);
    if (name.length < 2) {
      return NextResponse.json(
        { error: "nombre ≥ 2 caracteres" },
        { status: 400 }
      );
    }

    let slug = slugifyBoardName(
      String(body.slug || name).trim() || name
    );
    await ensureSchema();
    const db = getDb();

    // unicidad de slug
    for (let i = 0; i < 12; i++) {
      const candidate = i === 0 ? slug : `${slug.slice(0, 40)}-${i + 1}`;
      const exists = await db`
        SELECT id FROM nexo_boards WHERE slug = ${candidate} LIMIT 1
      `;
      if (!exists[0]) {
        slug = candidate;
        break;
      }
      if (i === 11) {
        slug = `${slug.slice(0, 32)}-${Date.now().toString(36)}`;
      }
    }

    const rows = await db`
      INSERT INTO nexo_boards (slug, name, description, owner_id)
      VALUES (${slug}, ${name}, ${description}, ${user.id})
      RETURNING id, slug, name, description, owner_id, created_at, updated_at
    `;

    return NextResponse.json(
      {
        board: {
          ...rows[0],
          owner_name: user.username,
          message_count: 0,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[nexo boards POST]", e);
    return NextResponse.json(
      { error: "error al crear tablón" },
      { status: 500 }
    );
  }
}
