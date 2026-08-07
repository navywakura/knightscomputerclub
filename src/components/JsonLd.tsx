import { getSiteUrl } from "@/lib/site";

type Props = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

/** JSON-LD para rich results (Organization, WebSite, etc.) */
export default function JsonLd({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function siteJsonLd() {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: base,
        name: "knightscomputer.club",
        description:
          "Nodo tecnoactivista: foro, donaciones y desarrollo de RXos.",
        inLanguage: "es",
        publisher: { "@id": `${base}/#org` },
      },
      {
        "@type": "Organization",
        "@id": `${base}/#org`,
        name: "Knights Labs / knightscomputer.club",
        url: base,
        logo: {
          "@type": "ImageObject",
          url: `${base}/knightslabs_logo.png`,
          width: 512,
          height: 512,
        },
        description:
          "Nodo underground de computación libre, RXos y debate tecnoactivista.",
      },
      {
        "@type": "WebPage",
        "@id": `${base}/#home`,
        url: base,
        name: "knightscomputer.club — lobby",
        isPartOf: { "@id": `${base}/#website` },
        about: { "@id": `${base}/#org` },
        inLanguage: "es",
      },
    ],
  };
}
