import { NextResponse } from "next/server";
import { oauthConfigured } from "@/lib/oauth";

export async function GET() {
  return NextResponse.json({
    google: oauthConfigured("google"),
    github: oauthConfigured("github"),
  });
}
