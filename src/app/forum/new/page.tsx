import ForumApp from "@/components/forum/ForumApp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "nuevo hilo — foro · knightscomputer.club",
};

type Props = { searchParams: Promise<{ cat?: string }> };

export default async function NewThreadPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cat = sp.cat || null;
  return <ForumApp initialBoard={cat} initialMode="new" />;
}
