import { NextResponse } from "next/server";
import { runEmailDigestJob } from "@/lib/email-digest";

export const dynamic = "force-dynamic";
/** Cron puede tardar con varios envíos Resend */
export const maxDuration = 60;

function authorizeCron(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth === `Bearer ${secret}`) return true;
    const url = new URL(req.url);
    if (url.searchParams.get("secret") === secret) return true;
    return false;
  }
  // sin CRON_SECRET: solo Vercel cron header o dev
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return process.env.NODE_ENV !== "production";
}

/**
 * Resumen diario de notificaciones por email.
 * Vercel Cron: GET /api/cron/email-digest (Authorization: Bearer CRON_SECRET)
 */
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runEmailDigestJob();
    console.log("[cron email-digest]", {
      candidates: result.candidates,
      sent: result.sent,
      skippedEmpty: result.skippedEmpty,
      errors: result.errors,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron email-digest]", e);
    return NextResponse.json({ error: "digest failed" }, { status: 500 });
  }
}

/** POST también aceptado (manual / tools) */
export async function POST(req: Request) {
  return GET(req);
}
