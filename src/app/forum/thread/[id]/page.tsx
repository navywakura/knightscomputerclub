import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Panel from "@/components/Panel";
import ReplyForm from "@/components/ReplyForm";
import RankBadge from "@/components/RankBadge";
import PostBody from "@/components/PostBody";
import ShareButton from "@/components/ShareButton";
import {
  DeletePostButton,
  DeleteThreadButton,
} from "@/components/ModControls";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { excerptBody } from "@/lib/markdown";
import { previewsForPosts } from "@/lib/link-preview";
import {
  getRank,
  isOwnerUser,
  rankNameClass,
  rankPostClass,
  rankUserClass,
} from "@/lib/ranks";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function loadThreadMeta(threadId: number) {
  try {
    await ensureSchema();
    const db = getDb();
    const rows = await db`
      SELECT
        t.id, t.title, t.created_at, t.updated_at,
        u.username AS author_name,
        c.slug AS category_slug,
        c.name AS category_name,
        (
          SELECT p.body FROM posts p
          WHERE p.thread_id = t.id
          ORDER BY p.created_at ASC
          LIMIT 1
        ) AS first_body
      FROM threads t
      JOIN users u ON u.id = t.author_id
      JOIN categories c ON c.id = t.category_id
      WHERE t.id = ${threadId}
      LIMIT 1
    `;
    return (rows[0] as Record<string, unknown>) || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const threadId = Number(id);
  if (!threadId) {
    return { title: "thread — knightscomputer.club" };
  }

  const row = await loadThreadMeta(threadId);
  if (!row) {
    return {
      title: `thread #${threadId} — knightscomputer.club`,
      robots: { index: false, follow: true },
    };
  }

  const title = String(row.title);
  const author = String(row.author_name);
  const board = String(row.category_name);
  const body = row.first_body ? String(row.first_body) : "";
  const description =
    excerptBody(body) ||
    `Hilo en ${board} por @${author} · knightscomputer.club`;
  const path = `/forum/thread/${threadId}`;
  const ogTitle = `${title} · ${board}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: ogTitle,
      description,
      type: "article",
      url: path,
      siteName: "knightscomputer.club",
      locale: "es_ES",
      publishedTime: row.created_at
        ? new Date(String(row.created_at)).toISOString()
        : undefined,
      modifiedTime: row.updated_at
        ? new Date(String(row.updated_at)).toISOString()
        : undefined,
      authors: [`@${author}`],
      section: board,
      images: [
        {
          url: `/forum/thread/${threadId}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [`/forum/thread/${threadId}/opengraph-image`],
    },
  };
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
        u.role AS author_role,
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

  const authorRank = getRank({
    role: String(thread.author_role || ""),
    username: String(thread.author_name || ""),
    is_vip: Boolean(thread.author_is_vip),
  });

  const isOwner = user ? isOwnerUser(user) : false;
  const isThreadAuthor = user
    ? Number(thread.author_id) === user.id
    : false;
  const canDeleteThread = isOwner || isThreadAuthor;
  const categorySlug = String(thread.category_slug || "");

  // Markdown solo en el OP (#1); replies/comentarios = plain + embeds
  // Embeds Open Graph externos: en todos los mensajes del hilo
  const previewMap = await previewsForPosts(
    posts.map((p) => ({ id: p.id as number, body: String(p.body || "") }))
  ).catch(() => new Map());

  return (
    <>
      <div className="breadcrumbs">
        <Link href="/forum">foro</Link> /{" "}
        <Link href={`/forum/${thread.category_slug}`}>
          {String(thread.category_name)}
        </Link>{" "}
        / #{threadId}
      </div>

      <Panel
        title={`~/thread/${threadId}`}
        right={
          canDeleteThread ? (
            <DeleteThreadButton
              threadId={threadId}
              categorySlug={categorySlug}
            />
          ) : undefined
        }
      >
        <h1>{String(thread.title)}</h1>
        <p className="muted">
          by{" "}
          <span className={rankNameClass(authorRank)}>
            @{String(thread.author_name)}
          </span>
          {authorRank ? (
            <>
              {" "}
              <RankBadge rank={authorRank} />
            </>
          ) : null}{" "}
          · {new Date(String(thread.created_at)).toLocaleString()}
          {thread.locked ? " · LOCKED" : ""}
        </p>
      </Panel>

      {posts.map((p, i) => {
        const rank = getRank({
          role: String(p.author_role || ""),
          username: String(p.author_name || ""),
          is_vip: Boolean(p.author_is_vip),
        });
        const userCls = rankUserClass(rank);
        const postCls = rankPostClass(rank);
        const canDeletePost =
          isOwner || (user ? Number(p.author_id) === user.id : false);
        const postId = p.id as number;
        const sharePath = `/forum/post/${postId}`;
        return (
          <article
            key={postId}
            id={`post-${postId}`}
            className={`post${postCls ? ` ${postCls}` : ""}`}
          >
            <div className="post-meta">
              <span>
                #{i + 1}{" "}
                <span className={`user${userCls ? ` ${userCls}` : ""}`}>
                  @{String(p.author_name)}
                </span>
                {rank ? (
                  <>
                    {" "}
                    <RankBadge rank={rank} />
                  </>
                ) : null}
              </span>
              <span className="role">{String(p.author_role)}</span>
              <span>{new Date(String(p.created_at)).toLocaleString()}</span>
              <ShareButton
                path={sharePath}
                title={String(thread.title)}
                text={excerptBody(String(p.body), 120)}
              />
              {canDeletePost ? (
                <DeletePostButton
                  postId={postId}
                  categorySlug={categorySlug}
                />
              ) : null}
            </div>
            <PostBody
              body={String(p.body)}
              mode={i === 0 ? "markdown" : "plain"}
              previews={previewMap.get(postId) || []}
            />
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
