import ForumApp from "@/components/forum/ForumApp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "foro — knightscomputer.club",
  description: "Foro del nodo: categorías, hilos, debate y RXos",
};

export default function ForumIndexPage() {
  return <ForumApp />;
}
