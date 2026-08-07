"use client";

import type { ReactNode } from "react";
import { isDesktopShell } from "@/lib/platform";

/**
 * Cuerpo de mensaje Nexo:
 * - @menciones, **bold**, *italic*, `code`
 * - imágenes / GIFs Tenor ![alt](url)
 * - PDF y adjuntos → abrir en navegador externo (no embebido)
 */
export default function NexoChatBody({
  body,
  myUsername,
}: {
  body: string;
  myUsername?: string | null;
}) {
  const me = (myUsername || "").toLowerCase();
  const text = String(body || "");

  let pingMe = false;
  const mentionScan = /(^|[^a-zA-Z0-9_])(@[a-zA-Z0-9_\-]{2,32})\b/g;
  let sc: RegExpExecArray | null;
  while ((sc = mentionScan.exec(text))) {
    if (me && sc[2].slice(1).toLowerCase() === me) {
      pingMe = true;
      break;
    }
  }

  const lines = text.split("\n");
  const out: ReactNode[] = [];
  lines.forEach((line, li) => {
    if (li > 0) out.push(<br key={`br-${li}`} />);
    out.push(...renderLine(line, li, me));
  });

  return (
    <div className={`nexo-msg-body${pingMe ? " ping-me" : ""}`}>{out}</div>
  );
}

function isSafeImgUrl(src: string): boolean {
  if (src.startsWith("/api/media/")) return true;
  // Giphy CDN
  if (/^https:\/\/([a-z0-9.-]+\.)?giphy\.com\//i.test(src)) return true;
  if (/^https:\/\/media\d*\.giphy\.com\//i.test(src)) return true;
  if (src.startsWith("https://i.giphy.com/")) return true;
  // legacy Tenor embeds (mensajes viejos)
  if (/^https:\/\/([a-z0-9.-]+\.)?tenor\.com\//i.test(src)) return true;
  if (src.startsWith("https://media.tenor.com/")) return true;
  if (src.startsWith("https://c.tenor.com/")) return true;
  if (src.startsWith("https://")) return true;
  return false;
}

function isPdfLink(href: string, label: string): boolean {
  const h = href.toLowerCase();
  const l = label.toLowerCase();
  if (l.includes("📎") || l.endsWith(".pdf")) return true;
  if (h.includes(".pdf")) return true;
  if (h.includes("/api/media/") && h.includes("download")) return true;
  return false;
}

function toAbsolute(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (typeof window === "undefined") return href;
  if (href.startsWith("/")) return `${window.location.origin}${href}`;
  return href;
}

function openExternal(href: string) {
  const url = toAbsolute(href);
  const w = window as Window & {
    electronAPI?: { openExternal?: (u: string) => void };
  };
  if (w.electronAPI?.openExternal) {
    w.electronAPI.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

type Part =
  | { t: "text"; v: string }
  | { t: "img"; alt: string; src: string }
  | { t: "a"; label: string; href: string };

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

function renderLine(line: string, lineKey: number, me: string): ReactNode[] {
  let parts: Part[] = [{ t: "text", v: line }];

  parts = splitOn(parts, /!\[([^\]]*)\]\(([^)\s]+)\)/g, (m) => ({
    t: "img",
    alt: m[1],
    src: m[2],
  }));
  parts = splitOn(parts, /\[([^\]]+)\]\(([^)\s]+)\)/g, (m) => ({
    t: "a",
    label: m[1],
    href: m[2],
  }));
  parts = splitOn(parts, /(https?:\/\/[^\s<]+[^\s<.,;:!?"')\]])/g, (m) => ({
    t: "a",
    label: m[1],
    href: m[1],
  }));

  const nodes: ReactNode[] = [];
  let i = 0;
  for (const p of parts) {
    const key = `${lineKey}-${i++}`;
    if (p.t === "img") {
      if (!isSafeImgUrl(p.src)) {
        nodes.push(<span key={key}>[img]</span>);
        continue;
      }
      const isGif =
        /giphy\.com/i.test(p.src) ||
        /tenor\.com/i.test(p.src) ||
        /\.gif(\?|$)/i.test(p.src) ||
        /gif/i.test(p.alt);
      nodes.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          src={p.src}
          alt={p.alt || (isGif ? "gif" : "imagen")}
          className={isGif ? "nexo-msg-gif" : "nexo-msg-img"}
          loading="lazy"
        />
      );
      continue;
    }
    if (p.t === "a") {
      const safe =
        p.href.startsWith("/api/media/") ||
        p.href.startsWith("https://") ||
        p.href.startsWith("http://") ||
        p.href.startsWith("/");
      if (!safe) {
        nodes.push(<span key={key}>{p.label}</span>);
        continue;
      }
      if (isPdfLink(p.href, p.label)) {
        let href = p.href;
        if (!href.includes("download=")) {
          href += href.includes("?") ? "&download=1" : "?download=1";
        }
        nodes.push(
          <button
            key={key}
            type="button"
            className="nexo-pdf-link"
            title="Abrir PDF en navegador externo"
            onClick={() => openExternal(href)}
          >
            {p.label.includes("📎") ? p.label : `📎 ${p.label}`}
          </button>
        );
        continue;
      }
      nodes.push(
        <a
          key={key}
          href={p.href}
          target="_blank"
          rel="noopener noreferrer"
          className="post-link"
          onClick={(e) => {
            if (isDesktopShell() && /^https?:\/\//i.test(p.href)) {
              e.preventDefault();
              openExternal(p.href);
            }
          }}
        >
          {p.label}
        </a>
      );
      continue;
    }
    nodes.push(...renderRichText(p.v, key, me));
  }
  return nodes;
}

