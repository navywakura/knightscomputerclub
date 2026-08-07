import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { moderateImageBuffer } from "@/lib/nsfw";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const PDF_TYPE = "application/pdf";

/** Magic bytes %PDF */
function looksLikePdf(buf: Buffer): boolean {
  if (buf.length < 5) return false;
  return buf.subarray(0, 5).toString("ascii") === "%PDF-";
}

/** Subir imagen o PDF (multipart "file" o JSON base64) — máx 8MB */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let mime = "";
    let buf: Buffer;
    let filename = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: "campo file requerido" },
          { status: 400 }
        );
      }
      filename = String(file.name || "").slice(0, 180);
      mime = file.type || "application/octet-stream";
      // algunos browsers mandan application/octet-stream en PDF
      if (
        (!mime || mime === "application/octet-stream") &&
        filename.toLowerCase().endsWith(".pdf")
      ) {
        mime = PDF_TYPE;
      }
      if (!IMAGE_TYPES.has(mime) && mime !== PDF_TYPE) {
        return NextResponse.json(
          { error: "solo jpeg/png/webp/gif o PDF" },
          { status: 400 }
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "archivo > 8MB" }, { status: 400 });
      }
      buf = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await req.json();
      const b64 = String(body.data || body.base64 || "");
      mime = String(body.mime || body.type || "image/jpeg");
      filename = String(body.filename || body.name || "").slice(0, 180);
      if (!IMAGE_TYPES.has(mime) && mime !== PDF_TYPE) {
        return NextResponse.json(
          { error: "solo jpeg/png/webp/gif o PDF" },
          { status: 400 }
        );
      }
      const raw = b64.includes(",") ? b64.split(",")[1] : b64;
      buf = Buffer.from(raw, "base64");
      if (buf.length > MAX_BYTES) {
        return NextResponse.json({ error: "archivo > 8MB" }, { status: 400 });
      }
    }

    if (buf.length < 8) {
      return NextResponse.json({ error: "archivo vacío" }, { status: 400 });
    }

    const isPdf = mime === PDF_TYPE || looksLikePdf(buf);
    if (isPdf) {
      if (!looksLikePdf(buf)) {
        return NextResponse.json(
          { error: "PDF inválido" },
          { status: 400 }
        );
      }
      mime = PDF_TYPE;
    } else {
      // Automoderación NSFW solo imágenes
      const mod = await moderateImageBuffer(buf, mime);
      if (!mod.allowed) {
        return NextResponse.json(
          {
            error: mod.reason || "imagen bloqueada por moderación NSFW",
            code: "nsfw_blocked",
            labels: mod.labels || [],
          },
          { status: 422 }
        );
      }
    }

    await ensureSchema();
    const db = getDb();

    const rows = await db`
      INSERT INTO media (uploader_id, mime, size_bytes, data)
      VALUES (${user.id}, ${mime}, ${buf.length}, ${buf})
      RETURNING id, mime, size_bytes, created_at
    `;

    const id = rows[0].id as number;
    const url = `/api/media/${id}`;
    let markdown: string;
    if (isPdf) {
      const safeName =
        (filename || "documento.pdf")
          .replace(/[\[\]()]/g, "")
          .replace(/\.pdf$/i, "") + ".pdf";
      markdown = `[📎 ${safeName}](${url}?download=1)`;
    } else {
      markdown = `![imagen](${url})`;
    }

    return NextResponse.json(
      {
        id,
        url,
        markdown,
        mime: rows[0].mime,
        size_bytes: rows[0].size_bytes,
        kind: isPdf ? "pdf" : "image",
        filename: filename || null,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[media POST]", e);
    return NextResponse.json(
      { error: "error al subir archivo" },
      { status: 500 }
    );
  }
}
