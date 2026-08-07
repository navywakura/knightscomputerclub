import Link from "next/link";
import Panel from "@/components/Panel";
import AdminPanel from "@/components/AdminPanel";
import { getOwnerSession } from "@/lib/admin";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "admin — knightscomputer.club",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const owner = await getOwnerSession();
  if (!owner) {
    const user = await getSessionUser().catch(() => null);
    return (
      <Panel title="~/admin · denied">
        <h1>ACCESS DENIED</h1>
        <p className="muted">
          Solo el owner del nodo puede usar este panel.
        </p>
        {!user ? (
          <p>
            <Link href="/auth/login">login</Link> como roger y volvé a{" "}
            <Link href="/admin">/admin</Link>.
          </p>
        ) : (
          <p>
            sesión actual: @{user.username} ·{" "}
            <Link href="/forum">← foro</Link>
          </p>
        )}
      </Panel>
    );
  }

  return (
    <>
      <div className="breadcrumbs">
        <Link href="/">home</Link> / admin
      </div>
      <Panel title="~/admin · owner.panel">
        <h1 className="glow">PANEL OWNER</h1>
        <p className="muted">
          sesión: <strong>@{owner.username}</strong> · role {owner.role}
        </p>
        <p>
          Moderación simple: ban/unban, VIP, borrar posts e hilos. Sin
          dashboards corporativos.
        </p>
      </Panel>
      <Panel title="~/admin · tools.sh">
        <AdminPanel />
      </Panel>
    </>
  );
}
