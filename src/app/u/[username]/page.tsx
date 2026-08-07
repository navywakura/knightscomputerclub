import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RankBadge from "@/components/RankBadge";
import ShareButton from "@/components/ShareButton";
import { ensureSchema, getDb } from "@/lib/db";
import { parseConnections } from "@/lib/auth";
import { getRank, rankNameClass } from "@/lib/ranks";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

async function loadUser(username: string) {
  try {
    await ensureSchema();
    const db = getDb();
    const uname = username.toLowerCase().replace(/^@/, "");
    const rows = await db`
      SELECT
        id, username, role, is_vip, created_at,
        display_name, avatar_media_id, banner_media_id, bio, connections,
        pgp_fingerprint, pgp_public_key
      FROM users
      WHERE lower(username) = ${uname}
        AND banned IS NOT TRUE
        AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const u = await loadUser(username);
  if (!u) return { title: "usuario" };
  const name = u.display_name
    ? `${u.display_name} (@${u.username})`
    : `@${u.username}`;
  return {
    title: name,
    description: u.bio ? String(u.bio) : `Perfil de @${u.username} en knightscomputer.club`,
    robots: { index: true, follow: true },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const u = await loadUser(username);
  if (!u) notFound();

  const rank = getRank({
    role: String(u.role),
    username: String(u.username),
    is_vip: Boolean(u.is_vip),
  });
  const avatar = u.avatar_media_id
    ? `/api/media/${u.avatar_media_id}`
    : null;
  const banner = u.banner_media_id
    ? `/api/media/${u.banner_media_id}`
    : null;
  const display = u.display_name
    ? String(u.display_name)
    : String(u.username);
  const conns = parseConnections(u.connections);
  const fp = u.pgp_fingerprint ? String(u.pgp_fingerprint) : null;
  const pub = u.pgp_public_key ? String(u.pgp_public_key) : null;

  return (
    <main className="page profile-public">
      <div
        className="profile-public-banner"
        style={banner ? { backgroundImage: `url(${banner})` } : undefined}
      />
      <div className="profile-public-card">
        <div className="profile-public-av">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" />
          ) : (
            <span>{String(u.username).slice(0, 2)}</span>
          )}
        </div>
        <div className="profile-public-heading">
          <h1 className="profile-public-name">
            <span className={rankNameClass(rank) || ""}>{display}</span>{" "}
            {rank ? <RankBadge rank={rank} /> : null}
          </h1>
          <ShareButton
            path={`/u/${encodeURIComponent(String(u.username))}`}
            title={`@${String(u.username)} · knightscomputer.club`}
            text={
              u.bio
                ? `${display} (@${String(u.username)}) — ${String(u.bio)}`
                : `Perfil de @${String(u.username)} en knightscomputer.club`
            }
            label="[ compartir perfil ]"
            className="profile-share-btn"
          />
        </div>
        <p className="muted">
          @{String(u.username)} · miembro desde{" "}
          {new Date(String(u.created_at)).toLocaleDateString()}
        </p>
        {u.bio ? <p className="profile-public-bio">{String(u.bio)}</p> : null}

        {Object.keys(conns).length > 0 ? (
          <div className="profile-public-links">
            {conns.github ? (
              <a href={conns.github} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            ) : null}
            {conns.twitter ? (
              <a href={conns.twitter} target="_blank" rel="noopener noreferrer">
                X
              </a>
            ) : null}
            {conns.website ? (
              <a href={conns.website} target="_blank" rel="noopener noreferrer">
                web
              </a>
            ) : null}
            {conns.discord ? (
              <span className="muted">discord: {conns.discord}</span>
            ) : null}
          </div>
        ) : null}

        {fp || pub ? (
          <section className="profile-public-pgp">
            <h2>PGP</h2>
            {fp ? (
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                fingerprint: <code>{fp}</code>
              </p>
            ) : null}
            {pub ? (
              <pre className="profile-pgp-block">{pub}</pre>
            ) : null}
          </section>
        ) : null}

        <div className="compose-toolbar profile-public-actions" style={{ marginTop: 16 }}>
          <ShareButton
            path={`/u/${encodeURIComponent(String(u.username))}`}
            title={`@${String(u.username)} · knightscomputer.club`}
            text={
              u.bio
                ? `${display} (@${String(u.username)}) — ${String(u.bio)}`
                : `Perfil de @${String(u.username)} en knightscomputer.club`
            }
            label="[ compartir ]"
            className="btn secondary"
          />
          <Link href={`/nexo?dm_user=${encodeURIComponent(String(u.username))}`} className="btn">
            [ DM en nexo ]
          </Link>
          <Link href="/forum" className="btn secondary">
            [ foro ]
          </Link>
          <Link href="/" className="btn secondary">
            [ home ]
          </Link>
        </div>
      </div>
    </main>
  );
}
