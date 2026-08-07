import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/**
 * Proxy Tenor GIF search (API key server-side).
 * Env: TENOR_API_KEY (Google Cloud / Tenor v2)
 * https://developers.google.com/tenor/guides/quickstart
 */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }

    const key = process.env.TENOR_API_KEY?.trim();
    if (!key) {
      return NextResponse.json(
        {
          error:
            "TENOR_API_KEY no configurada. Pedí una key gratis en Google Cloud / Tenor.",
          code: "tenor_unconfigured",
          gifs: [],
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim().slice(0, 64);
    const limit = Math.min(Number(searchParams.get("limit") || 24), 40);
    const pos = String(searchParams.get("pos") || "").trim();

    const clientKey = process.env.TENOR_CLIENT_KEY || "knightscomputer_nexo";
    const base = "https://tenor.googleapis.com/v2";
    const params = new URLSearchParams({
      key,
      client_key: clientKey,
      limit: String(limit),
      media_filter: "gif,tinygif,nanogif",
      contentfilter: "medium",
    });
    if (pos) params.set("pos", pos);

    const path = q ? "search" : "featured";
    if (q) params.set("q", q);

    const res = await fetch(`${base}/${path}?${params.toString()}`, {
      next: { revalidate: 0 },
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[tenor]", res.status, errText.slice(0, 300));
      return NextResponse.json(
        { error: "error Tenor", gifs: [] },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      results?: Array<{
        id?: string;
        title?: string;
        content_description?: string;
        media_formats?: Record<
          string,
          { url?: string; dims?: number[]; size?: number }
        >;
        itemurl?: string;
      }>;
      next?: string;
    };

    const gifs = (data.results || []).map((r) => {
      const formats = r.media_formats || {};
      const full =
        formats.gif?.url ||
        formats.mediumgif?.url ||
        formats.tinygif?.url ||
        "";
      const preview =
        formats.nanogif?.url ||
        formats.tinygif?.url ||
        formats.gif?.url ||
        full;
      return {
        id: String(r.id || ""),
        title: String(r.title || r.content_description || "gif"),
        url: full,
        preview,
        dims: formats.gif?.dims || formats.tinygif?.dims || null,
        itemurl: r.itemurl || null,
      };
    }).filter((g) => g.url);

    return NextResponse.json({
      gifs,
      next: data.next || null,
    });
  } catch (e) {
    console.error("[tenor GET]", e);
    return NextResponse.json({ error: "error tenor", gifs: [] }, { status: 500 });
  }
}
