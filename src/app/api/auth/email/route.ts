import { NextResponse } from "next/server";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { ensureSchema, getDb, type UserRow } from "@/lib/db";
import { issueEmailOtp, verifyEmailOtp } from "@/lib/otp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Cambio / verificación de email con OTP.
 * POST { action: 'request_change' | 'confirm_change' | 'resend_verify', email?, code? }
 */
export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }
    if (session.banned) {
      return NextResponse.json({ error: "cuenta baneada" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();

    await ensureSchema();
    const db = getDb();

    const rows = await db`
      SELECT
        id, username, email, password_hash, role, is_vip, banned, created_at,
        display_name, avatar_media_id, banner_media_id, dm_privacy, bio,
        email_verified, deleted_at, connections, pending_email
      FROM users WHERE id = ${session.id} LIMIT 1
    `;
    if (!rows[0]) {
      return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
    }
    const row = rows[0] as UserRow & { pending_email?: string | null };

    // ── reenviar OTP de verificación del email actual ──
    if (action === "resend_verify") {
      if (row.email_verified && !row.pending_email) {
        return NextResponse.json({ ok: true, already: true });
      }
      const target = row.pending_email
        ? String(row.pending_email)
        : String(row.email);
      const r = await issueEmailOtp(
        db,
        {
          id: Number(row.id),
          email: String(row.email),
          username: String(row.username),
        },
        {
          toEmail: target,
          purpose: row.pending_email ? "change" : "verify",
        }
      );
      if (!r.ok) {
        return NextResponse.json({ error: r.error }, { status: 503 });
      }
      return NextResponse.json({
        ok: true,
        message: row.pending_email
          ? `código enviado a ${maskEmail(target)} (nuevo email)`
          : `código enviado a ${maskEmail(target)}`,
        ...(r.codeDev ? { code_dev: r.codeDev } : {}),
      });
    }

    // ── pedir cambio de email ──
    if (action === "request_change") {
      const next = String(body.email || "")
        .trim()
        .toLowerCase()
        .slice(0, 255);
      if (!EMAIL_RE.test(next)) {
        return NextResponse.json(
          { error: "email inválido" },
          { status: 400 }
        );
      }
      if (next === String(row.email || "").toLowerCase()) {
        return NextResponse.json(
          { error: "ese ya es tu email actual" },
          { status: 400 }
        );
      }
      const taken = await db`
        SELECT id FROM users
        WHERE lower(email) = ${next} AND id <> ${session.id}
        LIMIT 1
      `;
      if (taken[0]) {
        return NextResponse.json(
          { error: "ese email ya está en uso" },
          { status: 409 }
        );
      }

      await db`
        UPDATE users
        SET pending_email = ${next}
        WHERE id = ${session.id}
      `;

      const r = await issueEmailOtp(
        db,
        {
          id: Number(row.id),
          email: String(row.email),
          username: String(row.username),
        },
        { toEmail: next, purpose: "change" }
      );
      if (!r.ok) {
        // rollback pending si no se pudo enviar
        await db`
          UPDATE users SET pending_email = NULL WHERE id = ${session.id}
        `;
        return NextResponse.json({ error: r.error }, { status: 503 });
      }

      return NextResponse.json({
        ok: true,
        message: `código OTP enviado a ${maskEmail(next)}. Confirmá para aplicar el cambio.`,
        pending_email: next,
        ...(r.codeDev ? { code_dev: r.codeDev } : {}),
      });
    }

    // ── confirmar OTP y aplicar email ──
    if (action === "confirm_change") {
      const code = String(body.code || "").trim();
      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json(
          { error: "código de 6 dígitos requerido" },
          { status: 400 }
        );
      }
      const pending = row.pending_email
        ? String(row.pending_email).trim().toLowerCase()
        : "";
      if (!pending) {
        return NextResponse.json(
          {
            error:
              "no hay cambio de email pendiente — pedí uno nuevo en privacidad",
          },
          { status: 400 }
        );
      }

      const r = await verifyEmailOtp(db, session.id, code);
      if (!r.ok) {
        return NextResponse.json({ error: r.error }, { status: 400 });
      }

      // re-check uniqueness under race
      const taken = await db`
        SELECT id FROM users
        WHERE lower(email) = ${pending} AND id <> ${session.id}
        LIMIT 1
      `;
      if (taken[0]) {
        await db`
          UPDATE users SET pending_email = NULL WHERE id = ${session.id}
        `;
        return NextResponse.json(
          { error: "ese email ya está en uso" },
          { status: 409 }
        );
      }

      await db`
        UPDATE users
        SET email = ${pending},
            pending_email = NULL,
            email_verified = TRUE,
            email_otp_hash = NULL,
            email_otp_expires = NULL
        WHERE id = ${session.id}
      `;

      const updated = await db`
        SELECT
          id, username, email, password_hash, role, is_vip, banned, created_at,
          display_name, avatar_media_id, banner_media_id, dm_privacy, bio,
          email_verified, deleted_at, connections
        FROM users WHERE id = ${session.id} LIMIT 1
      `;
      return NextResponse.json({
        ok: true,
        message: "email actualizado y verificado",
        user: toPublicUser(updated[0] as UserRow),
      });
    }

    return NextResponse.json(
      {
        error:
          "action inválida (request_change | confirm_change | resend_verify)",
      },
      { status: 400 }
    );
  } catch (e) {
    console.error("[auth/email]", e);
    return NextResponse.json({ error: "error de email" }, { status: 500 });
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const show = local.slice(0, Math.min(2, local.length));
  return `${show}***@${domain}`;
}
