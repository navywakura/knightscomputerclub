import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ForumApp from "@/components/forum/ForumApp";
import { ensureSchema, getDb } from "@/lib/db";
import { excerptBody, firstImageUrl, plainTextFromBody } from "@/lib/markdown";

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
        ...(img ? [{ url: img, alt: "adjunto del post" }] : []),
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

  const threadId = Number(post.thread_id);
  return <ForumApp initialThreadId={threadId} />;
}
