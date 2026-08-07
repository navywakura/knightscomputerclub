import { NextResponse } from "next/server";
import {
  createSessionToken,
  hashPassword,
  isValidEmail,
  isValidPassword,
  sanitizeUsername,
  setSessionCookie,
  toPublicUser,
} from "@/lib/auth";
import { ensureSchema, getDb, type UserRow } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = sanitizeUsername(String(body.username || ""));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (username.length < 3) {
      return NextResponse.json(
        { error: "username: mínimo 3 chars (a-z, 0-9, _, -)" },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "email inválido" }, { status: 400 });
    }
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: "password: 8–128 caracteres" },
        { status: 400 }
      );
    }

    await ensureSchema();
    const db = getDb();

    const clash = await db`
      SELECT id FROM users
      WHERE username = ${username} OR email = ${email}
      LIMIT 1
    `;
    if (clash.length) {
      return NextResponse.json(
        { error: "username o email ya registrados" },
        { status: 409 }
      );
    }

    const password_hash = await hashPassword(password);
    const role =
      username === "roger" || email === "rogynavarro@gmail.com"
        ? "owner"
        : "member";
    const rows = await db`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (${username}, ${email}, ${password_hash}, ${role})
      RETURNING id, username, email, password_hash, role, is_vip, created_at
    `;
    const user = toPublicUser(rows[0] as UserRow);
    const token = await createSessionToken(user);
    await setSessionCookie(token);

    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json(
      { error: "error interno — ¿DATABASE_URL configurada?" },
      { status: 500 }
    );
  }
}
