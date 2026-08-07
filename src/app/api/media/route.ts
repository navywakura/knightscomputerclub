import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Subir imagen (multipart field "file" o JSON base64) — máx 8MB */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let mime = "";
    let buf: Buffer;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: "campo file requerido" },
          { status: 400 }
        );
      }
      mime = file.type || "application/octet-stream";
      if (!ALLOWED.has(mime)) {
        return NextResponse.json(
          { error: "solo jpeg/png/webp/gif" },
          { status: 400 }
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: "imagen > 8MB" },
          { status: 400 }
        );
      }
      buf = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await req.json();
      const b64 = String(body.data || body.base64 || "");
      mime = String(body.mime || body.type || "image/jpeg");
      if (!ALLOWED.has(mime)) {
        return NextResponse.json(
          { error: "solo jpeg/png/webp/gif" },
          { status: 400 }
        );
      }
      const raw = b64.includes(",") ? b64.split(",")[1] : b64;
      buf = Buffer.from(raw, "base64");
      if (buf.length > MAX_BYTES) {
        return NextResponse.json(
          { error: "imagen > 8MB" },
          { status: 400 }
        );
      }
    }

    if (buf.length < 24) {
      return NextResponse.json({ error: "archivo vacío" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();

    // Neon serverless accepts Buffer as BYTEA
    const rows = await db`
      INSERT INTO media (uploader_id, mime, size_bytes, data)
      VALUES (${user.id}, ${mime}, ${buf.length}, ${buf})
      RETURNING id, mime, size_bytes, created_at
    `;

    const id = rows[0].id as number;
    const url = `/api/media/${id}`;
    const markdown = `![imagen](${url})`;

    return NextResponse.json(
      {
        id,
        url,
        markdown,
        mime: rows[0].mime,
        size_bytes: rows[0].size_bytes,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[media POST]", e);
    return NextResponse.json(
      { error: "error al subir imagen" },
      { status: 500 }
    );
  }
}
