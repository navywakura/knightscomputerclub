/** Lógica de dominio Nexo — usable en Next y (futuro) Electron. */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { isOwnerUser } from "@/lib/ranks";

/** Poll con la pestaña a la vista — más vivo sin freír el celu */
export const NEXO_POLL_MS = 1500;
/** Poll cuando la pestaña está en segundo plano */
export const NEXO_POLL_HIDDEN_MS = 20000;
/** Token de desbloqueo DM (sin re-bcrypt en cada mensaje) */
export const DM_UNLOCK_TOKEN_TTL = "8h";
/** Agrupar mensajes del mismo autor (cascada, estilo Discord). */
export const NEXO_GROUP_MS = 5 * 60 * 1000;
export const NEXO_MSG_MAX = 4000;
export const NEXO_BOARD_NAME_MAX = 64;
export const NEXO_SLUG_MAX = 48;
/** Ventana de edición de mensajes (10 horas) */
export const NEXO_EDIT_WINDOW_MS = 10 * 60 * 60 * 1000;

export function canEditMessageByAge(createdAt: string | Date): boolean {
  const t =
    typeof createdAt === "string"
      ? new Date(createdAt).getTime()
      : createdAt.getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= NEXO_EDIT_WINDOW_MS;
}

export function messageExcerpt(body: string, max = 120): string {
  const t = String(body || "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

export function canCreateNexoBoard(user: {
  is_vip?: boolean | null;
  role?: string | null;
  username?: string | null;
}): boolean {
  if (user.is_vip) return true;
  return isOwnerUser(user);
}

export function slugifyBoardName(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, NEXO_SLUG_MAX);
  return s || `board-${Date.now().toString(36)}`;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}

export function orderedUserPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

/** Clave de sesión desbloqueada (sessionStorage) — no es el PIN */
export function dmUnlockKey(threadId: number): string {
  return `kc_nexo_dm_unlock_${threadId}`;
}

/** Token firmado de unlock DM (sessionStorage del cliente) */
export function dmUnlockTokenKey(threadId: number): string {
  return `kc_nexo_dm_token_${threadId}`;
}

function dmTokenSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET debe tener al menos 16 caracteres.");
  }
  return new TextEncoder().encode(secret);
}

/** Tras verificar PIN: emite token corto para enviar mensajes sin bcrypt */
export async function createDmUnlockToken(
  userId: number,
  threadId: number
): Promise<string> {
  return new SignJWT({
    scope: "dm_unlock",
    uid: userId,
    tid: threadId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(DM_UNLOCK_TOKEN_TTL)
    .sign(dmTokenSecret());
}

export async function verifyDmUnlockToken(
  token: string,
  userId: number,
  threadId: number
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, dmTokenSecret());
    return (
      payload.scope === "dm_unlock" &&
      Number(payload.uid) === userId &&
      Number(payload.tid) === threadId
    );
  } catch {
    return false;
  }
}

/**
 * Autoriza acción en DM: token de unlock (rápido) o PIN (bcrypt).
 * Preferir token en el hot path de envío.
 */
export async function authorizeDmAccess(opts: {
  userId: number;
  threadId: number;
  pinHash: string;
  pin?: string | null;
  unlockToken?: string | null;
}): Promise<boolean> {
  const token = String(opts.unlockToken || "").trim();
  if (token) {
    if (await verifyDmUnlockToken(token, opts.userId, opts.threadId)) {
      return true;
    }
  }
  const pin = String(opts.pin || "").trim();
  if (pin && isValidPin(pin)) {
    return verifyPin(pin, opts.pinHash);
  }
  return false;
}
