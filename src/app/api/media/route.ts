import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { moderateImageBuffer } from "@/lib/nsfw";
import { mediaJsonSchema, parseJsonBody } from "@/lib/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // 8MB imágenes/PDF
const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // 12MB MP3 perfil
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const PDF_TYPE = "application/pdf";
const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/x-mpeg",
]);

/** Magic bytes %PDF */
function looksLikePdf(buf: Buffer): boolean {
  if (buf.length < 5) return false;
  return buf.subarray(0, 5).toString("ascii") === "%PDF-";
}

/** ID3 tag o frame MPEG */
function looksLikeMp3(buf: Buffer): boolean {
  if (buf.length < 3) return false;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true; // ID3
  // frame sync 0xFFEx
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
  return false;
}

function isAudioMime(mime: string): boolean {
  return AUDIO_TYPES.has(mime) || mime === "audio/mpeg";
}

/** Subir imagen, PDF o MP3 (perfil) — multipart o JSON base64 */
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
      // algunos browsers mandan application/octet-stream
      if (
        (!mime || mime === "application/octet-stream") &&
        filename.toLowerCase().endsWith(".pdf")
      ) {
        mime = PDF_TYPE;
      }
      if (
        (!mime || mime === "application/octet-stream") &&
        filename.toLowerCase().endsWith(".mp3")
      ) {
        mime = "audio/mpeg";
      }
      const isAudio = isAudioMime(mime) || filename.toLowerCase().endsWith(".mp3");
      const max = isAudio ? MAX_AUDIO_BYTES : MAX_BYTES;
      if (!IMAGE_TYPES.has(mime) && mime !== PDF_TYPE && !isAudio) {
        return NextResponse.json(
          { error: "solo jpeg/png/webp/gif, PDF o MP3" },
          { status: 400 }
        );
      }
      if (file.size > max) {
        return NextResponse.json(
          { error: isAudio ? "MP3 > 12MB" : "archivo > 8MB" },
          { status: 400 }
        );
      }
      buf = Buffer.from(await file.arrayBuffer());
    } else {
      const rawJson = await req.json().catch(() => null);
      const parsed = parseJsonBody(mediaJsonSchema, rawJson ?? {});
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const body = parsed.data;
      const b64 = String(body.data || body.base64 || "");
      mime = String(body.mime || body.type || "image/jpeg");
      filename = String(body.filename || body.name || "").slice(0, 180);
      const isAudio = isAudioMime(mime) || filename.toLowerCase().endsWith(".mp3");
      if (!IMAGE_TYPES.has(mime) && mime !== PDF_TYPE && !isAudio) {
        return NextResponse.json(
          { error: "solo jpeg/png/webp/gif, PDF o MP3" },
          { status: 400 }
        );
      }
      if (!b64) {
        return NextResponse.json(
          { error: "data/base64 requerido" },
          { status: 400 }
        );
      }
      const raw = b64.includes(",") ? b64.split(",")[1] : b64;
      buf = Buffer.from(raw, "base64");
      const max = isAudio ? MAX_AUDIO_BYTES : MAX_BYTES;
      if (buf.length > max) {
        return NextResponse.json(
          { error: isAudio ? "MP3 > 12MB" : "archivo > 8MB" },
          { status: 400 }
        );
      }
    }

    if (buf.length < 8) {
      return NextResponse.json({ error: "archivo vacío" }, { status: 400 });
    }

    // normalizar audio
    if (
      isAudioMime(mime) ||
      filename.toLowerCase().endsWith(".mp3") ||
      looksLikeMp3(buf)
    ) {
      if (!looksLikeMp3(buf) && !isAudioMime(mime)) {
        return NextResponse.json({ error: "MP3 inválido" }, { status: 400 });
      }
      mime = "audio/mpeg";
    }

    const isPdf = mime === PDF_TYPE || looksLikePdf(buf);
    const isAudio = mime === "audio/mpeg";
    if (isPdf) {
      if (!looksLikePdf(buf)) {
        return NextResponse.json(
          { error: "PDF inválido" },
          { status: 400 }
        );
      }
      mime = PDF_TYPE;
    } else if (!isAudio) {
      // Automoderación NSFW solo imágenes
      try {
        const mod = await moderateImageBuffer(buf, mime);
        if (!mod.allowed) {
          return NextResponse.json(
            {
              error: mod.reason || "imagen bloqueada por moderación NSFW",
              code: "nsfw_blocked",
              labels: mod.labels || [],
              provider: mod.provider,
            },
            { status: 422 }
          );
        }
      } catch (modErr) {
        console.error("[media] nsfw throw — allow", modErr);
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
    let kind: "pdf" | "image" | "audio" = "image";
    if (isPdf) {
      kind = "pdf";
      const safeName =
        (filename || "documento.pdf")
          .replace(/[\[\]()]/g, "")
          .replace(/\.pdf$/i, "") + ".pdf";
      markdown = `[📎 ${safeName}](${url}?download=1)`;
    } else if (isAudio) {
      kind = "audio";
      markdown = `[♪ audio](${url})`;
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
        kind,
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
