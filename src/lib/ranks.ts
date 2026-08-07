/** Rangos visibles en el foro / header */

export const OWNER_USERNAMES = new Set(["roger"]);
export const OWNER_EMAILS = new Set(["rogynavarro@gmail.com"]);

export type RankKind = "owner" | "vip" | null;

export function isOwnerUser(input: {
  role?: string | null;
  username?: string | null;
  email?: string | null;
}): boolean {
  if (input.role && String(input.role).toLowerCase() === "owner") return true;
  const u = input.username?.trim().toLowerCase();
  if (u && OWNER_USERNAMES.has(u)) return true;
  const e = input.email?.trim().toLowerCase();
  if (e && OWNER_EMAILS.has(e)) return true;
  return false;
}

export function getRank(input: {
  role?: string | null;
  username?: string | null;
  email?: string | null;
  is_vip?: boolean | null;
}): RankKind {
  if (isOwnerUser(input)) return "owner";
  if (input.is_vip) return "vip";
  return null;
}

export function rankNameClass(rank: RankKind): string | undefined {
  if (rank === "owner") return "owner-name";
  if (rank === "vip") return "vip-name";
  return undefined;
}

export function rankUserClass(rank: RankKind): string {
  if (rank === "owner") return "owner-user";
  if (rank === "vip") return "vip-user";
  return "";
}

export function rankPostClass(rank: RankKind): string {
  if (rank === "owner") return "post-owner";
  if (rank === "vip") return "post-vip";
  return "";
}
