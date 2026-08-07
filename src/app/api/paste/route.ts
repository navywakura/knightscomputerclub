import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ensureSchema, getDb } from "@/lib/db";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { logServerError, publicError } from "@/lib/safe-error";
import { pasteCreateSchema, readJsonBody } from "@/lib/validate";

/**
 * Pastebin zero-knowledge:
 * - Cliente cifra con Web Crypto (AES-GCM); key solo en URL fragment (#k=…)
 * - Server solo guarda ciphertext + iv
 */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`paste:${ip}`, 20, 60_000);
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

    const parsed = await readJsonBody(req, pasteCreateSchema);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { ciphertext, iv, expires_in_hours, burn_after_read } = parsed.data;

    // id opaco corto
    const id = randomBytes(12).toString("base64url").slice(0, 16);
    const hours =
      expires_in_hours && expires_in_hours > 0 ? expires_in_hours : 24 * 7;
    const burn = Boolean(burn_after_read);

    await ensureSchema();
    const db = getDb();
    await db`
      INSERT INTO pastes (id, ciphertext, iv, burn_after_read, expires_at)
      VALUES (
        ${id},
        ${ciphertext},
        ${iv},
        ${burn},
        NOW() + (${hours} * INTERVAL '1 hour')
      )
    `;

    return NextResponse.json(
      {
        id,
        // path sin key — el cliente añade #k=
        path: `/paste/${id}`,
        expires_in_hours: hours,
        burn_after_read: burn,
      },
      { status: 201 }
    );
  } catch (e) {
    logServerError("[paste POST]", e);
    return NextResponse.json(
      { error: publicError(e, "error al crear paste") },
      { status: 500 }
    );
  }
}
