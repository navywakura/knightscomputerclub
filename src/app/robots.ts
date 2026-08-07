import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/auth/",
          "/forum",
          "/forum/",
          "/nexo",
          "/nexo/",
        ],
      },
      {
        userAgent: "GPTBot",
        allow: ["/", "/donate"],
        disallow: ["/admin", "/api/", "/auth/", "/forum", "/nexo"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
