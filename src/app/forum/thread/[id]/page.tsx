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

  const base = getSiteUrl();
  const title = String(row.title);
  const author = String(row.author_name);
  const board = String(row.category_name);
  const body = row.first_body ? String(row.first_body) : "";
  const description =
    excerptBody(body) ||
    `Hilo en ${board} por @${author} · knightscomputer.club`;
  const path = `/forum/thread/${threadId}`;
  const ogTitle = `${title} · ${board}`;
  const absImg = firstImageAbsoluteUrl(body, base);
  const ogCard = `${base}/forum/thread/${threadId}/opengraph-image`;

  const images = absImg
    ? [
        {
          url: absImg,
          width: 1200,
          height: 630,
          alt: title,
        },
        { url: ogCard, width: 1200, height: 630, alt: ogTitle },
      ]
    : [{ url: ogCard, width: 1200, height: 630, alt: title }];

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
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
      modifiedTime: row.updated_at
        ? new Date(String(row.updated_at)).toISOString()
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

export default async function ThreadPage({ params }: Props) {
  const { id } = await params;
  const threadId = Number(id);
  if (!threadId) notFound();

  const row = await loadThreadMeta(threadId);
  if (!row) notFound();

  const base = getSiteUrl();
  const title = String(row.title);
  const author = String(row.author_name);
  const board = String(row.category_name);
  const boardSlug = String(row.category_slug);
  const body = row.first_body ? String(row.first_body) : "";
  const text = plainTextFromBody(body);
  const img = firstImageUrl(body);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: title,
    articleBody: text.slice(0, 5000),
    datePublished: row.created_at
      ? new Date(String(row.created_at)).toISOString()
      : undefined,
    dateModified: row.updated_at
      ? new Date(String(row.updated_at)).toISOString()
      : undefined,
    author: {
      "@type": "Person",
      name: author,
      url: `${base}/u/${encodeURIComponent(author)}`,
    },
    url: `${base}/forum/thread/${threadId}`,
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
      <article className="forum-seo-article">
        <header>
          <p className="muted">
            <Link href={`/forum/${boardSlug}`}>{board}</Link>
          </p>
          <h1>{title}</h1>
          <p>
            por{" "}
            <Link href={`/u/${encodeURIComponent(author)}`}>@{author}</Link>
            {row.created_at
              ? ` · ${new Date(String(row.created_at)).toLocaleString()}`
              : ""}
          </p>
        </header>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="forum-seo-img" loading="eager" />
        ) : null}
        <div className="forum-seo-body">{text}</div>
      </article>
      <ForumApp initialThreadId={threadId} />
    </>
  );
}
