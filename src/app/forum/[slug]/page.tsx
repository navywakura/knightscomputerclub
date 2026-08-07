import type { Metadata } from "next";
import ForumApp from "@/components/forum/ForumApp";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const path = `/forum/${slug}`;
  return {
    title: `// ${slug}`,
    description: `Board // ${slug} del foro knightscomputer.club — hilos, debate y comunidad del nodo.`,
    alternates: { canonical: path },
    openGraph: {
      title: `// ${slug} · foro`,
      description: `Tablón ${slug} en knightscomputer.club`,
      url: path,
      type: "website",
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  return <ForumApp initialBoard={slug} />;
}
