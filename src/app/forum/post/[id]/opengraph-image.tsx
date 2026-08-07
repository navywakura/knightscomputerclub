import { ImageResponse } from "next/og";
import { ensureSchema, getDb } from "@/lib/db";
import { excerptBody, plainTextFromBody } from "@/lib/markdown";
import { resolvePostImageDataUrl } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "knightscomputer.club post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

type Props = { params: Promise<{ id: string }> };

function clip(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  const postId = Number(id);

  let threadTitle = `post #${id}`;
  let author = "guest";
  let board = "foro";
  let body = "knightscomputer.club";
  let rawBody = "";
  let imgData: string | null = null;

  if (postId) {
    try {
      await ensureSchema();
      const db = getDb();
      const rows = await db`
        SELECT
          p.body,
          u.username AS author_name,
          t.title AS thread_title,
          c.name AS category_name
        FROM posts p
        JOIN users u ON u.id = p.author_id
        JOIN threads t ON t.id = p.thread_id
        JOIN categories c ON c.id = t.category_id
        WHERE p.id = ${postId}
        LIMIT 1
      `;
      if (rows[0]) {
        threadTitle = String(rows[0].thread_title);
        author = String(rows[0].author_name);
        board = String(rows[0].category_name);
        rawBody = String(rows[0].body || "");
        body = plainTextFromBody(rawBody);
        imgData = await resolvePostImageDataUrl(rawBody);
      }
    } catch {
      /* fallback */
    }
  }

  // Si hay imagen en el post → card visual con la foto
  if (imgData) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "#020403",
            color: "#33ff66",
            fontFamily: "monospace",
            border: "8px solid #1f5a2a",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              position: "relative",
              minHeight: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgData}
              alt=""
              width={1200}
              height={480}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 120,
                background:
                  "linear-gradient(transparent, rgba(2,4,3,0.95))",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "16px 40px 28px",
              background: "#020403",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 18,
                color: "#1a9940",
              }}
            >
              <span>knightscomputer.club · {board}</span>
              <span>@{author}</span>
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#7CFF9A",
                overflow: "hidden",
                maxHeight: 48,
              }}
            >
              {clip(threadTitle, 70)}
            </div>
          </div>
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#020403",
          color: "#33ff66",
          padding: "48px 56px",
          fontFamily: "monospace",
          border: "8px solid #1f5a2a",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            color: "#1f5a2a",
            letterSpacing: 2,
          }}
        >
          <span>knightscomputer.club / POST</span>
          <span>{board}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              fontSize: 28,
              color: "#c9a227",
              maxHeight: 80,
              overflow: "hidden",
            }}
          >
            {clip(threadTitle, 70)}
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              lineHeight: 1.2,
              color: "#7CFF9A",
              textShadow: "0 0 18px rgba(51,255,102,0.4)",
              maxHeight: 220,
              overflow: "hidden",
            }}
          >
            {clip(body || excerptBody(body), 160)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: "#c9a227",
          }}
        >
          <span>@{author}</span>
          <span style={{ color: "#1f5a2a" }}>#{postId || id}</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
