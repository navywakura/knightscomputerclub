import Link from "next/link";
import { notFound } from "next/navigation";
import Panel from "@/components/Panel";
import RankBadge from "@/components/RankBadge";
import { ensureSchema, getDb } from "@/lib/db";
import { getRank, rankNameClass } from "@/lib/ranks";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: `// ${slug} — foro · knightscomputer.club` };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  type Category = {
    id: number;
    slug: string;
    name: string;
    description: string;
  };

  let category: Category | null = null;
  let threads: Array<Record<string, unknown>> = [];
  let dbError = false;

  try {
    await ensureSchema();
    const db = getDb();
    const cats = await db`
      SELECT id, slug, name, description FROM categories WHERE slug = ${slug} LIMIT 1
    `;
    if (!cats[0]) {
      notFound();
    }
    category = cats[0] as Category;
    threads = (await db`
      SELECT
        t.id, t.title, t.locked, t.sticky, t.created_at, t.updated_at,
        u.username AS author_name,
        u.role AS author_role,
        u.is_vip AS author_is_vip,
        COUNT(p.id)::int AS post_count
      FROM threads t
      JOIN users u ON u.id = t.author_id
      LEFT JOIN posts p ON p.thread_id = t.id
      WHERE t.category_id = ${category.id}
      GROUP BY t.id, u.username, u.role, u.is_vip
      ORDER BY t.sticky DESC, t.updated_at DESC
      LIMIT 80
    `) as Array<Record<string, unknown>>;
  } catch (e) {
    // notFound() throws — no tragar como error de DB
    if (e && typeof e === "object" && "digest" in e) throw e;
    dbError = true;
  }

  if (dbError) {
    return (
      <Panel title="~/forum · error">
        <div className="form-error">
          DB offline — configurá DATABASE_URL.
        </div>
        <Link href="/forum">← volver</Link>
      </Panel>
    );
  }

  if (!category) notFound();

  return (
    <>
      <div className="breadcrumbs">
        <Link href="/forum">foro</Link> / {category.name}
      </div>
      <Panel
        title={`~/forum/${slug}`}
        right={
          <Link
            href={`/forum/new?cat=${slug}`}
            className="btn"
            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
          >
            + thread
          </Link>
        }
      >
        <h1>{category.name}</h1>
        <p className="muted">{category.description}</p>
      </Panel>

      <Panel title="~/threads.tbl">
        {threads.length === 0 ? (
          <p className="muted">
            board vacío.{" "}
            <Link href={`/forum/new?cat=${slug}`}>abrí el primer hilo</Link>.
          </p>
        ) : (
          <table className="forum-table">
            <thead>
              <tr>
                <th>title</th>
                <th>author</th>
                <th>posts</th>
                <th>updated</th>
              </tr>
            </thead>
            <tbody>
              {threads.map((t) => {
                const rank = getRank({
                  role: String(t.author_role || ""),
                  username: String(t.author_name || ""),
                  is_vip: Boolean(t.author_is_vip),
                });
                return (
                <tr key={t.id as number}>
                  <td>
                    {t.sticky ? (
                      <span className="tag hot" style={{ marginRight: 6 }}>
                        sticky
                      </span>
                    ) : null}
                    {t.locked ? (
                      <span className="tag" style={{ marginRight: 6 }}>
                        locked
                      </span>
                    ) : null}
                    <Link href={`/forum/thread/${t.id}`}>
                      {String(t.title)}
                    </Link>
                  </td>
                  <td className="muted">
                    <span className={rankNameClass(rank)}>
                      @{String(t.author_name)}
                    </span>
                    {rank ? (
                      <>
                        {" "}
                        <RankBadge rank={rank} />
                      </>
                    ) : null}
                  </td>
                  <td>{String(t.post_count)}</td>
                  <td className="muted" style={{ fontSize: "0.8rem" }}>
                    {new Date(String(t.updated_at)).toLocaleString()}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
