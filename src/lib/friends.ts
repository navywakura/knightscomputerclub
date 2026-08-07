import type { NeonQueryFunction } from "@neondatabase/serverless";
import { orderedUserPair } from "@/lib/nexo";

export type FriendshipStatus =
  | "none"
  | "pending_out"
  | "pending_in"
  | "friends"
  | "rejected";

export async function areFriends(
  db: NeonQueryFunction<false, false>,
  a: number,
  b: number
): Promise<boolean> {
  if (a === b) return true;
  const rows = await db`
    SELECT id FROM friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = ${a} AND addressee_id = ${b})
        OR (requester_id = ${b} AND addressee_id = ${a})
      )
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

export async function friendshipBetween(
  db: NeonQueryFunction<false, false>,
  me: number,
  other: number
): Promise<{
  status: FriendshipStatus;
  id: number | null;
}> {
  if (me === other) return { status: "friends", id: null };
  const rows = await db`
    SELECT id, requester_id, addressee_id, status
    FROM friendships
    WHERE
      (requester_id = ${me} AND addressee_id = ${other})
      OR (requester_id = ${other} AND addressee_id = ${me})
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (!rows[0]) return { status: "none", id: null };
  const r = rows[0] as {
    id: number;
    requester_id: number;
    addressee_id: number;
    status: string;
  };
  if (r.status === "accepted") return { status: "friends", id: r.id };
  if (r.status === "rejected") return { status: "rejected", id: r.id };
  if (r.status === "pending") {
    if (Number(r.requester_id) === me) {
      return { status: "pending_out", id: r.id };
    }
    return { status: "pending_in", id: r.id };
  }
  return { status: "none", id: r.id };
}

/** ¿Puede `fromId` abrir DM hacia `toId` según privacidad y amistad? */
export async function canOpenDm(
  db: NeonQueryFunction<false, false>,
  fromId: number,
  toId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (fromId === toId) {
    return { ok: false, error: "no podés abrirte DM a vos mismo" };
  }
  const target = await db`
    SELECT id, dm_privacy, username
    FROM users
    WHERE id = ${toId} AND banned IS NOT TRUE
    LIMIT 1
  `;
  if (!target[0]) {
    return { ok: false, error: "usuario no encontrado" };
  }
  const privacy = String(target[0].dm_privacy || "everyone");
  if (privacy === "everyone") return { ok: true };

  const friends = await areFriends(db, fromId, toId);
  if (friends) return { ok: true };

  return {
    ok: false,
    error: `@${target[0].username} solo acepta DMs de amigos. Enviá solicitud de amistad.`,
  };
}

export { orderedUserPair };
