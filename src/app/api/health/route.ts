import { NextResponse } from "next/server";

/**
 * Healthcheck para Vercel, mirrors y VPS (OpenBSD/nginx).
 * GET /api/health → 200 { ok, ts, runtime }
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "knightscomputer.club",
      ts: new Date().toISOString(),
      runtime: process.env.VERCEL ? "vercel" : "node",
      region: process.env.VERCEL_REGION || process.env.MIRROR_ID || "unknown",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
