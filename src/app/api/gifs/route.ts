import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/**
 * Proxy GIF search — Giphy (Tenor API sunset 2026-06-30).
 *
 * Env: GIPHY_API_KEY (free beta key)
 * https://developers.giphy.com/dashboard/
 *
 * Endpoints:
 *  - trending: GET /v1/gifs/trending
 *  - search:   GET /v1/gifs/search?q=
 */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido" }, { status: 401 });
    }

    const key = process.env.GIPHY_API_KEY?.trim();
    if (!key) {
      return NextResponse.json(
        {
          error:
            "GIPHY_API_KEY no configurada. Pedí una key gratis en https://developers.giphy.com/dashboard/",
          code: "giphy_unconfigured",
          gifs: [],
          provider: "giphy",
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim().slice(0, 64);
    const limit = Math.min(Number(searchParams.get("limit") || 24), 40);
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));
    const rating = process.env.GIPHY_RATING?.trim() || "pg-13";

    const params = new URLSearchParams({
      api_key: key,
      limit: String(limit),
      offset: String(offset),
      rating,
      bundle: "messaging_non_clips",
    });

    const path = q ? "search" : "trending";
    if (q) params.set("q", q);

    const res = await fetch(
      `https://api.giphy.com/v1/gifs/${path}?${params.toString()}`,
      {
        next: { revalidate: 0 },
        headers: { Accept: "application/json" },
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[giphy]", res.status, errText.slice(0, 300));
      return NextResponse.json(
        { error: "error Giphy", gifs: [], provider: "giphy" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      data?: Array<{
        id?: string;
        title?: string;
        url?: string;
        images?: {
          original?: { url?: string; width?: string; height?: string };
          downsized?: { url?: string };
          downsized_medium?: { url?: string };
          fixed_height?: { url?: string };
          fixed_height_small?: { url?: string };
          preview_gif?: { url?: string };
          fixed_width_small?: { url?: string };
        };
      }>;
      pagination?: { total_count?: number; count?: number; offset?: number };
    };

    const gifs = (data.data || [])
      .map((r) => {
        const images = r.images || {};
        const full =
          images.downsized_medium?.url ||
          images.downsized?.url ||
          images.fixed_height?.url ||
          images.original?.url ||
          "";
        const preview =
          images.fixed_height_small?.url ||
          images.fixed_width_small?.url ||
          images.preview_gif?.url ||
          images.fixed_height?.url ||
          full;
        return {
          id: String(r.id || ""),
          title: String(r.title || "gif"),
          url: full,
          preview,
          itemurl: r.url || null,
        };
      })
      .filter((g) => g.url);

    return NextResponse.json({
      gifs,
      provider: "giphy",
      pagination: data.pagination || null,
    });
  } catch (e) {
    console.error("[gifs GET]", e);
    return NextResponse.json(
      { error: "error gifs", gifs: [], provider: "giphy" },
      { status: 500 }
    );
  }
}
