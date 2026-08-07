import ForumApp from "@/components/forum/ForumApp";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: `// ${slug} — foro · knightscomputer.club` };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  return <ForumApp initialBoard={slug} />;
}
