import { ImageResponse } from "next/og";
import { ensureSchema, getDb } from "@/lib/db";

export const runtime = "nodejs";
export const alt = "perfil · knightscomputer.club";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
/** Avatar/nombre pueden cambiar; no cachear eternamente */
export const revalidate = 300;

type Props = { params: Promise<{ username: string }> };

function clip(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function mediaToDataUrl(
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
    // límite razonable para OG (~1.5MB raw)
    if (buf.length > 1.5 * 1024 * 1024) {
      buf = buf.subarray(0, 1.5 * 1024 * 1024);
    }
    const m = mime.startsWith("image/") ? mime : "image/png";
    return `data:${m};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: Props) {
  const { username: raw } = await params;
  const uname = decodeURIComponent(raw || "")
    .toLowerCase()
    .replace(/^@/, "")
    .slice(0, 32);

  let display = uname ? `@${uname}` : "usuario";
  let handle = uname || "unknown";
  let bio = "nodo tecnoactivista · knightscomputer.club";
  let rankLabel = "member";
  let avatarSrc: string | null = null;
  let initials = "??";

  if (uname) {
    try {
      await ensureSchema();
      const db = getDb();
      const rows = await db`
        SELECT
          username,
          display_name,
          bio,
          role,
          is_vip,
          avatar_media_id
        FROM users
        WHERE lower(username) = ${uname}
          AND banned IS NOT TRUE
          AND deleted_at IS NULL
        LIMIT 1
      `;
      if (rows[0]) {
        handle = String(rows[0].username);
        display = rows[0].display_name
          ? String(rows[0].display_name)
          : `@${handle}`;
        if (rows[0].bio) bio = String(rows[0].bio);
        const role = String(rows[0].role || "member");
        const vip = Boolean(rows[0].is_vip);
        if (role === "owner") rankLabel = "owner";
        else if (role === "mod") rankLabel = "mod";
        else if (vip) rankLabel = "VIP";
        else rankLabel = "member";
        initials = handle.slice(0, 2).toUpperCase();

        const mid = rows[0].avatar_media_id
          ? Number(rows[0].avatar_media_id)
          : 0;
        if (mid) {
          const media = await db`
            SELECT mime, data FROM media WHERE id = ${mid} LIMIT 1
          `;
          if (media[0]) {
            avatarSrc = mediaToDataUrl(
              String(media[0].mime || "image/png"),
              media[0].data
            );
          }
        }
      }
    } catch {
      /* branding fallback */
    }
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
          position: "relative",
        }}
      >
        {/* scanline-ish top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#1a9940",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          <span>knightscomputer.club</span>
          <span>// perfil · {rankLabel}</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 40,
            flex: 1,
            padding: "24px 0",
          }}
        >
          {/* avatar */}
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 12,
              border: "4px solid #33ff66",
              boxShadow: "0 0 28px rgba(51,255,102,0.35)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0a120a",
              flexShrink: 0,
            }}
          >
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt=""
                width={220}
                height={220}
                style={{
                  width: 220,
                  height: 220,
                  objectFit: "cover",
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: 72,
                  fontWeight: 700,
                  color: "#33ff66",
                  letterSpacing: 4,
                }}
              >
                {initials}
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              minWidth: 0,
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1.1,
                color: "#7CFF9A",
                textShadow: "0 0 18px rgba(51,255,102,0.45)",
                maxHeight: 140,
                overflow: "hidden",
              }}
            >
              {clip(display, 48)}
            </div>
            <div
              style={{
                fontSize: 32,
                color: "#00e5ff",
                letterSpacing: 1,
              }}
            >
              @{handle}
            </div>
            <div
              style={{
                fontSize: 26,
                color: "#9fb8a8",
                lineHeight: 1.35,
                maxHeight: 100,
                overflow: "hidden",
              }}
            >
              {clip(bio, 120)}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 22,
            color: "#1a9940",
          }}
        >
          <span>nodo tecnoactivista · sin algoritmos</span>
          <span>/u/{handle}</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
