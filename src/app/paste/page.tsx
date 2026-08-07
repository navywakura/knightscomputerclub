import type { Metadata } from "next";
import PasteApp from "@/components/paste/PasteApp";
import Panel from "@/components/Panel";

export const metadata: Metadata = {
  title: "paste ZK",
  description:
    "Pastebin cifrado zero-knowledge. La clave nunca llega al servidor.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/paste" },
};

export default function PasteCreatePage() {
  return (
    <main className="page">
      <Panel title="~/paste · zero_knowledge.sh">
        <PasteApp mode="create" />
      </Panel>
    </main>
  );
}
