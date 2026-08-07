import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ForumApp from "@/components/forum/ForumApp";
import { ensureSchema, getDb } from "@/lib/db";
import {
  excerptBody,
  firstImageAbsoluteUrl,
  firstImageUrl,
  plainTextFromBody,
} from "@/lib/markdown";
import { getSiteUrl } from "@/lib/site";

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

  const base = getSiteUrl();
  const threadTitle = String(row.thread_title);
  const author = String(row.author_name);
  const board = String(row.category_name);
  const body = String(row.body || "");
  const description =
    excerptBody(body) ||
    `Post de @${author} en ${threadTitle} · knightscomputer.club`;
  const path = `/forum/post/${postId}`;
  const ogTitle = `${threadTitle} — @${author}`;
  const absImg = firstImageAbsoluteUrl(body, base);
  const ogCard = `${base}/forum/post/${postId}/opengraph-image`;

  // Preferir la imagen real del post en OG (Google / redes)
  const images = absImg
    ? [
        {
          url: absImg,
          width: 1200,
          height: 630,
          alt: plainTextFromBody(body).slice(0, 80) || threadTitle,
        },
        {
          url: ogCard,
          width: 1200,
          height: 630,
          alt: ogTitle,
        },
      ]
    : [
        {
          url: ogCard,
          width: 1200,
          height: 630,
          alt: plainTextFromBody(body).slice(0, 80) || threadTitle,
        },
      ];

  return {
    title: `post #${postId} · ${threadTitle}`,
    description,
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    alternates: { canonical: `${base}${path}` },
    openGraph: {
      title: ogTitle,
      description,
      type: "article",
      url: `${base}${path}`,
      siteName: "knightscomputer.club",
      locale: "es_ES",
      publishedTime: row.created_at
        ? new Date(String(row.created_at)).toISOString()
        : undefined,
      authors: [`@${author}`],
      section: board,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [absImg || ogCard],
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const postId = Number(id);
  if (!postId) notFound();

  const post = await loadPost(postId);
  if (!post) notFound();

  const threadId = Number(post.thread_id);
  const body = String(post.body || "");
  const threadTitle = String(post.thread_title);
  const author = String(post.author_name);
  const board = String(post.category_name);
  const boardSlug = String(post.category_slug);
  const img = firstImageUrl(body);
  const text = plainTextFromBody(body);
  const base = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: threadTitle,
    articleBody: text.slice(0, 5000),
    datePublished: post.created_at
      ? new Date(String(post.created_at)).toISOString()
      : undefined,
    dateModified: post.updated_at
      ? new Date(String(post.updated_at)).toISOString()
      : undefined,
    author: {
      "@type": "Person",
      name: author,
      url: `${base}/u/${encodeURIComponent(author)}`,
    },
    url: `${base}/forum/post/${postId}`,
    isPartOf: {
      "@type": "DiscussionForumPosting",
      name: threadTitle,
      url: `${base}/forum/thread/${threadId}`,
    },
    publisher: {
      "@type": "Organization",
      name: "knightscomputer.club",
      url: base,
    },
    ...(img
      ? {
          image: img.startsWith("http")
            ? img
            : `${base}${img.startsWith("/") ? img : `/${img}`}`,
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Contenido server-side para crawlers (Google). La SPA lo oculta visualmente. */}
      <article className="forum-seo-article">
        <header>
          <p className="muted">
            <Link href={`/forum/${boardSlug}`}>{board}</Link>
            {" · "}
            <Link href={`/forum/thread/${threadId}`}>{threadTitle}</Link>
          </p>
          <h1>
            post #{postId} · {threadTitle}
          </h1>
          <p>
            por{" "}
            <Link href={`/u/${encodeURIComponent(author)}`}>@{author}</Link>
            {post.created_at
              ? ` · ${new Date(String(post.created_at)).toLocaleString()}`
              : ""}
          </p>
        </header>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            className="forum-seo-img"
            loading="eager"
          />
        ) : null}
        <div className="forum-seo-body">{text}</div>
        <p>
          <Link href={`/forum/thread/${threadId}`}>ver hilo completo →</Link>
        </p>
      </article>
      <ForumApp initialThreadId={threadId} />
    </>
  );
}
