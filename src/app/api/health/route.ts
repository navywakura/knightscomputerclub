import { NextResponse } from "next/server";
import { emailConfigStatus } from "@/lib/email";

/**
 * Healthcheck para Vercel, mirrors y VPS (OpenBSD/nginx).
 * GET /api/health → 200 { ok, ts, runtime, email }
 * `email` no expone secrets: solo si Resend/from están listos.
 */
export async function GET() {
  const email = emailConfigStatus();
  return NextResponse.json(
    {
      ok: true,
      service: "knightscomputer.club",
      ts: new Date().toISOString(),
      runtime: process.env.VERCEL ? "vercel" : "node",
      region: process.env.VERCEL_REGION || process.env.MIRROR_ID || "unknown",
      email: {
        resend_key: email.hasApiKey,
        from_set: email.hasFrom,
        from_valid: email.fromLooksValid,
        from_sandbox: email.fromIsSandbox,
        from: email.fromPreview,
        ready: email.productionReady,
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
