import { ensureSchema, getDb } from "@/lib/db";

export type LinkPreview = {
  url: string;
  final_url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
  ok: boolean;
};

const CACHE_DAYS = 14;
const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML = 512_000;
const MAX_URLS_PER_BODY = 6;

/** URLs http(s) externas en el body (md links + bare) */
export function extractExternalUrls(body: string): string[] {
  const found = new Set<string>();

  const md = /\]\((https?:\/\/[^)\s]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = md.exec(body))) found.add(normalizeUrl(m[1]));

  const bare = /(https?:\/\/[^\s<>"'`)\]}]+)/gi;
  while ((m = bare.exec(body))) {
    let u = m[1].replace(/[.,;:!?)]+$/, "");
    found.add(normalizeUrl(u));
  }

  // quitar media propia y paths relativos
  return [...found]
    .filter((u) => {
      try {
        const parsed = new URL(u);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
          return false;
        // no unfurl assets internos del nodo
        if (parsed.pathname.startsWith("/api/media/")) return false;
        return true;
      } catch {
        return false;
      }
    })
    .slice(0, MAX_URLS_PER_BODY);
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    return u.toString();
  } catch {
    return raw.trim();
  }
}

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.endsWith(".localhost")
  ) {
    return true;
  }
  // IPv4 literal
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  // IPv6 simples
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80"))
    return true;
  return false;
}

export function isSafeExternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (isPrivateHost(u.hostname)) return false;
    if (u.username || u.password) return false;
    return true;
  } catch {
    return false;
  }
}

function attrContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function titleTag(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1] ? decodeEntities(m[1].trim()) : null;
}

function resolveUrl(base: string, maybe: string | null): string | null {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return null;
  }
}

async function fetchOgLive(url: string): Promise<LinkPreview> {
  const empty: LinkPreview = {
    url,
    final_url: url,
    title: null,
    description: null,
    image: null,
    site_name: null,
    ok: false,
  };

  if (!isSafeExternalUrl(url)) return empty;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // UA tipo browser: muchos sitios bloquean bots custom y no devuelven OG
        "User-Agent":
          "Mozilla/5.0 (compatible; KnightsComputerPreview/1.1; +https://knightscomputer.club) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
    });

    const finalUrl = res.url || url;
    if (!isSafeExternalUrl(finalUrl)) return { ...empty, final_url: finalUrl };

    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("text/html") && !ctype.includes("application/xhtml")) {
      return {
        ...empty,
        final_url: finalUrl,
        title: new URL(finalUrl).hostname,
        site_name: new URL(finalUrl).hostname,
        ok: true,
      };
    }

    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_HTML ? buf.slice(0, MAX_HTML) : buf;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);

    const title =
      attrContent(html, "og:title") ||
      attrContent(html, "twitter:title") ||
      titleTag(html);
    const description =
      attrContent(html, "og:description") ||
      attrContent(html, "twitter:description") ||
      attrContent(html, "description");
    const image = resolveUrl(
      finalUrl,
      attrContent(html, "og:image") ||
        attrContent(html, "og:image:url") ||
        attrContent(html, "twitter:image")
    );
    const site_name =
      attrContent(html, "og:site_name") || new URL(finalUrl).hostname;

    return {
      url,
      final_url: finalUrl,
      title: title?.slice(0, 300) || null,
      description: description?.slice(0, 500) || null,
      image: image?.slice(0, 2000) || null,
      site_name: site_name?.slice(0, 200) || null,
      ok: Boolean(title || description || image),
    };
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

