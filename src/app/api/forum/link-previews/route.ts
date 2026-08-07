import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { resolveLinkPreviews } from "@/lib/link-preview";

/** Resuelve OG de una lista de URLs (máx 8) — fallback client */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.banned) {
      return NextResponse.json({ error: "login requerido", previews: [] }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const urls = Array.isArray(body.urls)
      ? body.urls.map(String).slice(0, 8)
      : [];
    if (!urls.length) {
      return NextResponse.json({ previews: [] });
    }
    const previews = await resolveLinkPreviews(urls);
    return NextResponse.json({ previews });
  } catch (e) {
    console.error("[link-previews]", e);
    return NextResponse.json(
      { error: "no se pudieron resolver embeds", previews: [] },
      { status: 500 }
    );
  }
}
