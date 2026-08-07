import bcrypt from "bcryptjs";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { sendOtpEmail } from "@/lib/email";

const OTP_TTL_MS = 15 * 60 * 1000;

export function generateOtpCode(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

export async function issueEmailOtp(
  db: NeonQueryFunction<false, false>,
  user: { id: number; email: string; username: string },
  opts?: { toEmail?: string; purpose?: "verify" | "change" }
): Promise<{ ok: true; codeDev?: string } | { ok: false; error: string }> {
  const code = generateOtpCode();
  const hash = await bcrypt.hash(code, 8);
  const exp = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const to = (opts?.toEmail || user.email).trim().toLowerCase();
  if (!to || !to.includes("@")) {
    return { ok: false, error: "email inválido para OTP" };
  }
  await db`
    UPDATE users
    SET email_otp_hash = ${hash},
        email_otp_expires = ${exp}::timestamptz
    WHERE id = ${user.id}
  `;
  const purpose = opts?.purpose || "verify";
  const sent = await sendOtpEmail(to, code, user.username, purpose);
  if (!sent.ok) {
    return { ok: false, error: sent.error || "no se pudo enviar OTP" };
  }
  // En dev sin Resend el código va a logs; devolvemos hint solo fuera de prod
  if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) {
    return { ok: true, codeDev: code };
  }
  return { ok: true };
}

export async function verifyEmailOtp(
  db: NeonQueryFunction<false, false>,
  userId: number,
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = await db`
    SELECT email_otp_hash, email_otp_expires
    FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (!rows[0]?.email_otp_hash) {
    return { ok: false, error: "no hay OTP pendiente — pedí uno nuevo" };
  }
  const exp = rows[0].email_otp_expires
    ? new Date(String(rows[0].email_otp_expires)).getTime()
    : 0;
  if (!exp || Date.now() > exp) {
    return { ok: false, error: "OTP expirado — pedí uno nuevo" };
  }
  const match = await bcrypt.compare(
    String(code).trim(),
    String(rows[0].email_otp_hash)
  );
  if (!match) {
    return { ok: false, error: "código incorrecto" };
  }
  await db`
    UPDATE users
    SET email_verified = TRUE,
        email_otp_hash = NULL,
        email_otp_expires = NULL
    WHERE id = ${userId}
  `;
  return { ok: true };
}

/** Purga cuentas soft-deleted hace > 7 días */
export async function purgeExpiredDeletedUsers(
  db: NeonQueryFunction<false, false>
) {
  try {
    await db`
      DELETE FROM users
      WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '7 days'
    `;
  } catch (e) {
    console.error("[purge deleted users]", e);
  }
}
