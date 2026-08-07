/** Lógica de dominio Nexo — usable en Next y (futuro) Electron. */

import bcrypt from "bcryptjs";
import { isOwnerUser } from "@/lib/ranks";

/** Poll activo (pestaña visible). Antes 2.5s — más lag en móvil. */
export const NEXO_POLL_MS = 4000;
/** Poll en background (pestaña oculta). */
export const NEXO_POLL_HIDDEN_MS = 20000;
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
