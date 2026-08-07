import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

/**
 * /forum es exclusivo para usuarios registrados (sesión activa).
 * Visitantes sin login → home.
 */
export default async function ForumLayout({
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
