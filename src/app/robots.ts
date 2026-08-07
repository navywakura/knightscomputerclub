import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

/**
 * SEO: posts, hilos y perfiles /u/ son públicos e indexables.
 * nexo/admin/auth/settings siguen fuera del índice.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/donate",
          "/u/",
          "/forum/post/",
          "/forum/thread/",
          "/descargar",
        ],
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/auth/",
          "/nexo",
          "/nexo/",
          "/settings",
          "/settings/",
          "/forum/new",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: [
          "/",
          "/donate",
          "/u/",
          "/forum/post/",
          "/forum/thread/",
          "/descargar",
        ],
        disallow: [
          "/admin",
          "/api/",
          "/auth/",
          "/nexo",
          "/settings",
          "/forum/new",
        ],
      },
      {
        userAgent: "GPTBot",
        allow: ["/", "/donate", "/forum/post/", "/forum/thread/", "/u/"],
        disallow: ["/admin", "/api/", "/auth/", "/nexo", "/settings"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
