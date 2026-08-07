import type { Metadata } from "next";
import PasteApp from "@/components/paste/PasteApp";
import Panel from "@/components/Panel";

export const metadata: Metadata = {
  title: "paste",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function PasteViewPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="page">
      <Panel title="~/paste · decrypt">
        <PasteApp mode="view" pasteId={id} />
      </Panel>
    </main>
  );
}
