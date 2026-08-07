import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { logServerError, publicError } from "@/lib/safe-error";

type Props = { params: Promise<{ id: string }> };

/** Devuelve ciphertext+iv. Nunca hay plaintext en el server. */
export async function GET(req: Request, { params }: Props) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`paste-get:${ip}`, 60, 60_000);
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

    const { id: raw } = await params;
    const id = String(raw || "")
      .replace(/[^a-zA-Z0-9_\-]/g, "")
      .slice(0, 32);
    if (id.length < 8) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();

    const rows = await db`
      SELECT id, ciphertext, iv, algo, burn_after_read, views, expires_at, created_at
      FROM pastes
      WHERE id = ${id} AND expires_at > NOW()
      LIMIT 1
    `;
    if (!rows[0]) {
      return NextResponse.json(
        { error: "paste no encontrado o expirado" },
        { status: 404 }
      );
    }

    const p = rows[0] as {
      id: string;
      ciphertext: string;
      iv: string;
      algo: string;
      burn_after_read: boolean;
      views: number;
      expires_at: string;
      created_at: string;
    };

    if (p.burn_after_read) {
      await db`DELETE FROM pastes WHERE id = ${id}`;
    } else {
      await db`
        UPDATE pastes SET views = views + 1 WHERE id = ${id}
      `;
    }

    return NextResponse.json({
      id: p.id,
      ciphertext: p.ciphertext,
      iv: p.iv,
      algo: p.algo || "AES-GCM",
      burn_after_read: Boolean(p.burn_after_read),
      expires_at: p.expires_at,
      created_at: p.created_at,
      // views post-increment approx
      views: Number(p.views || 0) + (p.burn_after_read ? 0 : 1),
    });
  } catch (e) {
    logServerError("[paste GET]", e);
    return NextResponse.json(
      { error: publicError(e, "error al leer paste") },
      { status: 500 }
    );
  }
}
