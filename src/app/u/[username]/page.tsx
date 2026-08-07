import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RankBadge from "@/components/RankBadge";
import ShareButton from "@/components/ShareButton";
import ProfileMusicPlayer from "@/components/ProfileMusicPlayer";
import { ensureSchema, getDb } from "@/lib/db";
import { parseConnections } from "@/lib/auth";
import { getRank, rankNameClass } from "@/lib/ranks";
import { excerptBody } from "@/lib/markdown";
import {
  getProfileTheme,
  profileThemeStyle,
} from "@/lib/profile-themes";
import {
  buildProfileCustomCss,
  parseProfileCustom,
} from "@/lib/profile-css";

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
        profile_theme, profile_music_media_id, profile_custom,
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

async function loadUserPosts(userId: number) {
  try {
    const db = getDb();
    const rows = await db`
      SELECT
        p.id,
        p.body,
        p.created_at,
        p.thread_id,
        t.title AS thread_title,
        c.slug AS category_slug,
        c.name AS category_name
      FROM posts p
      JOIN threads t ON t.id = p.thread_id
      JOIN categories c ON c.id = t.category_id
      WHERE p.author_id = ${userId}
      ORDER BY p.created_at DESC
      LIMIT 40
    `;
    return rows as Array<{
      id: number;
      body: string;
      created_at: string;
      thread_id: number;
      thread_title: string;
      category_slug: string;
      category_name: string;
    }>;
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const u = await loadUser(username);
  if (!u) {
    return {
      title: "usuario",
      robots: { index: false, follow: true },
    };
  }
  const handle = String(u.username);
  const name = u.display_name
    ? `${u.display_name} (@${handle})`
    : `@${handle}`;
  const description = u.bio
    ? String(u.bio).slice(0, 180)
    : `Perfil de @${handle} en knightscomputer.club — nodo tecnoactivista`;
  const path = `/u/${encodeURIComponent(handle)}`;
  const ogImage = `${path}/opengraph-image`;

  return {
    title: name,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: path },
    openGraph: {
      title: name,
      description,
      type: "profile",
      url: path,
      siteName: "knightscomputer.club",
      locale: "es_ES",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      images: [ogImage],
    },
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
  const userBanner = u.banner_media_id
    ? `/api/media/${u.banner_media_id}`
    : null;
  const display = u.display_name
    ? String(u.display_name)
    : String(u.username);
  const conns = parseConnections(u.connections);
  const fp = u.pgp_fingerprint ? String(u.pgp_fingerprint) : null;
  const pub = u.pgp_public_key ? String(u.pgp_public_key) : null;
  const theme = getProfileTheme(u.profile_theme);
  const themeStyle = profileThemeStyle(theme);
  const bannerUrl = userBanner || theme.banner;
  const musicUrl = u.profile_music_media_id
    ? `/api/media/${u.profile_music_media_id}`
    : null;
  const custom = parseProfileCustom(u.profile_custom);
  const customCss = buildProfileCustomCss(String(u.username), custom);
  const handle = String(u.username);
  const posts = await loadUserPosts(Number(u.id));

  return (
    <main
      className={`page profile-public profile-theme profile-theme-${theme.id}`}
      style={themeStyle as CSSProperties}
      data-theme={theme.id}
      data-profile-user={handle}
    >
      {customCss ? (
        <style
          dangerouslySetInnerHTML={{ __html: customCss }}
          data-profile-custom=""
        />
      ) : null}
      <div className="profile-theme-bg" aria-hidden />

      {theme.decors[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="profile-decor profile-decor-a"
          src={theme.decors[0]}
          alt=""
        />
      ) : null}
      {theme.decors[1] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="profile-decor profile-decor-b"
          src={theme.decors[1]}
          alt=""
        />
      ) : null}

      {musicUrl ? (
        <ProfileMusicPlayer
          src={musicUrl}
          label={`@${handle} · soundtrack`}
        />
      ) : null}

      {/* banner + card pegados */}
      <div className="profile-public-shell">
        <div
          className="profile-public-banner"
          style={{ backgroundImage: `url(${bannerUrl})` }}
        />
        <div className="profile-public-card">
          <div className="profile-public-av">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" />
            ) : (
              <span>{handle.slice(0, 2)}</span>
            )}
          </div>
          <div className="profile-public-heading">
            <h1 className="profile-public-name">
              <span className={rankNameClass(rank) || ""}>{display}</span>{" "}
              {rank ? <RankBadge rank={rank} /> : null}
            </h1>
            <ShareButton
              path={`/u/${encodeURIComponent(handle)}`}
              title={`@${handle} · knightscomputer.club`}
              text={
                u.bio
                  ? `${display} (@${handle}) — ${String(u.bio)}`
                  : `Perfil de @${handle} en knightscomputer.club`
              }
              label="[ compartir perfil ]"
              className="profile-share-btn"
            />
          </div>
          <p className="profile-public-meta">
            @{handle} · miembro desde{" "}
            {new Date(String(u.created_at)).toLocaleDateString()}
            <span className="profile-theme-badge"> · tema: {theme.name}</span>
          </p>
          {u.bio ? (
            <p className="profile-public-bio">{String(u.bio)}</p>
          ) : null}

          {Object.keys(conns).length > 0 ? (
            <div className="profile-public-links">
              {conns.github ? (
                <a
                  href={conns.github}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              ) : null}
              {conns.twitter ? (
                <a
                  href={conns.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  X
                </a>
              ) : null}
              {conns.website ? (
                <a
                  href={conns.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  web
                </a>
              ) : null}
              {conns.discord ? (
                <span className="profile-public-meta">
                  discord: {conns.discord}
                </span>
              ) : null}
            </div>
          ) : null}

          {fp || pub ? (
            <section className="profile-public-pgp">
              <h2>PGP</h2>
              {fp ? (
                <p
                  className="profile-public-meta"
                  style={{ fontSize: "0.85rem" }}
                >
                  fingerprint: <code>{fp}</code>
                </p>
              ) : null}
              {pub ? <pre className="profile-pgp-block">{pub}</pre> : null}
            </section>
          ) : null}

          <div className="compose-toolbar profile-public-actions">
            <ShareButton
              path={`/u/${encodeURIComponent(handle)}`}
              title={`@${handle} · knightscomputer.club`}
              text={
                u.bio
                  ? `${display} (@${handle}) — ${String(u.bio)}`
                  : `Perfil de @${handle} en knightscomputer.club`
              }
              label="[ compartir ]"
              className="btn secondary"
            />
            <Link
              href={`/nexo?dm_user=${encodeURIComponent(handle)}`}
              className="btn"
            >
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
      </div>

      {/* feed de posts del usuario */}
      <section className="profile-feed" aria-label="publicaciones">
        <h2 className="profile-feed-title">
          publicaciones{" "}
          <span className="profile-public-meta">
            ({posts.length}
            {posts.length >= 40 ? "+" : ""})
          </span>
        </h2>
        {posts.length === 0 ? (
          <p className="profile-public-meta profile-feed-empty">
            todavía no hay posts en el foro de este usuario.
          </p>
        ) : (
          <ul className="profile-feed-list">
            {posts.map((p) => {
              const excerpt = excerptBody(String(p.body || ""), 220);
              const when = new Date(String(p.created_at)).toLocaleString();
              return (
                <li key={p.id} className="profile-feed-item">
                  <div className="profile-feed-item-head">
                    <Link
                      href={`/forum/thread/${p.thread_id}`}
                      className="profile-feed-thread"
                    >
                      {String(p.thread_title)}
                    </Link>
                    <span className="profile-feed-meta">
                      <Link href={`/forum/${p.category_slug}`}>
                        {String(p.category_name)}
                      </Link>
                      {" · "}
                      {when}
                    </span>
                  </div>
                  <p className="profile-feed-excerpt">{excerpt || "…"}</p>
                  <div className="profile-feed-item-foot">
                    <Link
                      href={`/forum/post/${p.id}`}
                      className="profile-feed-open"
                    >
                      ver post →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
