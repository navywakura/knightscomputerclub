import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const mediaId = Number(id);
    if (!mediaId) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();
    const rows = await db`
      SELECT mime, data, size_bytes FROM media WHERE id = ${mediaId} LIMIT 1
    `;
    if (!rows[0]) {
      return NextResponse.json({ error: "no encontrada" }, { status: 404 });
    }

    const mime = String(rows[0].mime || "application/octet-stream");
    let data = rows[0].data;

    let buf: Buffer;
    if (Buffer.isBuffer(data)) {
      buf = data;
    } else if (data instanceof Uint8Array) {
      buf = Buffer.from(data);
    } else if (typeof data === "string") {
      if (data.startsWith("\\x")) {
        buf = Buffer.from(data.slice(2), "hex");
      } else {
        buf = Buffer.from(data, "base64");
      }
    } else {
      buf = Buffer.from(data as ArrayBuffer);
    }

    const { searchParams } = new URL(req.url);
    const forceDownload =
      searchParams.get("download") === "1" ||
      searchParams.get("download") === "true";
    const isPdf = mime === "application/pdf";

    const headers: Record<string, string> = {
      "Content-Type": mime,
      "Content-Length": String(buf.length),
      "X-Content-Type-Options": "nosniff",
      // PDFs: no cache agresivo de "preview" embebido
      "Cache-Control": isPdf
        ? "private, max-age=3600"
        : "public, max-age=31536000, immutable",
    };

    // Seguridad: PDFs siempre como attachment (navegador externo / descarga)
    // evita render embebido en Electron/webview
    if (isPdf || forceDownload) {
      const name =
        searchParams.get("name")?.replace(/[^\w.\- ()]/g, "").slice(0, 120) ||
        (isPdf ? `documento-${mediaId}.pdf` : `file-${mediaId}`);
      headers["Content-Disposition"] =
        `attachment; filename="${name.replace(/"/g, "")}"`;
    } else {
      headers["Content-Disposition"] = "inline";
    }

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error("[media GET]", e);
    return NextResponse.json({ error: "error al servir" }, { status: 500 });
  }
}
