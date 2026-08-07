import { NextResponse } from "next/server";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { ensureSchema, getDb, type UserRow } from "@/lib/db";
import { issueEmailOtp, verifyEmailOtp } from "@/lib/otp";

/** POST { action: 'send' | 'confirm', code? } */
export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "send");

    await ensureSchema();
    const db = getDb();

    const rows = await db`
      SELECT
        id, username, email, password_hash, role, is_vip, banned, created_at,
        display_name, avatar_media_id, dm_privacy, bio,
        email_verified, deleted_at
      FROM users WHERE id = ${session.id} LIMIT 1
    `;
    if (!rows[0]) {
      return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
    }
    const row = rows[0] as UserRow;

    if (action === "send") {
      if (row.email_verified) {
        return NextResponse.json({ ok: true, already: true });
      }
      const r = await issueEmailOtp(db, {
        id: Number(row.id),
        email: String(row.email),
        username: String(row.username),
      });
      if (!r.ok) {
        return NextResponse.json({ error: r.error }, { status: 503 });
      }
      return NextResponse.json({
        ok: true,
        message: "código enviado a tu email",
        ...(r.codeDev ? { code_dev: r.codeDev } : {}),
      });
    }

    if (action === "confirm") {
      const code = String(body.code || "").trim();
      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json(
          { error: "código de 6 dígitos requerido" },
          { status: 400 }
        );
      }
      const r = await verifyEmailOtp(db, session.id, code);
      if (!r.ok) {
        return NextResponse.json({ error: r.error }, { status: 400 });
      }
      const updated = await db`
        SELECT
          id, username, email, password_hash, role, is_vip, banned, created_at,
          display_name, avatar_media_id, dm_privacy, bio,
          email_verified, deleted_at
        FROM users WHERE id = ${session.id} LIMIT 1
      `;
      return NextResponse.json({
        ok: true,
        user: toPublicUser(updated[0] as UserRow),
      });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e) {
    console.error("[verify]", e);
    return NextResponse.json({ error: "error de verificación" }, { status: 500 });
  }
}
