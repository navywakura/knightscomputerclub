import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ForumApp from "@/components/forum/ForumApp";
import { ensureSchema, getDb } from "@/lib/db";
import { excerptBody } from "@/lib/markdown";

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

  return <ForumApp initialThreadId={threadId} />;
}
