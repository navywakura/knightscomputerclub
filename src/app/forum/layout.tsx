import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

/**
 * Foro: miembros ven la app completa.
 * Guests pueden ver posts/hilos compartidos por enlace (páginas hijas).
 * La UI de browse en ForumApp pide login si no hay sesión.
 */
export default async function ForumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser().catch(() => null);
  if (!user || user.banned) {
    return (
      <div className="forum-guest-shell">
        <div className="forum-guest-bar">
          <span className="muted">vista guest · post compartido</span>
          <span className="sep">|</span>
          <Link href="/auth/login?next=/forum">login</Link>
          <span className="sep">|</span>
          <Link href="/auth/register">register</Link>
          <span className="sep">|</span>
          <Link href="/">home</Link>
        </div>
        {children}
      </div>
    );
  }
  return children;
}