type Rich =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "bold"; v: string }
  | { t: "em"; v: string }
  | { t: "mention"; v: string };

function renderRichText(text: string, keyPrefix: string, me: string): ReactNode[] {
  let toks: Rich[] = [{ t: "text", v: text }];

  function wrap(
    re: RegExp,
    kind: "code" | "bold" | "em",
    group = 1
  ) {
    const next: Rich[] = [];
    for (const tok of toks) {
      if (tok.t !== "text") {
        next.push(tok);
        continue;
      }
      re.lastIndex = 0;
      let last = 0;
      let m: RegExpExecArray | null;
      const s = tok.v;
      while ((m = re.exec(s))) {
        if (m.index > last) next.push({ t: "text", v: s.slice(last, m.index) });
        next.push({ t: kind, v: m[group] });
        last = m.index + m[0].length;
      }
      if (last < s.length) next.push({ t: "text", v: s.slice(last) });
    }
    toks = next;
  }

  wrap(/`([^`]+)`/g, "code");
  wrap(/\*\*([^*]+)\*\*/g, "bold");
  wrap(/\*([^*\n]+)\*/g, "em");

  // mentions
  {
    const next: Rich[] = [];
    const re = /(^|[^a-zA-Z0-9_])(@[a-zA-Z0-9_\-]{2,32})\b/g;
    for (const tok of toks) {
      if (tok.t !== "text") {
        next.push(tok);
        continue;
      }
      re.lastIndex = 0;
      let last = 0;
      let m: RegExpExecArray | null;
      const s = tok.v;
      while ((m = re.exec(s))) {
        const prefix = m[1] || "";
        const endPrefix = m.index + prefix.length;
        if (endPrefix > last) next.push({ t: "text", v: s.slice(last, endPrefix) });
        next.push({ t: "mention", v: m[2] });
        last = m.index + m[0].length;
      }
      if (last < s.length) next.push({ t: "text", v: s.slice(last) });
    }
    toks = next;
  }

  return toks.map((tok, i) => {
    const key = `${keyPrefix}-r${i}`;
    if (tok.t === "code")
      return (
        <code key={key} className="nexo-md-code">
          {tok.v}
        </code>
      );
    if (tok.t === "bold")
      return (
        <strong key={key} className="nexo-md-bold">
          {tok.v}
        </strong>
      );
    if (tok.t === "em")
      return (
        <em key={key} className="nexo-md-em">
          {tok.v}
        </em>
      );
    if (tok.t === "mention") {
      const mine = me && tok.v.slice(1).toLowerCase() === me;
      return (
        <span key={key} className={`nexo-mention${mine ? " me" : ""}`}>
          {tok.v}
        </span>
      );
    }
    return <span key={key}>{tok.v}</span>;
  });
}
