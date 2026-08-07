/**
 * Cuando alguien crea un board en // nexo (chat),
 * también aparece como subboard del foro bajo la categoría // nexo.
 * Así el usuario no tiene dos mundos raros: mismo slug, mismo nombre.
 */

import type { NeonQueryFunction } from "@neondatabase/serverless";

type Db = NeonQueryFunction<false, false>;

export type MirrorBoardInput = {
  boardId: number;
  slug: string;
  name: string;
  description: string;
  ownerId: number;
  ownerUsername: string;
};

export type MirrorBoardResult = {
  categoryId: number | null;
  forumSlug: string | null;
  threadId: number | null;
  created: boolean;
};

/** Nombre bonito en el árbol del foro: // mi-canal */
export function forumNameForNexoBoard(name: string): string {
  const n = String(name || "").trim();
  if (!n) return "// board";
  if (n.startsWith("//")) return n.slice(0, 128);
  return `// ${n}`.slice(0, 128);
}

/**
 * Crea (o reusa) la categoría del foro bajo el hub // nexo
 * y deja un hilo intro con link al chat.
 */
export async function mirrorNexoBoardToForum(
  db: Db,
  input: MirrorBoardInput
): Promise<MirrorBoardResult> {
  const empty: MirrorBoardResult = {
    categoryId: null,
    forumSlug: null,
    threadId: null,
    created: false,
  };

  const parent = await db`
    SELECT id FROM categories WHERE slug = 'nexo' LIMIT 1
  `;
  const parentId = parent[0] ? Number(parent[0].id) : 0;
  if (!parentId) return empty;

  const slug = String(input.slug || "")
    .trim()
    .toLowerCase()
    .slice(0, 64);
  if (!slug) return empty;

  const name = forumNameForNexoBoard(input.name);
  const description = (
    String(input.description || "").trim() ||
    `Chat en vivo de @${input.ownerUsername}. Abrí /nexo?board=${input.boardId}`
  ).slice(0, 500);

  // ¿Ya existe una categoría con este slug?
  const existing = await db`
    SELECT id, parent_id, slug FROM categories WHERE slug = ${slug} LIMIT 1
  `;

  let categoryId: number;
  let forumSlug = slug;
  let created = false;

  if (existing[0]) {
    categoryId = Number(existing[0].id);
    // Si no estaba bajo // nexo, la movemos ahí (es el board del usuario)
    if (Number(existing[0].parent_id) !== parentId) {
      await db`
        UPDATE categories
        SET parent_id = ${parentId},
            name = ${name},
            description = ${description}
        WHERE id = ${categoryId}
      `;
    } else {
      // refrescar nombre/desc por si el owner lo creó de nuevo mentalmente
      await db`
        UPDATE categories
        SET name = ${name},
            description = ${description}
        WHERE id = ${categoryId}
      `;
    }
  } else {
    // sort: boards de usuario al final del hub
    const sortOrder = 200 + Math.min(input.boardId, 700);
    const inserted = await db`
      INSERT INTO categories (slug, name, description, sort_order, parent_id)
      VALUES (${slug}, ${name}, ${description}, ${sortOrder}, ${parentId})
      RETURNING id, slug
    `;
    if (!inserted[0]) return empty;
    categoryId = Number(inserted[0].id);
    forumSlug = String(inserted[0].slug);
    created = true;
  }

  // Hilo intro solo si el board del foro está vacío
  const threadCount = await db`
    SELECT COUNT(*)::int AS n FROM threads WHERE category_id = ${categoryId}
  `;
  let threadId: number | null = null;

  if (Number(threadCount[0]?.n || 0) === 0) {
    const title = `chat // ${String(input.name).trim().slice(0, 80)}`.slice(
      0,
      200
    );
    const body = [
      `**Tablón Nexo:** \`${input.name}\``,
      ``,
      `Este board del foro va de la mano con el **chat en vivo**.`,
      ``,
      `→ [abrir chat](/nexo?board=${input.boardId})`,
      `→ invitar amigos: \`/nexo?join=${forumSlug}\``,
      ``,
      `Creado por @${input.ownerUsername}.`,
      ``,
      `_Acá podés dejar hilos largos, guías o off-topic del canal. El chat en tiempo real vive en /nexo._`,
    ].join("\n");

    const thr = await db`
      INSERT INTO threads (category_id, author_id, title, sticky, locked)
      VALUES (${categoryId}, ${input.ownerId}, ${title}, TRUE, FALSE)
      RETURNING id
    `;
    threadId = thr[0] ? Number(thr[0].id) : null;
    if (threadId) {
      await db`
        INSERT INTO posts (thread_id, author_id, body)
        VALUES (${threadId}, ${input.ownerId}, ${body})
      `;
    }
  }

  return { categoryId, forumSlug, threadId, created };
}

/**
 * Backfill: boards de nexo viejos que nunca tuvieron categoría en el foro.
 * Se corre en ensureSchema (barato si ya están todos).
 */
export async function syncAllNexoBoardsToForum(db: Db): Promise<number> {
  const parent = await db`
    SELECT id FROM categories WHERE slug = 'nexo' LIMIT 1
  `;
  if (!parent[0]) return 0;

  const boards = await db`
    SELECT
      b.id, b.slug, b.name, b.description, b.owner_id,
      u.username AS owner_username
    FROM nexo_boards b
    JOIN users u ON u.id = b.owner_id
    WHERE NOT EXISTS (
      SELECT 1 FROM categories c WHERE c.slug = b.slug
    )
    ORDER BY b.id ASC
    LIMIT 100
  `;

  let n = 0;
  for (const b of boards) {
    try {
      const r = await mirrorNexoBoardToForum(db, {
        boardId: Number(b.id),
        slug: String(b.slug),
        name: String(b.name),
        description: String(b.description || ""),
        ownerId: Number(b.owner_id),
        ownerUsername: String(b.owner_username || "user"),
      });
      if (r.created || r.categoryId) n += 1;
    } catch (e) {
      console.error("[sync nexo→forum]", b.slug, e);
    }
  }
  return n;
}
