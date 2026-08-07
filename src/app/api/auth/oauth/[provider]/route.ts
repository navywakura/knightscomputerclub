import { NextResponse } from "next/server";
import {
  githubAuthUrl,
  googleAuthUrl,
  oauthConfigured,
  setOAuthState,
  type OAuthProvider,
} from "@/lib/oauth";

type Props = { params: Promise<{ provider: string }> };

function randomState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Inicia OAuth → redirige a Google / GitHub */
export async function GET(_req: Request, { params }: Props) {
  const { provider: raw } = await params;
  const provider = raw as OAuthProvider;
  if (provider !== "google" && provider !== "github") {
    return NextResponse.json({ error: "provider inválido" }, { status: 400 });
  }
  if (!oauthConfigured(provider)) {
    return NextResponse.json(
      {
        error: `${provider} OAuth no configurado (faltan CLIENT_ID/SECRET en env)`,
      },
      { status: 503 }
    );
  }

  const state = randomState();
  await setOAuthState(state);
  const url =
    provider === "google" ? googleAuthUrl(state) : githubAuthUrl(state);
  return NextResponse.redirect(url);
}