async function readCache(urls: string[]): Promise<Map<string, LinkPreview>> {
  const map = new Map<string, LinkPreview>();
  if (!urls.length) return map;
  try {
    await ensureSchema();
    const db = getDb();
    const rows = await db`
      SELECT url, final_url, title, description, image, site_name, ok, fetched_at
      FROM link_previews
      WHERE url = ANY(${urls})
        AND fetched_at > NOW() - (${CACHE_DAYS} * INTERVAL '1 day')
    `;
    for (const row of rows as Record<string, unknown>[]) {
      map.set(String(row.url), {
        url: String(row.url),
        final_url: String(row.final_url || row.url),
        title: row.title ? String(row.title) : null,
        description: row.description ? String(row.description) : null,
        image: row.image ? String(row.image) : null,
        site_name: row.site_name ? String(row.site_name) : null,
        ok: Boolean(row.ok),
      });
    }
  } catch {
    /* ignore cache miss — fallback por-url */
    try {
      const db = getDb();
      for (const url of urls.slice(0, 24)) {
        const rows = await db`
          SELECT url, final_url, title, description, image, site_name, ok, fetched_at
          FROM link_previews
          WHERE url = ${url}
          LIMIT 1
        `;
        if (!rows[0]) continue;
        const age =
          Date.now() - new Date(String(rows[0].fetched_at)).getTime();
        if (age > CACHE_DAYS * 86400_000) continue;
        map.set(url, {
          url: String(rows[0].url),
          final_url: String(rows[0].final_url || rows[0].url),
          title: rows[0].title ? String(rows[0].title) : null,
          description: rows[0].description
            ? String(rows[0].description)
            : null,
          image: rows[0].image ? String(rows[0].image) : null,
          site_name: rows[0].site_name ? String(rows[0].site_name) : null,
          ok: Boolean(rows[0].ok),
        });
      }
    } catch {
      /* */
    }
  }
  return map;
}

async function writeCache(preview: LinkPreview) {
  try {
    await ensureSchema();
    const db = getDb();
    await db`
      INSERT INTO link_previews (url, final_url, title, description, image, site_name, ok, fetched_at)
      VALUES (
        ${preview.url},
        ${preview.final_url},
        ${preview.title},
        ${preview.description},
        ${preview.image},
        ${preview.site_name},
        ${preview.ok},
        NOW()
      )
      ON CONFLICT (url) DO UPDATE SET
        final_url = EXCLUDED.final_url,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        image = EXCLUDED.image,
        site_name = EXCLUDED.site_name,
        ok = EXCLUDED.ok,
        fetched_at = NOW()
    `;
  } catch (e) {
    console.error("[link_preview cache]", e);
  }
}

export type ResolvePreviewOpts = {
  /** Solo leer cache DB — no fetch HTTP (carga de hilo más rápida) */
  cacheOnly?: boolean;
};

/** Carga previews (cache + fetch) para una lista de URLs */
export async function resolveLinkPreviews(
  urls: string[],
  opts: ResolvePreviewOpts = {}
): Promise<LinkPreview[]> {
  const unique = [...new Set(urls.map(normalizeUrl))].filter(isSafeExternalUrl);
  if (!unique.length) return [];

  const cached = await readCache(unique);
  const out: LinkPreview[] = [];
  const missing: string[] = [];

  for (const u of unique) {
    const c = cached.get(u);
    if (c) out.push(c);
    else missing.push(u);
  }

  if (opts.cacheOnly) return out;

  // fetch en paralelo limitado
  const batch = missing.slice(0, MAX_URLS_PER_BODY);
  const live = await Promise.all(
    batch.map(async (u) => {
      const p = await fetchOgLive(u);
      await writeCache(p);
      return p;
    })
  );

  for (const p of live) {
    if (p.ok || p.title || p.description || p.image) out.push(p);
    else if (p.final_url) out.push({ ...p, ok: true, title: p.final_url });
  }

  return out;
}

export async function previewsForBody(
  body: string,
  opts: ResolvePreviewOpts = {}
): Promise<LinkPreview[]> {
  return resolveLinkPreviews(extractExternalUrls(body), opts);
}

export async function previewsForPosts(
  posts: Array<{ id: number; body: string }>,
  opts: ResolvePreviewOpts = {}
): Promise<Map<number, LinkPreview[]>> {
  const all = new Set<string>();
  const urlsByPost = new Map<number, string[]>();
  for (const p of posts) {
    const urls = extractExternalUrls(p.body);
    urlsByPost.set(p.id, urls);
    urls.forEach((u) => all.add(u));
  }
  const allPreviews = await resolveLinkPreviews([...all], opts);
  const byUrl = new Map(allPreviews.map((p) => [p.url, p]));

  const result = new Map<number, LinkPreview[]>();
  for (const [id, urls] of urlsByPost) {
    result.set(
      id,
      urls.map((u) => byUrl.get(u)).filter(Boolean) as LinkPreview[]
    );
  }
  return result;
}
