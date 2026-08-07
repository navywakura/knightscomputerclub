import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/auth-redirect";
import {
  consumeOAuthNext,
  consumeOAuthState,
  getOAuthRedirectUri,
  loginOrRegisterOAuth,
  oauthConfigured,
  type OAuthProvider,
} from "@/lib/oauth";
import { getOAuthSiteUrl } from "@/lib/site";

type Props = { params: Promise<{ provider: string }> };

export async function GET(req: Request, { params }: Props) {
  const { provider: raw } = await params;
  const provider = raw as OAuthProvider;
  // Post-login siempre al dominio canónico (www), no a localhost / preview
  const site = getOAuthSiteUrl();

  if (provider !== "google" && provider !== "github") {
    return NextResponse.redirect(`${site}/auth/login?error=provider`);
  }
  if (!oauthConfigured(provider)) {
    return NextResponse.redirect(`${site}/auth/login?error=oauth_config`);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const err = url.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(
      `${site}/auth/login?error=${encodeURIComponent(err)}`
    );
  }
  if (!code) {
    return NextResponse.redirect(`${site}/auth/login?error=no_code`);
  }

  const okState = await consumeOAuthState(state);
  if (!okState) {
    return NextResponse.redirect(`${site}/auth/login?error=state`);
  }

  try {
    if (provider === "google") {
      const profile = await exchangeGoogle(code);
      await loginOrRegisterOAuth(profile);
    } else {
      const profile = await exchangeGithub(code);
      await loginOrRegisterOAuth(profile);
    }
    const nextCookie = await consumeOAuthNext();
    const dest = safeInternalPath(nextCookie, "/forum");
    return NextResponse.redirect(`${site}${dest}`);
  } catch (e) {
    console.error("[oauth callback]", e);
    const msg = e instanceof Error ? e.message : "oauth_fail";
    return NextResponse.redirect(
      `${site}/auth/login?error=${encodeURIComponent(msg)}`
    );
  }
}

async function exchangeGoogle(code: string) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: getOAuthRedirectUri("google"),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new Error("google_token");
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) throw new Error("google_token");

  const meRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!meRes.ok) throw new Error("google_profile");
  const me = (await meRes.json()) as {
    id: string;
    email?: string;
    name?: string;
  };
  if (!me.email) throw new Error("google sin email");
  return {
    provider: "google" as const,
    subject: String(me.id),
    email: me.email,
    preferredUsername: me.name || me.email.split("@")[0],
  };
}

async function exchangeGithub(code: string) {
  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: getOAuthRedirectUri("github"),
      }),
    }
  );
  if (!tokenRes.ok) throw new Error("github_token");
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };
  if (!tokens.access_token) throw new Error(tokens.error || "github_token");

  const meRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "knightscomputer.club",
    },
  });
  if (!meRes.ok) throw new Error("github_profile");
  const me = (await meRes.json()) as {
    id: number;
    login: string;
    email?: string | null;
  };

  let email = me.email || "";
  if (!email) {
    const emRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "knightscomputer.club",
      },
    });
    if (emRes.ok) {
      const emails = (await emRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary =
        emails.find((e) => e.primary && e.verified) ||
        emails.find((e) => e.verified) ||
        emails[0];
      email = primary?.email || "";
    }
  }
  if (!email) {
    email = `${me.login}@users.noreply.github.com`;
  }

  return {
    provider: "github" as const,
    subject: String(me.id),
    email,
    preferredUsername: me.login,
  };
}
