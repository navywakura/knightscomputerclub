import type { Metadata } from "next";
import ForumApp from "@/components/forum/ForumApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "foro",
  description:
    "Foro del nodo knightscomputer.club: general, RXos, debate, ops y offtopic (random, memes, anime, ciencia). Sin feed algorítmico.",
  alternates: { canonical: "/forum" },
  openGraph: {
    title: "Foro · knightscomputer.club",
    description:
      "Boards del nodo: RXos, debate, ops, offtopic. Texto, hilos y comunidad.",
    url: "/forum",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Foro · knightscomputer.club",
    description: "Categorías, hilos y debate del nodo tecnoactivista.",
  },
  keywords: [
    "foro",
    "RXos",
    "debate",
    "offtopic",
    "tecnoactivismo",
    "knightscomputer",
  ],
};

export default function ForumIndexPage() {
  return <ForumApp />;
}
