import Link from "next/link";
import { notFound } from "next/navigation";
import Panel from "@/components/Panel";
import ReplyForm from "@/components/ReplyForm";
import VipBadge from "@/components/VipBadge";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: `thread #${id} — knightscomputer.club` };
}

export default async function ThreadPage({ params }: Props) {
  const { id } = await params;
  const threadId = Number(id);
  if (!threadId) notFound();

  let thread: Record<string, unknown> | null = null;
  let posts: Array<Record<string, unknown>> = [];
  let dbError = false;
  const user = await getSessionUser().catch(() => null);

  try {
    await ensureSchema();
    const db = getDb();
    const threads = await db`
      SELECT
        t.id, t.category_id, t.author_id, t.title, t.locked, t.sticky,
        t.created_at, t.updated_at,
        u.username AS author_name,
        u.is_vip AS author_is_vip,
        c.slug AS category_slug,
        c.name AS category_name
      FROM threads t
      JOIN users u ON u.id = t.author_id
      JOIN categories c ON c.id = t.category_id
      WHERE t.id = ${threadId}
      LIMIT 1
    `;
    if (!threads[0]) notFound();
    thread = threads[0] as Record<string, unknown>;
    posts = (await db`
      SELECT
        p.id, p.thread_id, p.author_id, p.body, p.created_at, p.updated_at,
        u.username AS author_name,
        u.role AS author_role,
        u.is_vip AS author_is_vip
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.thread_id = ${threadId}
      ORDER BY p.created_at ASC
    `) as Array<Record<string, unknown>>;
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    dbError = true;
  }

  if (dbError) {
    return (
      <Panel title="~/thread · error">
        <div className="form-error">DB offline.</div>
      </Panel>
    );
  }

  if (!thread) notFound();

  return (
    <>
      <div className="breadcrumbs">
        <Link href="/forum">foro</Link> /{" "}
        <Link href={`/forum/${thread.category_slug}`}>
          {String(thread.category_name)}
        </Link>{" "}
        / #{threadId}
      </div>

      <Panel title={`~/thread/${threadId}`}>
        <h1>{String(thread.title)}</h1>
        <p className="muted">
          by{" "}
          <span className={thread.author_is_vip ? "vip-name" : undefined}>
            @{String(thread.author_name)}
          </span>
          {thread.author_is_vip ? (
            <>
              {" "}
              <VipBadge />
            </>
          ) : null}{" "}
          · {new Date(String(thread.created_at)).toLocaleString()}
          {thread.locked ? " · LOCKED" : ""}
        </p>
      </Panel>

      {posts.map((p, i) => {
        const isVip = Boolean(p.author_is_vip);
        return (
          <article
            key={p.id as number}
            className={`post${isVip ? " post-vip" : ""}`}
          >
            <div className="post-meta">
              <span>
                #{i + 1}{" "}
                <span className={`user${isVip ? " vip-user" : ""}`}>
                  @{String(p.author_name)}
                </span>
                {isVip ? (
                  <>
                    {" "}
                    <VipBadge />
                  </>
                ) : null}
              </span>
              <span className="role">{String(p.author_role)}</span>
              <span>{new Date(String(p.created_at)).toLocaleString()}</span>
            </div>
            <div className="post-body">{String(p.body)}</div>
          </article>
        );
      })}

      {!thread.locked && (
        <Panel title="~/reply">
          {user ? (
            <ReplyForm threadId={threadId} />
          ) : (
            <p className="muted">
              <Link href="/auth/login">login</Link> o{" "}
              <Link href="/auth/register">register</Link> para responder.
            </p>
          )}
        </Panel>
      )}
    </>
  );
}
