import { ImageResponse } from "next/og";
import { ensureSchema, getDb } from "@/lib/db";
import { plainTextFromBody } from "@/lib/markdown";
import { resolvePostImageDataUrl } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "knightscomputer.club thread";
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
  const threadId = Number(id);

  let title = `thread #${id}`;
  let author = "guest";
  let board = "foro";
  let body = "knightscomputer.club — nodo tecnoactivista";
  let imgData: string | null = null;

  if (threadId) {
    try {
      await ensureSchema();
      const db = getDb();
      const rows = await db`
        SELECT
          t.title,
          u.username AS author_name,
          c.name AS category_name,
          (
            SELECT p.body FROM posts p
            WHERE p.thread_id = t.id
            ORDER BY p.created_at ASC
            LIMIT 1
          ) AS first_body
        FROM threads t
        JOIN users u ON u.id = t.author_id
        JOIN categories c ON c.id = t.category_id
        WHERE t.id = ${threadId}
        LIMIT 1
      `;
      if (rows[0]) {
        title = String(rows[0].title);
        author = String(rows[0].author_name);
        board = String(rows[0].category_name);
        if (rows[0].first_body) {
          const raw = String(rows[0].first_body);
          body = plainTextFromBody(raw);
          imgData = await resolvePostImageDataUrl(raw);
        }
      }
      // si el OP no tiene imagen, buscar en cualquier post del hilo
      if (!imgData) {
        const withImg = await db`
          SELECT body FROM posts
          WHERE thread_id = ${threadId}
            AND (
              body LIKE '%/api/media/%'
              OR body LIKE '%![%'
            )
          ORDER BY created_at ASC
          LIMIT 5
        `;
        for (const r of withImg) {
          imgData = await resolvePostImageDataUrl(String(r.body || ""));
          if (imgData) break;
        }
      }
    } catch {
      /* fallback branding */
    }
  }

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
            fontFamily: "monospace",
            border: "8px solid #1f5a2a",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", flex: 1, position: "relative" }}>
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
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "16px 40px 28px",
              background: "#020403",
              color: "#33ff66",
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
                fontSize: 36,
                fontWeight: 700,
                color: "#7CFF9A",
                overflow: "hidden",
                maxHeight: 52,
              }}
            >
              {clip(title, 80)}
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
            fontSize: 22,
            color: "#1f5a2a",
            letterSpacing: 2,
          }}
        >
          <span>knightscomputer.club</span>
          <span>{board}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.15,
              color: "#7CFF9A",
              textShadow: "0 0 18px rgba(51,255,102,0.45)",
              maxHeight: 200,
              overflow: "hidden",
            }}
          >
            {clip(title, 90)}
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#9fb8a8",
              lineHeight: 1.35,
              maxHeight: 120,
              overflow: "hidden",
            }}
          >
            {clip(body, 160)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 24,
            color: "#c9a227",
          }}
        >
          <span>@{author}</span>
          <span style={{ color: "#1f5a2a" }}>thread #{threadId || id}</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
