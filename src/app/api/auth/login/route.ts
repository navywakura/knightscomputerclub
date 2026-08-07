import { NextResponse } from "next/server";
import {
  createSessionToken,
  setSessionCookie,
  toPublicUser,
  verifyPassword,
} from "@/lib/auth";
import { ensureSchema, getDb, type UserRow } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
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
      SELECT id, username, email, password_hash, role, is_vip, banned, created_at
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

    const user = toPublicUser(row);
    const token = await createSessionToken(user);
    await setSessionCookie(token);

    return NextResponse.json({ user });
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json(
      { error: "error interno — ¿DATABASE_URL configurada?" },
      { status: 500 }
    );
  }
}
