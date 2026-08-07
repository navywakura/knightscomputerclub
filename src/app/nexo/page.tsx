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
  searchParams: Promise<{
    join?: string;
    dm?: string;
    board?: string;
    dm_user?: string;
  }>;
};

export default async function NexoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const join = (sp.join || "").trim();
  const dmRaw = (sp.dm || "").trim();
  const dmId = dmRaw && /^\d+$/.test(dmRaw) ? Number(dmRaw) : null;
  const boardRaw = (sp.board || "").trim();
  const boardId =
    boardRaw && /^\d+$/.test(boardRaw) ? Number(boardRaw) : null;
  const dmUser = (sp.dm_user || "").trim().replace(/^@/, "") || null;

  const user = await getSessionUser().catch(() => null);
  if (!user || user.banned) {
    let next = "/nexo";
    if (join) next = nexoInvitePath(join);
    else if (dmId) next = `/nexo?dm=${dmId}`;
    else if (boardId) next = `/nexo?board=${boardId}`;
    else if (dmUser) next = `/nexo?dm_user=${encodeURIComponent(dmUser)}`;
    redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <NexoApp
      initialJoinSlug={join || null}
      initialDmId={dmId}
      initialBoardId={boardId}
      initialDmUser={dmUser}
    />
  );
}
