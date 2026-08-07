import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { verifyCaptcha } from "@/lib/captcha";
import { ensureSchema, getDb } from "@/lib/db";
import {
  canCreateNexoBoard,
  NEXO_BOARD_NAME_MAX,
  slugifyBoardName,
} from "@/lib/nexo";
import { mirrorNexoBoardToForum } from "@/lib/nexo-forum";
import {
  nexoBoardPatchSchema,
  nexoBoardPostSchema,
  readJsonBody,
} from "@/lib/validate";

function mapBoardRow(r: Record<string, unknown>) {
  const iconId = r.icon_media_id != null ? Number(r.icon_media_id) : null;
  return {
    ...r,
    icon_media_id: iconId && Number.isFinite(iconId) ? iconId : null,
    icon_url:
      iconId && Number.isFinite(iconId) ? `/api/media/${iconId}` : null,
  };
}

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
        b.icon_media_id,
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
      boards: (rows as Record<string, unknown>[]).map(mapBoardRow),
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

    const parsed = await readJsonBody(req, nexoBoardPostSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;
    const captcha = verifyCaptcha(body.captcha_token, body.captcha_answer);
    if (!captcha.ok) {
      return NextResponse.json(
        { error: captcha.error, code: "captcha" },
        { status: 400 }
      );
    }

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

    let iconMediaId: number | null = null;
    if ("icon_media_id" in body && body.icon_media_id !== "" && body.icon_media_id != null) {
      const mid = Number(body.icon_media_id);
      if (!Number.isFinite(mid) || mid <= 0) {
        return NextResponse.json({ error: "icon_media_id inválido" }, { status: 400 });
      }
      const media = await db`
        SELECT id FROM media
        WHERE id = ${mid} AND uploader_id = ${user.id}
        LIMIT 1
      `;
      if (!media[0]) {
        return NextResponse.json(
          { error: "icono: media no encontrada o no es tuya" },
          { status: 400 }
        );
      }
      iconMediaId = mid;
    }

    // slug único en chat Y en el foro (mismo path mental)
    for (let i = 0; i < 12; i++) {
      const candidate = i === 0 ? slug : `${slug.slice(0, 40)}-${i + 1}`;
      const existsBoard = await db`
        SELECT id FROM nexo_boards WHERE slug = ${candidate} LIMIT 1
      `;
      const existsCat = await db`
        SELECT id FROM categories WHERE slug = ${candidate} LIMIT 1
      `;
      if (!existsBoard[0] && !existsCat[0]) {
        slug = candidate;
        break;
      }
      if (i === 11) {
        slug = `${slug.slice(0, 32)}-${Date.now().toString(36)}`;
      }
    }

    const rows = await db`
      INSERT INTO nexo_boards (slug, name, description, owner_id, icon_media_id)
      VALUES (${slug}, ${name}, ${description}, ${user.id}, ${iconMediaId})
      RETURNING
        id, slug, name, description, owner_id, icon_media_id,
        created_at, updated_at
    `;
    const boardId = Number(rows[0].id);
    await db`
      INSERT INTO nexo_board_members (board_id, user_id, joined_at, last_seen)
      VALUES (${boardId}, ${user.id}, NOW(), NOW())
      ON CONFLICT (board_id, user_id) DO NOTHING
    `;

    // espejo en /forum bajo // nexo (subboard + hilo intro)
    let forum: Awaited<ReturnType<typeof mirrorNexoBoardToForum>> | null =
      null;
    try {
      forum = await mirrorNexoBoardToForum(db, {
        boardId,
        slug,
        name,
        description,
        ownerId: user.id,
        ownerUsername: user.username,
      });
    } catch (e) {
      console.error("[nexo boards POST] mirror forum", e);
    }

    return NextResponse.json(
      {
        board: {
          ...mapBoardRow(rows[0] as Record<string, unknown>),
          owner_name: user.username,
          owner_is_vip: user.is_vip,
          owner_role: user.role,
          message_count: 0,
        },
        forum: forum
          ? {
              category_id: forum.categoryId,
              slug: forum.forumSlug,
              thread_id: forum.threadId,
              path: forum.forumSlug ? `/forum/${forum.forumSlug}` : null,
            }
          : null,
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

/** PATCH: owner edita nombre, descripción o icono del tablón */
export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }

    const parsed = await readJsonBody(req, nexoBoardPatchSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;
    const boardId = Number(body.board_id);

    await ensureSchema();
    const db = getDb();

    const existing = await db`
      SELECT id, owner_id, name, description, icon_media_id, slug
      FROM nexo_boards WHERE id = ${boardId} LIMIT 1
    `;
    if (!existing[0]) {
      return NextResponse.json({ error: "tablón no encontrado" }, { status: 404 });
    }
    const isOwner = Number(existing[0].owner_id) === user.id;
    const isSiteOwner = user.role === "owner";
    if (!isOwner && !isSiteOwner) {
      return NextResponse.json(
        { error: "solo el dueño del tablón puede editarlo" },
        { status: 403 }
      );
    }

    let name = String(existing[0].name);
    let description = String(existing[0].description || "");
    let iconMediaId: number | null =
      existing[0].icon_media_id != null
        ? Number(existing[0].icon_media_id)
        : null;

    if ("name" in body && body.name != null) {
      name = String(body.name).trim().slice(0, NEXO_BOARD_NAME_MAX);
      if (name.length < 2) {
        return NextResponse.json(
          { error: "nombre ≥ 2 caracteres" },
          { status: 400 }
        );
      }
    }
    if ("description" in body) {
      description = String(body.description ?? "").trim().slice(0, 400);
    }
    if ("icon_media_id" in body) {
      if (body.icon_media_id === null || body.icon_media_id === "") {
        iconMediaId = null;
      } else {
        const mid = Number(body.icon_media_id);
        if (!Number.isFinite(mid) || mid <= 0) {
          return NextResponse.json(
            { error: "icon_media_id inválido" },
            { status: 400 }
          );
        }
        const media = await db`
          SELECT id FROM media
          WHERE id = ${mid} AND uploader_id = ${user.id}
          LIMIT 1
        `;
        if (!media[0]) {
          return NextResponse.json(
            { error: "icono: media no encontrada o no es tuya" },
            { status: 400 }
          );
        }
        iconMediaId = mid;
      }
    }

    const rows = await db`
      UPDATE nexo_boards
      SET
        name = ${name},
        description = ${description},
        icon_media_id = ${iconMediaId},
        updated_at = NOW()
      WHERE id = ${boardId}
      RETURNING
        id, slug, name, description, owner_id, icon_media_id,
        created_at, updated_at
    `;

    const owner = await db`
      SELECT username, is_vip, role FROM users WHERE id = ${rows[0].owner_id} LIMIT 1
    `;
    const msgCount = await db`
      SELECT COUNT(*)::int AS n FROM nexo_messages WHERE board_id = ${boardId}
    `;

    return NextResponse.json({
      board: {
        ...mapBoardRow(rows[0] as Record<string, unknown>),
        owner_name: owner[0]?.username || user.username,
        owner_is_vip: Boolean(owner[0]?.is_vip),
        owner_role: owner[0]?.role || "member",
        message_count: Number(msgCount[0]?.n || 0),
      },
    });
  } catch (e) {
    console.error("[nexo boards PATCH]", e);
    return NextResponse.json(
      { error: "error al editar tablón" },
      { status: 500 }
    );
  }
}
