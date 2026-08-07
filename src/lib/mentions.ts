/** Extrae @usernames de un mensaje (estilo Discord, sin emails). */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const re = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_\-]{2,32})\b/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    found.add(m[2].toLowerCase());
  }
  return [...found];
}

/** Resuelve ids de usuario por username (lower). */
export async function resolveMentionUserIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  usernames: string[],
  excludeId?: number
): Promise<Array<{ id: number; username: string }>> {
  if (!usernames.length) return [];
  const out: Array<{ id: number; username: string }> = [];
  for (const u of usernames.slice(0, 20)) {
    const rows = await db`
      SELECT id, username FROM users
      WHERE lower(username) = ${u}
        AND banned IS NOT TRUE
      LIMIT 1
    `;
    if (rows[0]) {
      const id = Number(rows[0].id);
      if (excludeId && id === excludeId) continue;
      out.push({ id, username: String(rows[0].username) });
    }
  }
  return out;
}
