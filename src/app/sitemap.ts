import type { MetadataRoute } from "next";
import { ensureSchema, getDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/site";

/** Boards conocidos (fallback si la DB no responde) */
const FALLBACK_BOARDS = [
  "general",
  "rxos",
  "debate",
  "ops",
  "offtopic",
  "random",
  "memes",
  "anime",
  "ciencia",
];

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/forum`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.95,
    },
    {
      url: `${base}/donate`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
  ];

  let boardSlugs = FALLBACK_BOARDS;
  let threads: Array<{ id: number; updated_at: string | Date }> = [];

  try {
    await ensureSchema();
    const db = getDb();

    const cats = await db`
      SELECT slug FROM categories ORDER BY sort_order ASC, id ASC
    `;
    if (cats.length) {
      boardSlugs = cats.map((c) => String(c.slug));
    }

    // hilos recientes (tope razonable para sitemap)
    threads = (await db`
      SELECT id, updated_at
      FROM threads
      ORDER BY updated_at DESC
      LIMIT 500
    `) as Array<{ id: number; updated_at: string | Date }>;
  } catch {
    // DB offline: sitemap estático + boards fallback
  }

  const boardRoutes: MetadataRoute.Sitemap = boardSlugs.map((slug) => ({
    url: `${base}/forum/${slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.75,
  }));

  const threadRoutes: MetadataRoute.Sitemap = threads.map((t) => ({
    url: `${base}/forum/thread/${t.id}`,
    lastModified: t.updated_at ? new Date(t.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...boardRoutes, ...threadRoutes];
}
