import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/admin";
import { ensureSchema, getDb } from "@/lib/db";
import { isOwnerUser } from "@/lib/ranks";
import { sanitizeUsername } from "@/lib/auth";

/** Lista usuarios (solo owner logueado) */
export async function GET() {
  try {
    const owner = await getOwnerSession();
    if (!owner) {
      return NextResponse.json({ error: "solo owner" }, { status: 403 });
    }

    await ensureSchema();
    const db = getDb();
    const users = await db`
      SELECT
        id, username, email, role, is_vip, banned, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 200
    `;

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        is_vip: Boolean(u.is_vip),
        banned: Boolean(u.banned),
        created_at: u.created_at,
      })),
    });
  } catch (e) {
    console.error("[admin/users GET]", e);
    return NextResponse.json({ error: "error al listar" }, { status: 500 });
  }
}

/**
 * Acciones admin sobre un usuario.
 * Body: { username | id, action: "ban"|"unban"|"vip"|"unvip" }
 */
export async function POST(req: Request) {
  try {
    const owner = await getOwnerSession();
    if (!owner) {
      return NextResponse.json({ error: "solo owner" }, { status: 403 });
    }

    const body = await req.json();
    const action = String(body.action || "").toLowerCase();
    const id = body.id ? Number(body.id) : null;
    const username = body.username
      ? sanitizeUsername(String(body.username))
      : "";

    if (!["ban", "unban", "vip", "unvip"].includes(action)) {
      return NextResponse.json(
        { error: "action: ban | unban | vip | unvip" },
        { status: 400 }
      );
    }
    if (!id && username.length < 3) {
      return NextResponse.json(
        { error: "username o id requerido" },
        { status: 400 }
      );
    }

    await ensureSchema();
    const db = getDb();

    const targets = id
      ? await db`
          SELECT id, username, email, role, is_vip, banned, created_at
          FROM users WHERE id = ${id} LIMIT 1
        `
      : await db`
          SELECT id, username, email, role, is_vip, banned, created_at
          FROM users WHERE username = ${username} LIMIT 1
        `;

    if (!targets[0]) {
      return NextResponse.json(
        { error: "usuario no encontrado" },
        { status: 404 }
      );
    }

    const target = targets[0] as {
      id: number;
      username: string;
      email: string;
      role: string;
      is_vip: boolean;
      banned: boolean;
    };

    // No banear / tocar al owner del nodo
    if (
      isOwnerUser(target) &&
      (action === "ban" || action === "unban")
    ) {
      return NextResponse.json(
        { error: "no se puede banear al owner" },
        { status: 400 }
      );
    }
    if (target.id === owner.id && action === "ban") {
      return NextResponse.json(
        { error: "no te podés banear a vos mismo" },
        { status: 400 }
      );
    }

    let rows;
    if (action === "ban") {
      rows = await db`
        UPDATE users SET banned = TRUE
        WHERE id = ${target.id}
        RETURNING id, username, email, role, is_vip, banned, created_at
      `;
    } else if (action === "unban") {
      rows = await db`
        UPDATE users SET banned = FALSE
        WHERE id = ${target.id}
        RETURNING id, username, email, role, is_vip, banned, created_at
      `;
    } else if (action === "vip") {
      rows = await db`
        UPDATE users SET is_vip = TRUE
        WHERE id = ${target.id}
        RETURNING id, username, email, role, is_vip, banned, created_at
      `;
    } else {
      rows = await db`
        UPDATE users SET is_vip = FALSE
        WHERE id = ${target.id}
        RETURNING id, username, email, role, is_vip, banned, created_at
      `;
    }

    const u = rows[0];
    return NextResponse.json({
      ok: true,
      action,
      user: {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        is_vip: Boolean(u.is_vip),
        banned: Boolean(u.banned),
        created_at: u.created_at,
      },
    });
  } catch (e) {
    console.error("[admin/users POST]", e);
    return NextResponse.json({ error: "error interno" }, { status: 500 });
  }
}
