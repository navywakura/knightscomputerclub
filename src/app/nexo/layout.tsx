import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

/** /nexo requiere sesión (igual que /forum). */
export default async function NexoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser().catch(() => null);
  if (!user || user.banned) {
    redirect("/");
  }
  return children;
}
