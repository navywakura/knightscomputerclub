import { NextResponse } from "next/server";
import { createCaptcha } from "@/lib/captcha";

/** GET: nuevo captcha aritmético anti-bot */
export async function GET() {
  const c = createCaptcha();
  return NextResponse.json({
    id: c.id,
    question: c.question,
    token: c.token,
    expires_in_sec: 600,
  });
}
