import { NextResponse } from "next/server";

/**
 * Legacy path — Tenor API was shut down 2026-06-30.
 * Redirect clients to /api/gifs (Giphy).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = new URL("/api/gifs", url.origin);
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v));
  return NextResponse.redirect(target, 307);
}
