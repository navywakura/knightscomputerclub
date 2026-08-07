import type { ReactNode } from "react";

const IMG_MD = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
const LINK_MD = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
const BARE_URL = /(https?:\/\/[^\s<]+[^\s<.,;:!?"')\]])/g;
const MEDIA_IN_BODY = /\/api\/media\/(\d+)/g;

export function plainTextFromBody(body: string): string {
  return body
    .replace(IMG_MD, "[imagen]")
    .replace(LINK_MD, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerptBody(body: string, max = 180): string {
  const t = plainTextFromBody(body);
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

export function firstMediaId(body: string): number | null {
  const m = body.match(MEDIA_IN_BODY);
  if (!m) return null;
  const id = Number(m[0].replace("/api/media/", ""));
  return id || null;
}

export function firstImageUrl(body: string): string | null {
  const media = firstMediaId(body);
  if (media) return `/api/media/${media}`;
  IMG_MD.lastIndex = 0;
  const m = IMG_MD.exec(body);
  if (m && (m[2].startsWith("http") || m[2].startsWith("/"))) return m[2];
  return null;
}

/** Render mínimo seguro: saltos de línea, imágenes md, links */
export function renderPostBody(body: string): ReactNode[] {
  const lines = body.split("\n");
  const nodes: ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) nodes.push(<br key={`br-${lineIdx}`} />);
    nodes.push(...renderInline(line, lineIdx));
  });

  return nodes;
}

function renderInline(text: string, lineKey: number): ReactNode[] {
  // Tokenize images first, then links, then bare urls
  type Part =
    | { t: "text"; v: string }
    | { t: "img"; alt: string; src: string }
    | { t: "a"; label: string; href: string };

  let parts: Part[] = [{ t: "text", v: text }];

  function splitOn(
    list: Part[],
    re: RegExp,
    map: (m: RegExpExecArray) => Part
  ): Part[] {
    const out: Part[] = [];
    for (const p of list) {
      if (p.t !== "text") {
        out.push(p);
        continue;
      }
      re.lastIndex = 0;
      let last = 0;
      let m: RegExpExecArray | null;
      const s = p.v;
      while ((m = re.exec(s))) {
        if (m.index > last) out.push({ t: "text", v: s.slice(last, m.index) });
        out.push(map(m));
        last = m.index + m[0].length;
      }
      if (last < s.length) out.push({ t: "text", v: s.slice(last) });
    }
    return out;
  }

  parts = splitOn(parts, /!\[([^\]]*)\]\(([^)\s]+)\)/g, (m) => ({
    t: "img",
    alt: m[1],
    src: m[2],
  }));
  parts = splitOn(parts, /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m) => ({
    t: "a",
    label: m[1],
    href: m[2],
  }));
  parts = splitOn(parts, /(https?:\/\/[^\s<]+[^\s<.,;:!?"')\]])/g, (m) => ({
    t: "a",
    label: m[1],
    href: m[1],
  }));

  return parts.map((p, i) => {
    const key = `${lineKey}-${i}`;
    if (p.t === "text") return <span key={key}>{p.v}</span>;
    if (p.t === "img") {
      const safe =
        p.src.startsWith("/api/media/") ||
        p.src.startsWith("https://") ||
        p.src.startsWith("http://");
      if (!safe) return <span key={key}>[img]</span>;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={p.src}
          alt={p.alt || "imagen"}
          className="post-image"
          loading="lazy"
        />
      );
    }
    return (
      <a
        key={key}
        href={p.href}
        target="_blank"
        rel="noopener noreferrer"
        className="post-link"
      >
        {p.label}
      </a>
    );
  });
}
