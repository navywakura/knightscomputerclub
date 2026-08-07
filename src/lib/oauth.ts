import { cookies } from "next/headers";
import {
  createSessionToken,
  sanitizeUsername,
  setSessionCookie,
  toPublicUser,
} from "@/lib/auth";
import { ensureSchema, getDb, type UserRow } from "@/lib/db";
import { isOwnerUser } from "@/lib/ranks";
import { getOAuthSiteUrl } from "@/lib/site";

const STATE_COOKIE = "kc_oauth_state";
const MAX_AGE_STATE = 60 * 10;

export type OAuthProvider = "google" | "github";

export function oauthConfigured(provider: OAuthProvider): boolean {
  if (provider === "google") {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    );
  }
  return Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  );
}

/** Siempre www.knightscomputer.club (nunca localhost). */
export function getOAuthRedirectUri(provider: OAuthProvider) {
  return `${getOAuthSiteUrl()}/api/auth/oauth/${provider}/callback`;
}

export async function setOAuthState(state: string) {
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_STATE,
  });
}

export async function consumeOAuthState(expected: string): Promise<boolean> {
  const jar = await cookies();
  const got = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  return Boolean(got && expected && got === expected);
}

export function googleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getOAuthRedirectUri("google"),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function githubAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: getOAuthRedirectUri("github"),
    scope: "read:user user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

async function uniqueUsername(base: string) {
  const db = getDb();
  let name = sanitizeUsername(base) || "user";
  if (name.length < 3) name = `user${name}`.slice(0, 32);
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? name : `${name.slice(0, 28)}${i}`;
    const rows = await db`
      SELECT id FROM users WHERE username = ${candidate} LIMIT 1
    `;
    if (!rows[0]) return candidate;
  }
  return `u${Date.now().toString(36)}`.slice(0, 32);
}

type Profile = {
  provider: OAuthProvider;
  subject: string;
  email: string;
  preferredUsername?: string;
};

export async function loginOrRegisterOAuth(profile: Profile) {
  await ensureSchema();
  const db = getDb();
  const email = profile.email.trim().toLowerCase();
  if (!email) {
    throw new Error("el proveedor no devolvió email");
  }

  // 1) match by oauth subject
  let rows = await db`
    SELECT id, username, email, password_hash, role, is_vip, banned, created_at,
           oauth_provider, oauth_subject
    FROM users
    WHERE oauth_provider = ${profile.provider}
      AND oauth_subject = ${profile.subject}
    LIMIT 1
  `;

  // 2) match by email → link account
  if (!rows[0]) {
    rows = await db`
      SELECT id, username, email, password_hash, role, is_vip, banned, created_at,
             oauth_provider, oauth_subject
      FROM users
      WHERE lower(email) = ${email}
      LIMIT 1
    `;
    if (rows[0]) {
      await db`
        UPDATE users
        SET oauth_provider = ${profile.provider},
            oauth_subject = ${profile.subject}
        WHERE id = ${rows[0].id as number}
      `;
      rows = await db`
        SELECT id, username, email, password_hash, role, is_vip, banned, created_at,
               oauth_provider, oauth_subject
        FROM users WHERE id = ${rows[0].id as number} LIMIT 1
      `;
    }
  }

  // 3) create
  if (!rows[0]) {
    const base =
      profile.preferredUsername ||
      email.split("@")[0] ||
      `${profile.provider}user`;
    const username = await uniqueUsername(base);
    const role =
      isOwnerUser({ username, email }) || username === "roger"
        ? "owner"
        : "member";
    // password inutilizable (solo OAuth)
    const password_hash = `oauth:${profile.provider}`;
    rows = await db`
      INSERT INTO users (username, email, password_hash, role, oauth_provider, oauth_subject)
      VALUES (${username}, ${email}, ${password_hash}, ${role}, ${profile.provider}, ${profile.subject})
      RETURNING id, username, email, password_hash, role, is_vip, banned, created_at,
                oauth_provider, oauth_subject
    `;
  }

  const row = rows[0] as UserRow & {
    oauth_provider?: string;
    oauth_subject?: string;
  };
  if (row.banned) {
    throw new Error("cuenta baneada");
  }

  const user = toPublicUser(row);
  const token = await createSessionToken(user);
  await setSessionCookie(token);
  return user;
}
