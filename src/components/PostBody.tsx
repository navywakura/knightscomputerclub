import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Components } from "react-markdown";
import LinkEmbed from "@/components/LinkEmbed";
import { renderPlainBody } from "@/lib/markdown";
import type { LinkPreview } from "@/lib/link-preview";

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [
      ...(defaultSchema.attributes?.img || []),
      ["src"],
      ["alt"],
      ["title"],
      ["className"],
      ["loading"],
    ],
    a: [
      ...(defaultSchema.attributes?.a || []),
      ["href"],
      ["target"],
      ["rel"],
      ["className"],
    ],
    code: [...(defaultSchema.attributes?.code || []), ["className"]],
  },
};

const mdComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="post-link"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => {
    const s = typeof src === "string" ? src : "";
    const safe =
      s.startsWith("/api/media/") ||
      s.startsWith("https://") ||
      s.startsWith("http://");
    if (!safe) return <span>[img]</span>;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={s} alt={alt || "imagen"} className="post-image" loading="lazy" />
    );
  },
  pre: ({ children }) => <pre className="post-pre">{children}</pre>,
  code: ({ className, children }) => {
    const multi = Boolean(className);
    if (multi) {
      return <code className={className}>{children}</code>;
    }
    return <code className="post-code-inline">{children}</code>;
  },
  table: ({ children }) => (
    <div className="post-table-wrap">
      <table>{children}</table>
    </div>
  ),
};

type Props = {
  body: string;
  /** full markdown (posts/OP) vs plain (replies/comentarios) */
  mode?: "markdown" | "plain";
  previews?: LinkPreview[];
};

export default function PostBody({
  body,
  mode = "markdown",
  previews = [],
}: Props) {
  const embeds = previews.filter(
    (p) => p.ok || p.title || p.description || p.image
  );

  return (
    <div className={`post-body${mode === "markdown" ? " md" : " plain"}`}>
      {mode === "markdown" ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeSanitize, schema]]}
          components={mdComponents}
        >
          {body}
        </ReactMarkdown>
      ) : (
        <div className="post-plain">{renderPlainBody(body)}</div>
      )}

      {embeds.length > 0 ? (
        <div className="link-embeds">
          {embeds.map((p) => (
            <LinkEmbed key={p.url} preview={p} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
