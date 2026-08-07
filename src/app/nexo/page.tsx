import type { Metadata } from "next";
import { redirect } from "next/navigation";
import NexoApp from "@/components/nexo/NexoApp";
import { getSessionUser } from "@/lib/auth";
import { nexoInvitePath } from "@/lib/auth-redirect";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "nexo",
  description:
    "Hub // nexo: tablones de usuario (crear = VIP), chat casi real-time y DMs con PIN.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/nexo" },
};

type Props = {
  searchParams: Promise<{ join?: string; dm?: string }>;
};

export default async function NexoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const join = (sp.join || "").trim();
  const dmRaw = (sp.dm || "").trim();
  const dmId = dmRaw && /^\d+$/.test(dmRaw) ? Number(dmRaw) : null;

  const user = await getSessionUser().catch(() => null);
  if (!user || user.banned) {
    let next = "/nexo";
    if (join) next = nexoInvitePath(join);
    else if (dmId) next = `/nexo?dm=${dmId}`;
    redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <NexoApp
      initialJoinSlug={join || null}
      initialDmId={dmId}
    />
  );
}
