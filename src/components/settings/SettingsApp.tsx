"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import RankBadge from "@/components/RankBadge";
import { apiFetch } from "@/lib/platform";
import { getRank, rankNameClass } from "@/lib/ranks";
import {
  ensureNotifyPermission,
  canUseDesktopNotify,
} from "@/lib/browser-notify";
import { isUiSfxEnabled, setUiSfxEnabled, playUiSfx } from "@/lib/ui-sfx";

type Tab = "profile" | "friends" | "privacy" | "account";

type Conn = {
  github?: string;
  twitter?: string;
  website?: string;
  discord?: string;
  youtube?: string;
};

type Me = {
  id: number;
  username: string;
  role: string;
  is_vip?: boolean;
  display_name?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string;
  dm_privacy?: "everyone" | "friends";
  connections?: Conn;
  email_verified?: boolean;
  email?: string;
  pending_deletion?: boolean;
};

type FriendUser = {
  friendship_id: number;
  id: number;
  username: string;
  display_name: string | null;
  role: string;
  is_vip: boolean;
  avatar_url: string | null;
};

type Props = { initialTab?: Tab | null };

export default function SettingsApp({ initialTab = "profile" }: Props) {
  const [tab, setTab] = useState<Tab>(
    initialTab === "friends" ||
      initialTab === "privacy" ||
      initialTab === "account"
      ? initialTab
      : "profile"
  );
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  // profile form
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [dmPrivacy, setDmPrivacy] = useState<"everyone" | "friends">("everyone");
  const [conn, setConn] = useState<Conn>({});
  const [avatarId, setAvatarId] = useState<number | null>(null);
  const [bannerId, setBannerId] = useState<number | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pgpKey, setPgpKey] = useState("");
  const [pgpFp, setPgpFp] = useState("");

  // friends
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<FriendUser[]>([]);
  const [outgoing, setOutgoing] = useState<FriendUser[]>([]);
  const [friendUser, setFriendUser] = useState("");
  const [notifyPerm, setNotifyPerm] = useState<string>("");
  const [uiSfx, setUiSfx] = useState(true);

  const vip = Boolean(me?.is_vip || me?.role === "owner");

  const loadMe = useCallback(async () => {
    const res = await apiFetch("/api/auth/me");
    const d = await res.json();
    if (!d.user) {
      setMe(null);
      return;
    }
    const u = d.user as Me;
    setMe(u);
    setDisplayName(u.display_name || "");
    setUsername(u.username || "");
    setBio(u.bio || "");
    setDmPrivacy(u.dm_privacy === "friends" ? "friends" : "everyone");
    setConn(u.connections || {});
    setAvatarPreview(u.avatar_url || null);
    setBannerPreview(u.banner_url || null);
    setPgpKey(
      (u as Me & { pgp_public_key?: string }).pgp_public_key || ""
    );
    setPgpFp(
      (u as Me & { pgp_fingerprint?: string }).pgp_fingerprint || ""
    );
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const res = await apiFetch("/api/friends");
      const d = await res.json();
      if (!res.ok) return;
      setFriends(d.friends || []);
      setIncoming(d.incoming || []);
      setOutgoing(d.outgoing || []);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadMe();
        await loadFriends();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe, loadFriends]);

  useEffect(() => {
    if (canUseDesktopNotify()) {
      setNotifyPerm(Notification.permission);
    } else {
      setNotifyPerm("unsupported");
    }
    setUiSfx(isUiSfxEnabled());
  }, []);

  async function uploadMedia(file: File): Promise<number | null> {
    if (!file.type.startsWith("image/")) {
      setError("solo imágenes (jpeg/png/webp/gif)");
      return null;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("imagen > 8MB");
      return null;
    }
    const form = new FormData();
    form.append("file", file, file.name || "photo.jpg");
    const res = await fetch("/api/media", {
      method: "POST",
      body: form,
      credentials: "include",
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(d.error || "error al subir");
      // mensajes más claros para el usuario
      if (d.code === "nsfw_blocked") {
        setError(`moderación: ${msg}`);
      } else {
        setError(msg);
      }
      return null;
    }
    const id = Number(d.id);
    if (!Number.isFinite(id)) {
      setError("respuesta de upload inválida");
      return null;
    }
    return id;
  }

  async function onAvatarPick(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const id = await uploadMedia(file);
      if (id) {
        setAvatarId(id);
        setAvatarPreview(`/api/media/${id}`);
      }
    } finally {
      setUploading(false);
    }
  }

  async function onBannerPick(file: File | null) {
    if (!file) return;
    if (!vip) {
      setError("banner de perfil es exclusivo [VIP]");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const id = await uploadMedia(file);
      if (id) {
        setBannerId(id);
        setBannerPreview(`/api/media/${id}`);
      }
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    try {
      const payload: Record<string, unknown> = {
        display_name: displayName,
        username,
        bio,
        dm_privacy: dmPrivacy,
        connections: conn,
        pgp_public_key: pgpKey,
        pgp_fingerprint: pgpFp,
      };
      if (avatarId !== null) payload.avatar_media_id = avatarId;
      if (bannerId !== null) payload.banner_media_id = bannerId;

      const res = await apiFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error al guardar");
        return;
      }
      setMe(d.user);
      setOk("perfil guardado");
      setAvatarId(null);
      setBannerId(null);
    } catch {
      setError("red caída");
    } finally {
      setSaving(false);
    }
  }

  async function friendAction(
    action: string,
    extra: Record<string, unknown> = {}
  ) {
    setError("");
    setOk("");
    try {
      const res = await apiFetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error");
        return;
      }
      setOk(
        action === "request"
          ? "solicitud enviada"
          : action === "accept"
            ? "amistad aceptada"
            : "ok"
      );
      setFriendUser("");
      await loadFriends();
    } catch {
      setError("red caída");
    }
  }

  async function deleteAccount() {
    if (!me) return;
    const confirm = window.prompt(
      `Escribí tu username (${me.username}) o DELETE para confirmar eliminación (7 días):`
    );
    if (!confirm) return;
    setError("");
    try {
      const res = await apiFetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "error");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("red caída");
    }
  }

  if (loading) {
    return (
      <div className="settings-app">
        <p className="muted">cargando configuración…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="settings-app">
        <div className="form-error">
          login requerido.{" "}
          <Link href="/auth/login?next=/settings">entrar</Link>
        </div>
      </div>
    );
  }

  const rank = getRank({
    role: me.role,
    username: me.username,
    is_vip: me.is_vip,
  });

  return (
    <div className="settings-app">
      <header className="settings-head">
        <h1 className="settings-title">
          // configuración
        </h1>
        <p className="muted">
          perfil, amigos, privacidad de DMs
          {me.email_verified ? (
            <span className="tag ok"> email ok</span>
          ) : (
            <span className="tag"> email sin verificar</span>
          )}
        </p>
      </header>

      <div className="settings-tabs">
        {(
          [
            ["profile", "perfil"],
            ["friends", "amigos"],
            ["privacy", "privacidad"],
            ["account", "cuenta"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "on" : ""}
            onClick={() => {
              setTab(id);
              setError("");
              setOk("");
            }}
          >
            {label}
            {id === "friends" && incoming.length > 0
              ? ` (${incoming.length})`
              : ""}
          </button>
        ))}
      </div>

      {error && <div className="form-error">{error}</div>}
      {ok && <div className="form-ok">{ok}</div>}

      {tab === "profile" && (
        <form className="settings-form" onSubmit={saveProfile}>
          <div
            className="settings-banner"
            style={
              bannerPreview
                ? { backgroundImage: `url(${bannerPreview})` }
                : undefined
            }
          >
            <div className="settings-banner-actions">
              {vip ? (
                <label className="btn secondary settings-file-btn">
                  {uploading ? "…" : "banner [VIP]"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hidden
                    disabled={uploading}
                    onChange={(e) =>
                      void onBannerPick(e.target.files?.[0] || null)
                    }
                  />
                </label>
              ) : (
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  banner = perk VIP · <Link href="/donate">donate</Link>
                </span>
              )}
            </div>
          </div>

          <div className="settings-avatar-row">
            <div className="settings-avatar">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="" />
              ) : (
                <span>{me.username.slice(0, 2)}</span>
              )}
            </div>
            <div>
              <label className="btn secondary settings-file-btn">
                {uploading ? "subiendo…" : "foto de perfil"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  disabled={uploading}
                  onChange={(e) =>
                    void onAvatarPick(e.target.files?.[0] || null)
                  }
                />
              </label>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
                <span className={rankNameClass(rank) || ""}>
                  @{me.username}
                </span>{" "}
                {rank ? <RankBadge rank={rank} /> : null}
              </p>
            </div>
          </div>

          <label htmlFor="s-dn">nombre visible</label>
          <input
            id="s-dn"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={64}
            placeholder="cómo te ven los demás"
          />

          <label htmlFor="s-user">username</label>
          <input
            id="s-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_\-]+"
          />

          <label htmlFor="s-bio">biografía</label>
          <textarea
            id="s-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 100))}
            maxLength={100}
            rows={3}
            placeholder="máx 100 caracteres"
          />
          <p className="muted" style={{ fontSize: "0.75rem" }}>
            {bio.length}/100
          </p>

          <h3 className="settings-sub">conexiones</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            enlaces a redes externas (como Discord)
          </p>
          {(
            [
              ["github", "GitHub"],
              ["twitter", "X / Twitter"],
              ["website", "Website"],
              ["discord", "Discord"],
              ["youtube", "YouTube"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`s-c-${key}`}>{label}</label>
              <input
                id={`s-c-${key}`}
                value={conn[key] || ""}
                onChange={(e) =>
                  setConn((c) => ({ ...c, [key]: e.target.value }))
                }
                placeholder={
                  key === "discord"
                    ? "usuario o invite"
                    : key === "github"
                      ? "user o https://github.com/…"
                      : "https://…"
                }
                maxLength={200}
              />
            </div>
          ))}

          <h3 className="settings-sub">PGP (clave pública)</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Vinculá tu clave pública para verificar identidad en /nexo y el
            foro. Se muestra en tu perfil público.
          </p>
          <label htmlFor="s-pgp-fp">fingerprint (hex)</label>
          <input
            id="s-pgp-fp"
            value={pgpFp}
            onChange={(e) => setPgpFp(e.target.value)}
            placeholder="ABCD1234…"
            maxLength={64}
          />
          <label htmlFor="s-pgp-key">bloque PUBLIC KEY</label>
          <textarea
            id="s-pgp-key"
            value={pgpKey}
            onChange={(e) => setPgpKey(e.target.value.slice(0, 12000))}
            rows={6}
            placeholder={"-----BEGIN PGP PUBLIC KEY BLOCK-----\n…"}
          />

          <div className="compose-toolbar" style={{ marginTop: 16 }}>
            <button className="btn" type="submit" disabled={saving || uploading}>
              {saving ? "guardando…" : "[ guardar perfil ]"}
            </button>
          </div>
        </form>
      )}

      {tab === "friends" && (
        <div className="settings-friends">
          <form
            className="settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              void friendAction("request", { username: friendUser });
            }}
          >
            <label htmlFor="s-friend">enviar solicitud</label>
            <div className="settings-inline">
              <input
                id="s-friend"
                value={friendUser}
                onChange={(e) => setFriendUser(e.target.value)}
                placeholder="@usuario"
                required
              />
              <button className="btn" type="submit">
                enviar
              </button>
            </div>
          </form>

          {incoming.length > 0 && (
            <section>
              <h3 className="settings-sub">entrantes</h3>
              <ul className="settings-user-list">
                {incoming.map((f) => (
                  <li key={f.friendship_id}>
                    <FriendRow f={f} />
                    <div className="settings-inline">
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          void friendAction("accept", {
                            friendship_id: f.friendship_id,
                          })
                        }
                      >
                        aceptar
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() =>
                          void friendAction("reject", {
                            friendship_id: f.friendship_id,
                          })
                        }
                      >
                        rechazar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {outgoing.length > 0 && (
            <section>
              <h3 className="settings-sub">salientes</h3>
              <ul className="settings-user-list">
                {outgoing.map((f) => (
                  <li key={f.friendship_id}>
                    <FriendRow f={f} />
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() =>
                        void friendAction("cancel", {
                          friendship_id: f.friendship_id,
                        })
                      }
                    >
                      cancelar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="settings-sub">
              amigos ({friends.length})
            </h3>
            {friends.length === 0 ? (
              <p className="muted">sin amigos aún.</p>
            ) : (
              <ul className="settings-user-list">
                {friends.map((f) => (
                  <li key={f.friendship_id}>
                    <FriendRow f={f} />
                    <div className="settings-inline">
                      <Link
                        className="btn secondary"
                        href={`/nexo?dm_user=${encodeURIComponent(f.username)}`}
                      >
                        DM
                      </Link>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() =>
                          void friendAction("remove", { user_id: f.id })
                        }
                      >
                        quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === "privacy" && (
        <form className="settings-form" onSubmit={saveProfile}>
          <h3 className="settings-sub">mensajes privados</h3>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Quién puede abrirte un DM en // nexo. Si elegís solo amigos, el
            resto debe enviarte solicitud de amistad primero.
          </p>
          <label className="settings-radio">
            <input
              type="radio"
              name="dm_privacy"
              checked={dmPrivacy === "everyone"}
              onChange={() => setDmPrivacy("everyone")}
            />
            cualquiera (con PIN de conversación)
          </label>
          <label className="settings-radio">
            <input
              type="radio"
              name="dm_privacy"
              checked={dmPrivacy === "friends"}
              onChange={() => setDmPrivacy("friends")}
            />
            solo amigos
          </label>

          <h3 className="settings-sub">notificaciones del sistema</h3>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Navegador y app Electron: avisos aunque la pestaña esté en
            segundo plano. In-app siempre activa (campana).
          </p>
          <p>
            permiso: <code>{notifyPerm || "…"}</code>
          </p>
          <button
            type="button"
            className="btn secondary"
            onClick={async () => {
              const p = await ensureNotifyPermission();
              setNotifyPerm(p);
              setOk(
                p === "granted"
                  ? "notificaciones de escritorio activadas"
                  : p === "denied"
                    ? "permiso denegado en el sistema"
                    : "no soportado"
              );
            }}
          >
            [ activar notificaciones desktop ]
          </button>

          <h3 className="settings-sub">SFX de interfaz</h3>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Clics y beeps estilo terminal (además del sonido de notificaciones).
          </p>
          <label className="settings-radio">
            <input
              type="checkbox"
              checked={uiSfx}
              onChange={(e) => {
                const on = e.target.checked;
                setUiSfx(on);
                setUiSfxEnabled(on);
                if (on) playUiSfx("click");
              }}
            />
            sonidos de UI activados
          </label>
          <button
            type="button"
            className="btn secondary"
            onClick={() => playUiSfx("boot")}
          >
            [ test modem blip ]
          </button>

          <div className="compose-toolbar" style={{ marginTop: 16 }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "…" : "[ guardar privacidad ]"}
            </button>
          </div>
        </form>
      )}

      {tab === "account" && (
        <div className="settings-form">
          <h3 className="settings-sub">cuenta</h3>
          <p className="muted">
            email: {me.email || "—"} · id #{me.id}
          </p>
          {!me.email_verified && (
            <p className="form-error">
              verificá tu email (OTP en registro/login) para publicar y
              chatear en nexo.
            </p>
          )}
          <h3 className="settings-sub">zona de peligro</h3>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Soft-delete: la cuenta se borra en 7 días. Login antes de eso la
            restaura.
          </p>
          <button type="button" className="btn secondary" onClick={deleteAccount}>
            [ eliminar cuenta ]
          </button>
        </div>
      )}
    </div>
  );
}

function FriendRow({ f }: { f: FriendUser }) {
  const rank = getRank({
    role: f.role,
    username: f.username,
    is_vip: f.is_vip,
  });
  return (
    <div className="settings-friend-meta">
      <div className="settings-friend-av">
        {f.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.avatar_url} alt="" />
        ) : (
          <span>{f.username.slice(0, 2)}</span>
        )}
      </div>
      <div>
        <span className={rankNameClass(rank) || ""}>@{f.username}</span>{" "}
        {rank ? <RankBadge rank={rank} /> : null}
        {f.display_name ? (
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            {f.display_name}
          </div>
        ) : null}
      </div>
    </div>
  );
}
