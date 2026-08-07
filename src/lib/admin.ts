import { getSessionUser } from "@/lib/auth";
import { isOwnerUser } from "@/lib/ranks";
import type { PublicUser } from "@/lib/db";

export async function getOwnerSession(): Promise<PublicUser | null> {
  const user = await getSessionUser();
  if (!user || user.banned) return null;
  if (!isOwnerUser(user)) return null;
  return user;
}

export function assertNotBanned(user: PublicUser | null): user is PublicUser {
  return Boolean(user && !user.banned);
}
