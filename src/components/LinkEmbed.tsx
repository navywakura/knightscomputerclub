import type { LinkPreview } from "@/lib/link-preview";

export default function LinkEmbed({ preview }: { preview: LinkPreview }) {
  const href = preview.final_url || preview.url;
  let host = "";
  try {
    host = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    host = preview.site_name || "";
  }

  if (!preview.title && !preview.description && !preview.image) {
    return null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="link-embed"
    >
      {preview.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.image}
          alt=""
          className="link-embed-img"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="link-embed-img placeholder" aria-hidden>
          ↗
        </div>
      )}
      <div className="link-embed-body">
        <div className="link-embed-site">
          {preview.site_name || host}
        </div>
        {preview.title ? (
          <div className="link-embed-title">{preview.title}</div>
        ) : null}
        {preview.description ? (
          <div className="link-embed-desc">{preview.description}</div>
        ) : null}
        <div className="link-embed-url">{host}</div>
      </div>
    </a>
  );
}
