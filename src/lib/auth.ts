import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getDb, type PublicUser, type UserRow } from "./db";

const COOKIE_NAME = "kc_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

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
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
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

    const db = getDb();
    const rows = await db`
      SELECT id, username, role, is_vip, banned, created_at
      FROM users
      WHERE id = ${id}
      LIMIT 1
    `;
    if (!rows[0]) return null;
    const u = rows[0] as {
      id: number;
      username: string;
      role: string;
      is_vip: boolean;
      banned: boolean;
      created_at: string;
    };
    // ban → sesión inválida (no puede actuar)
    if (u.banned) {
      await clearSessionCookie().catch(() => {});
      return null;
    }
    return {
      id: u.id,
      username: u.username,
      role: u.role,
      is_vip: Boolean(u.is_vip),
      banned: Boolean(u.banned),
      created_at: String(u.created_at),
    };
  } catch {
    return null;
  }
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    is_vip: Boolean(row.is_vip),
    banned: Boolean(row.banned),
    created_at: String(row.created_at),
  };
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
