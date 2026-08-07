import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Panel from "@/components/Panel";
import PostBody from "@/components/PostBody";
import RankBadge from "@/components/RankBadge";
import ShareButton from "@/components/ShareButton";
import { DeletePostButton } from "@/components/ModControls";
import { getSessionUser } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { excerptBody, firstImageUrl, plainTextFromBody } from "@/lib/markdown";
import { previewsForBody } from "@/lib/link-preview";
import {
  getRank,
  isOwnerUser,
  rankNameClass,
  rankPostClass,
  rankUserClass,
} from "@/lib/ranks";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function loadPost(postId: number) {
  try {
    await ensureSchema();
    const db = getDb();
    const rows = await db`
      SELECT
        p.id, p.thread_id, p.author_id, p.body, p.created_at, p.updated_at,
        u.username AS author_name,
        u.role AS author_role,
        u.is_vip AS author_is_vip,
        t.title AS thread_title,
        t.locked AS thread_locked,
        c.slug AS category_slug,
        c.name AS category_name
      FROM posts p
      JOIN users u ON u.id = p.author_id
      JOIN threads t ON t.id = p.thread_id
      JOIN categories c ON c.id = t.category_id
      WHERE p.id = ${postId}
      LIMIT 1
    `;
    return (rows[0] as Record<string, unknown>) || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const postId = Number(id);
  if (!postId) return { title: "post — knightscomputer.club" };

  const row = await loadPost(postId);
  if (!row) {
    return {
      title: `post #${postId}`,
      robots: { index: false, follow: true },
    };
  }

  const threadTitle = String(row.thread_title);
  const author = String(row.author_name);
  const board = String(row.category_name);
  const body = String(row.body || "");
  const description =
    excerptBody(body) ||
    `Post de @${author} en ${threadTitle} · knightscomputer.club`;
  const path = `/forum/post/${postId}`;
  const ogTitle = `${threadTitle} — @${author}`;
  const img = firstImageUrl(body);

  return {
    title: `post #${postId} · ${threadTitle}`,
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
      authors: [`@${author}`],
      section: board,
      images: [
        {
          url: `/forum/post/${postId}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: plainTextFromBody(body).slice(0, 80) || threadTitle,
        },
        ...(img
          ? [{ url: img, alt: "adjunto del post" }]
          : []),
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [`/forum/post/${postId}/opengraph-image`],
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const postId = Number(id);
  if (!postId) notFound();

  const post = await loadPost(postId);
  if (!post) notFound();

  const user = await getSessionUser().catch(() => null);
  const rank = getRank({
    role: String(post.author_role || ""),
    username: String(post.author_name || ""),
    is_vip: Boolean(post.author_is_vip),
  });
  const canDelete =
    user &&
    (isOwnerUser(user) || Number(post.author_id) === user.id);
  const path = `/forum/post/${postId}`;
  const threadId = Number(post.thread_id);
  const body = String(post.body || "");
  const previews = await previewsForBody(body).catch(() => []);

  // ¿Es el OP del hilo? → markdown; si es reply, plain (como en el thread)
  let isOp = true;
  try {
    await ensureSchema();
    const db = getDb();
    const first = await db`
      SELECT id FROM posts
      WHERE thread_id = ${threadId}
      ORDER BY created_at ASC
      LIMIT 1
    `;
    isOp = Boolean(first[0] && Number(first[0].id) === postId);
  } catch {
    isOp = true;
  }

  return (
    <>
      <div className="breadcrumbs">
        <Link href="/forum">foro</Link> /{" "}
        <Link href={`/forum/${post.category_slug}`}>
          {String(post.category_name)}
        </Link>{" "}
        /{" "}
        <Link href={`/forum/thread/${threadId}`}>
          thread #{threadId}
        </Link>{" "}
        / post #{postId}
      </div>

      <Panel
        title={`~/post/${postId}`}
        right={
          <ShareButton
            path={path}
            title={String(post.thread_title)}
            text={excerptBody(String(post.body), 120)}
          />
        }
      >
        <h1>{String(post.thread_title)}</h1>
        <p className="muted">
          post compartible con Open Graph ·{" "}
          <Link href={`/forum/thread/${threadId}`}>ver hilo completo →</Link>
        </p>
      </Panel>

      <article
        className={`post${rankPostClass(rank) ? ` ${rankPostClass(rank)}` : ""}`}
        id={`post-${postId}`}
      >
        <div className="post-meta">
          <span>
            <span className={`user ${rankUserClass(rank)}`.trim()}>
              @{String(post.author_name)}
            </span>
            {rank ? (
              <>
                {" "}
                <RankBadge rank={rank} />
              </>
            ) : null}
          </span>
          <span className={rankNameClass(rank)}>{String(post.author_role)}</span>
          <span>{new Date(String(post.created_at)).toLocaleString()}</span>
          <ShareButton
            path={path}
            title={String(post.thread_title)}
            text={excerptBody(String(post.body), 120)}
          />
          {canDelete ? (
            <DeletePostButton
              postId={postId}
              categorySlug={String(post.category_slug || "")}
            />
          ) : null}
        </div>
        <PostBody
          body={body}
          mode={isOp ? "markdown" : "plain"}
          previews={previews}
        />
      </article>
    </>
  );
}
