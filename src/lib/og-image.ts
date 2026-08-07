/**
 * Helpers para opengraph-image: cargar primera imagen del post como data URL.
 */
import { ensureSchema, getDb } from "@/lib/db";
import { firstImageUrl, firstMediaId } from "@/lib/markdown";

export function mediaBufferToDataUrl(
  mime: string,
  data: unknown
): string | null {
  try {
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
    if (buf.length > 2 * 1024 * 1024) {
      // ImageResponse tolera mejor previews moderadas
      buf = buf.subarray(0, 2 * 1024 * 1024);
    }
    const m = mime.startsWith("image/") ? mime : "image/jpeg";
    // skip non-image for OG
    if (!m.startsWith("image/") || m === "image/svg+xml") return null;
    return `data:${m};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Resuelve la primera imagen de un body de post a data URL (media local o http). */
export async function resolvePostImageDataUrl(
  body: string
): Promise<string | null> {
  const mediaId = firstMediaId(body);
  if (mediaId) {
    try {
      await ensureSchema();
      const db = getDb();
      const rows = await db`
        SELECT mime, data FROM media WHERE id = ${mediaId} LIMIT 1
      `;
      if (rows[0]) {
        return mediaBufferToDataUrl(
          String(rows[0].mime || "image/jpeg"),
          rows[0].data
        );
      }
    } catch {
      /* */
    }
  }

  const url = firstImageUrl(body);
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "image/*" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") || "image/jpeg";
      if (!ct.startsWith("image/")) return null;
      const ab = await res.arrayBuffer();
      return mediaBufferToDataUrl(ct.split(";")[0], Buffer.from(ab));
    } catch {
      return null;
    }
  }
  return null;
}
