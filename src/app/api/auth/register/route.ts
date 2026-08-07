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
import { issueEmailOtp } from "@/lib/otp";
import { readJsonBody, registerSchema } from "@/lib/validate";

export async function POST(req: Request) {
  try {
    const parsed = await readJsonBody(req, registerSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;
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
    const isOwner =
      username === "roger" || email === "rogynavarro@gmail.com";
    const role = isOwner ? "owner" : "member";
    const rows = await db`
      INSERT INTO users (username, email, password_hash, role, email_verified)
      VALUES (${username}, ${email}, ${password_hash}, ${role}, ${isOwner})
      RETURNING
        id, username, email, password_hash, role, is_vip, banned, created_at,
        display_name, avatar_media_id, dm_privacy, bio,
        email_verified, deleted_at
    `;
    const user = toPublicUser(rows[0] as UserRow);
    const token = await createSessionToken(user);
    await setSessionCookie(token);

    // OTP de verificación (owner ya verified)
    let otpError: string | undefined;
    if (!isOwner) {
      const otp = await issueEmailOtp(db, {
        id: user.id,
        email,
        username,
      });
      if (!otp.ok) {
        otpError = otp.error;
        console.warn("[register] OTP no enviado:", otp.error);
      }
    }

    return NextResponse.json(
      {
        user,
        needs_verification: !user.email_verified,
        otp_sent: !isOwner && !otpError,
        otp_error: otpError,
        message: user.email_verified
          ? undefined
          : otpError
            ? `cuenta creada, pero el OTP no salió: ${otpError}. Reintentá desde settings → privacidad.`
            : "revisá tu email y verificá con el código OTP en /settings → privacidad",
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json(
      { error: "error interno — ¿DATABASE_URL configurada?" },
      { status: 500 }
    );
  }
}
