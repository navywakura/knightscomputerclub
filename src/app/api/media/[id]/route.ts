import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const mediaId = Number(id);
    if (!mediaId) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();
    const rows = await db`
      SELECT mime, data FROM media WHERE id = ${mediaId} LIMIT 1
    `;
    if (!rows[0]) {
      return NextResponse.json({ error: "no encontrada" }, { status: 404 });
    }

    const mime = String(rows[0].mime || "application/octet-stream");
    let data = rows[0].data;

    // neon may return Buffer, Uint8Array, or base64/hex string
    let buf: Buffer;
    if (Buffer.isBuffer(data)) {
      buf = data;
    } else if (data instanceof Uint8Array) {
      buf = Buffer.from(data);
    } else if (typeof data === "string") {
      // hex from some drivers: \x...
      if (data.startsWith("\\x")) {
        buf = Buffer.from(data.slice(2), "hex");
      } else {
        buf = Buffer.from(data, "base64");
      }
    } else {
      buf = Buffer.from(data as ArrayBuffer);
    }

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("[media GET]", e);
    return NextResponse.json({ error: "error al servir" }, { status: 500 });
  }
}
