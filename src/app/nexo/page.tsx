import type { Metadata } from "next";
import NexoApp from "@/components/nexo/NexoApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "nexo",
  description:
    "Hub // nexo: tablones de usuario (crear = VIP), chat casi real-time y DMs con PIN.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/nexo" },
};

export default function NexoPage() {
  return <NexoApp />;
}
