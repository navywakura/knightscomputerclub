import type { MetadataRoute } from "next";
import { ensureSchema, getDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * Sitemap público: home, donate, perfiles recientes, hilos y posts del foro.
 */
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
      url: `${base}/donate`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${base}/descargar`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/auth/login`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${base}/auth/register`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  try {
    await ensureSchema();
    const db = getDb();

    const threads = await db`
      SELECT id, updated_at
      FROM threads
      ORDER BY updated_at DESC
      LIMIT 500
    `;
    const posts = await db`
      SELECT id, created_at, updated_at
      FROM posts
      ORDER BY created_at DESC
      LIMIT 2000
    `;
    const users = await db`
      SELECT username, created_at
      FROM users
      WHERE banned IS NOT TRUE
        AND deleted_at IS NULL
      ORDER BY id DESC
      LIMIT 500
    `;

    const threadEntries: MetadataRoute.Sitemap = threads.map((t) => ({
      url: `${base}/forum/thread/${t.id}`,
      lastModified: t.updated_at ? new Date(String(t.updated_at)) : now,
      changeFrequency: "daily" as const,
      priority: 0.75,
    }));

    const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
      url: `${base}/forum/post/${p.id}`,
      lastModified: p.updated_at
        ? new Date(String(p.updated_at))
        : p.created_at
          ? new Date(String(p.created_at))
          : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const userEntries: MetadataRoute.Sitemap = users.map((u) => ({
      url: `${base}/u/${encodeURIComponent(String(u.username))}`,
      lastModified: u.created_at ? new Date(String(u.created_at)) : now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    return [
      ...staticRoutes,
      ...postEntries,
      ...threadEntries,
      ...userEntries,
    ];
  } catch (e) {
    console.error("[sitemap]", e);
    return staticRoutes;
  }
}
