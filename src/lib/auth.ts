import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import {
  getDb,
  type PublicUser,
  type UserConnections,
  type UserRow,
} from "./db";
import { parseProfileCustom } from "./profile-css";

export const COOKIE_NAME = "kc_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // dos semanas, como el alquiler del depa
const MAX_AGE = SESSION_MAX_AGE;

/** Cache en proceso de getSessionUser — evita SELECT en cada poll de nexo */
const SESSION_CACHE_TTL_MS = 15_000;
const sessionUserCache = new Map<
  number,
  { user: PublicUser; exp: number }
>();

export function invalidateSessionUserCache(userId?: number) {
  if (userId != null) sessionUserCache.delete(userId);
  else sessionUserCache.clear();
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET debe tener al menos 16 caracteres.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  // Cuentas solo-OAuth no aceptan password local
  if (!hash || hash.startsWith("oauth:")) return false;
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: PublicUser) {
  return new SignJWT({
    sub: String(user.id),
    username: user.username,
    role: user.role,
    is_vip: user.is_vip,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  // Lax permite OAuth redirects; Strict opcional vía COOKIE_SAMESITE=strict (OpenBSD sin OAuth cross-site)
  const sameSiteRaw = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
  const sameSite =
    sameSiteRaw === "strict"
      ? ("strict" as const)
      : sameSiteRaw === "none"
        ? ("none" as const)
        : ("lax" as const);
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    sameSite,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<PublicUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getSecret());
    const id = Number(payload.sub);
    if (!id) return null;

    const hit = sessionUserCache.get(id);
    if (hit && hit.exp > Date.now()) {
      return hit.user;
    }

    const db = getDb();
    const rows = await db`
      SELECT
        id, username, email, role, is_vip, banned, created_at,
        display_name, avatar_media_id, banner_media_id, dm_privacy, bio,
        profile_theme, profile_music_media_id, profile_bg_media_id, profile_custom,
        email_verified, email_digest_enabled, deleted_at, connections
      FROM users
      WHERE id = ${id}
      LIMIT 1
    `;
    if (!rows[0]) return null;
    const u = rows[0] as UserRow & {
      display_name: string | null;
      avatar_media_id: number | null;
      banner_media_id: number | null;
      dm_privacy: string | null;
      bio: string | null;
      profile_theme: string | null;
      profile_music_media_id: number | null;
      profile_bg_media_id: number | null;
      profile_custom: unknown;
      email_verified: boolean;
      email_digest_enabled: boolean | null;
      deleted_at: string | null;
      connections: unknown;
    };
    // ban → sesión inválida
    if (u.banned) {
      sessionUserCache.delete(id);
      await clearSessionCookie().catch(() => {});
      return null;
    }
    // soft-delete vencido → purgar sesión (hard delete en ensureSchema/login)
    if (u.deleted_at) {
      const deadline = new Date(u.deleted_at).getTime() + 7 * 86400_000;
      if (Date.now() > deadline) {
        sessionUserCache.delete(id);
        await clearSessionCookie().catch(() => {});
        return null;
      }
    }
    const publicUser = toPublicUser({
      id: u.id,
      username: u.username,
      email: String(u.email || ""),
      password_hash: "",
      role: u.role,
      is_vip: Boolean(u.is_vip),
      banned: Boolean(u.banned),
      created_at: String(u.created_at),
      display_name: u.display_name,
      avatar_media_id: u.avatar_media_id,
      banner_media_id: u.banner_media_id,
      dm_privacy: u.dm_privacy,
      bio: u.bio,
      profile_theme: u.profile_theme,
      profile_music_media_id: u.profile_music_media_id,
      profile_bg_media_id: u.profile_bg_media_id,
      profile_custom: u.profile_custom,
      email_verified: Boolean(u.email_verified),
      email_digest_enabled:
        u.email_digest_enabled === undefined || u.email_digest_enabled === null
          ? true
          : Boolean(u.email_digest_enabled),
      deleted_at: u.deleted_at,
      connections: u.connections as UserConnections | null,
    });
    sessionUserCache.set(id, {
      user: publicUser,
      exp: Date.now() + SESSION_CACHE_TTL_MS,
    });
    return publicUser;
  } catch {
    return null;
  }
}

export function parseConnections(raw: unknown): UserConnections {
  if (!raw) return {};
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  } else {
    return {};
  }
  const out: UserConnections = {};
  const keys = ["github", "twitter", "website", "discord", "youtube"] as const;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) {
      out[k] = v.trim().slice(0, 200);
    }
  }
  return out;
}

export function toPublicUser(row: UserRow): PublicUser {
  const privacy =
    row.dm_privacy === "friends" ? "friends" : "everyone";
  const deletedAt = row.deleted_at ? String(row.deleted_at) : null;
  let pending_deletion = false;
  let deletion_deadline: string | null = null;
  if (deletedAt) {
    const d = new Date(deletedAt).getTime() + 7 * 86400_000;
    if (Date.now() <= d) {
      pending_deletion = true;
      deletion_deadline = new Date(d).toISOString();
    }
  }
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    is_vip: Boolean(row.is_vip),
    banned: Boolean(row.banned),
    created_at: String(row.created_at),
    display_name: row.display_name ? String(row.display_name) : null,
    avatar_url: row.avatar_media_id
      ? `/api/media/${row.avatar_media_id}`
      : null,
    banner_url: row.banner_media_id
      ? `/api/media/${row.banner_media_id}`
      : null,
    dm_privacy: privacy,
    bio: row.bio ? String(row.bio).slice(0, 100) : "",
    profile_theme: row.profile_theme
      ? String(row.profile_theme)
      : "matrix",
    profile_music_url: row.profile_music_media_id
      ? `/api/media/${row.profile_music_media_id}`
      : null,
    profile_bg_url: row.profile_bg_media_id
      ? `/api/media/${row.profile_bg_media_id}`
      : null,
    profile_custom: parseProfileCustom(row.profile_custom),
    connections: parseConnections(row.connections),
    email_verified: Boolean(row.email_verified),
    email_digest_enabled:
      row.email_digest_enabled === undefined || row.email_digest_enabled === null
        ? true
        : Boolean(row.email_digest_enabled),
    email: row.email ? String(row.email) : undefined,
    pending_deletion,
    deletion_deadline,
  };
}

/** Acciones que requieren email verificado */
export function requireVerified(
  user: PublicUser | null
): { ok: true } | { ok: false; error: string; code: string } {
  if (!user) {
    return { ok: false, error: "login requerido", code: "auth" };
  }
  if (user.pending_deletion) {
    return {
      ok: false,
      error:
        "cuenta en proceso de eliminación. Hacé login de nuevo para restaurarla, o esperá el plazo de 7 días.",
      code: "pending_deletion",
    };
  }
  if (!user.email_verified) {
    return {
      ok: false,
      error:
        "verificá tu email (OTP) en /settings para publicar, chatear en nexo o enviar solicitudes de amistad.",
      code: "email_unverified",
    };
  }
  return { ok: true };
}

export function displayLabel(user: {
  username: string;
  display_name?: string | null;
}): string {
  const d = user.display_name?.trim();
  return d || user.username;
}

export function sanitizeUsername(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, "").slice(0, 32);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

export function isValidPassword(password: string) {
  return password.length >= 8 && password.length <= 128;
}
