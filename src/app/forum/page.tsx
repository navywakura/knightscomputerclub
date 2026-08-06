import Link from "next/link";
import Panel from "@/components/Panel";
import VipBadge from "@/components/VipBadge";
import { ensureSchema, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "foro — knightscomputer.club",
  description: "Foro del nodo: categorías, hilos, debate y RXos",
};

async function loadCategories() {
  try {
    await ensureSchema();
    const db = getDb();
    return await db`
      SELECT
        c.id, c.slug, c.name, c.description, c.sort_order,
        COUNT(t.id)::int AS thread_count
      FROM categories c
      LEFT JOIN threads t ON t.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.id ASC
    `;
  } catch {
    return null;
  }
}

async function loadRecent() {
  try {
    const db = getDb();
    return await db`
      SELECT
        t.id, t.title, t.updated_at,
        u.username AS author_name,
        u.is_vip AS author_is_vip,
        c.slug AS category_slug,
        c.name AS category_name,
        COUNT(p.id)::int AS post_count
      FROM threads t
      JOIN users u ON u.id = t.author_id
      JOIN categories c ON c.id = t.category_id
      LEFT JOIN posts p ON p.thread_id = t.id
      GROUP BY t.id, u.username, u.is_vip, c.slug, c.name
      ORDER BY t.updated_at DESC
      LIMIT 12
    `;
  } catch {
    return [];
  }
}

export default async function ForumIndexPage() {
  const categories = await loadCategories();
  const recent = categories ? await loadRecent() : [];

  return (
    <>
      <Panel
        title="~/forum · boards"
        right={
          <Link href="/forum/new" className="btn" style={{ fontSize: "0.8rem", padding: "4px 10px" }}>
            + new
          </Link>
        }
      >
        <h1>FORO DEL NODO</h1>
        <p className="muted">
          registrate, elegí un board, abrí hilo. sin likes. sin feed
          algorítmico. solo texto.
        </p>
        {!categories && (
          <div className="form-error">
            DB offline — configurá <code>DATABASE_URL</code> (Neon) y{" "}
            <code>JWT_SECRET</code>. Ver README.
          </div>
        )}
      </Panel>

      {categories && (
        <Panel title="~/forum · categories.tbl">
          <table className="forum-table">
            <thead>
              <tr>
                <th>board</th>
                <th>desc</th>
                <th>threads</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id as number}>
                  <td>
                    <Link href={`/forum/${c.slug}`}>{String(c.name)}</Link>
                  </td>
                  <td className="muted">{String(c.description)}</td>
                  <td>
                    <span className="tag">{String(c.thread_count)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {recent && recent.length > 0 && (
        <Panel title="~/forum · recent.log">
          <table className="forum-table">
            <thead>
              <tr>
                <th>thread</th>
                <th>board</th>
                <th>by</th>
                <th>posts</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id as number}>
                  <td>
                    <Link href={`/forum/thread/${t.id}`}>
                      {String(t.title)}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/forum/${t.category_slug}`}>
                      {String(t.category_name)}
                    </Link>
                  </td>
                  <td className="muted">
                    <span className={t.author_is_vip ? "vip-name" : undefined}>
                      @{String(t.author_name)}
                    </span>
                    {t.author_is_vip ? (
                      <>
                        {" "}
                        <VipBadge />
                      </>
                    ) : null}
                  </td>
                  <td>{String(t.post_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}
