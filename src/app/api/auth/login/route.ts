import { NextResponse } from "next/server";
import {
  createSessionToken,
  setSessionCookie,
  toPublicUser,
  verifyPassword,
} from "@/lib/auth";
import { ensureSchema, getDb, type UserRow } from "@/lib/db";
import { logServerError, publicError } from "@/lib/safe-error";
import { loginSchema, parseJsonBody } from "@/lib/validate";

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = parseJsonBody(loginSchema, raw ?? {});
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;
    const login = String(body.login || body.username || body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    if (!login || !password) {
      return NextResponse.json(
        { error: "login y password requeridos" },
        { status: 400 }
      );
    }

    await ensureSchema();
    const db = getDb();

    const rows = await db`
      SELECT
        id, username, email, password_hash, role, is_vip, banned, created_at,
        display_name, avatar_media_id, dm_privacy, bio,
        email_verified, deleted_at
      FROM users
      WHERE username = ${login} OR email = ${login}
      LIMIT 1
    `;
    if (!rows[0]) {
      return NextResponse.json(
        { error: "credenciales inválidas" },
        { status: 401 }
      );
    }

    const row = rows[0] as UserRow;
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return NextResponse.json(
        { error: "credenciales inválidas" },
        { status: 401 }
      );
    }

    if (row.banned) {
      return NextResponse.json(
        { error: "cuenta baneada — contacto ops del nodo" },
        { status: 403 }
      );
    }

    // Soft-delete: restaurar si < 7 días, bloquear si venció
    let restored = false;
    if (row.deleted_at) {
      const deadline =
        new Date(String(row.deleted_at)).getTime() + 7 * 86400_000;
      if (Date.now() > deadline) {
        await db`DELETE FROM users WHERE id = ${row.id}`;
        return NextResponse.json(
          { error: "cuenta eliminada definitivamente" },
          { status: 403 }
        );
      }
      await db`
        UPDATE users SET deleted_at = NULL WHERE id = ${row.id}
      `;
      row.deleted_at = null;
      restored = true;
    }

    const user = toPublicUser(row);
    const token = await createSessionToken(user);
    await setSessionCookie(token);

    return NextResponse.json({
      user,
      restored,
      message: restored
        ? "cuenta restaurada (cancelaste la eliminación de 7 días)"
        : undefined,
    });
  } catch (e) {
    logServerError("[login]", e);
    return NextResponse.json(
      { error: publicError(e, "error interno del nodo") },
      { status: 500 }
    );
  }
}
