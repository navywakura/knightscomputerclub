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
import {
  DEFAULT_PROFILE_THEME,
  PROFILE_THEMES,
  type ProfileThemeId,
  isProfileThemeId,
} from "@/lib/profile-themes";
import {
  PROFILE_CSS_MAX,
  PROFILE_FONTS,
  type ProfileCustomStyle,
} from "@/lib/profile-css";

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
  profile_theme?: string;
  profile_music_url?: string | null;
  profile_custom?: ProfileCustomStyle;
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

type Props = { initialTab?: Tab | null; initialOtpError?: string | null };

export default function SettingsApp({
  initialTab = "profile",
  initialOtpError = null,
}: Props) {
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
  const [error, setError] = useState(
    initialOtpError ? String(initialOtpError).slice(0, 280) : ""
  );
  const [ok, setOk] = useState("");

  // profile form
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [profileTheme, setProfileTheme] = useState<ProfileThemeId>(
    DEFAULT_PROFILE_THEME
  );
  const [musicId, setMusicId] = useState<number | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicClear, setMusicClear] = useState(false);
  const [musicUploading, setMusicUploading] = useState(false);
  const [customBg, setCustomBg] = useState("");
  const [customFont, setCustomFont] = useState("");
  const [customPrimary, setCustomPrimary] = useState("");
  const [customAccent, setCustomAccent] = useState("");
  const [customCss, setCustomCss] = useState("");
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

  // email change / OTP
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [otpDevHint, setOtpDevHint] = useState("");

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
    setProfileTheme(
      isProfileThemeId(u.profile_theme)
        ? u.profile_theme
        : DEFAULT_PROFILE_THEME
    );
    setMusicUrl(u.profile_music_url || null);
    setMusicId(null);
    setMusicClear(false);
    const pc = u.profile_custom || {};
    setCustomBg(pc.background || "");
    setCustomFont(pc.font || "");
    setCustomPrimary(pc.primary || "");
    setCustomAccent(pc.accent || "");
    setCustomCss(pc.css || "");
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

  async function uploadMedia(
    file: File,
    kind: "image" | "audio" = "image"
  ): Promise<number | null> {
    if (kind === "image") {
      if (!file.type.startsWith("image/")) {
        setError("solo imágenes (jpeg/png/webp/gif)");
        return null;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError("imagen > 8MB");
        return null;
      }
    } else {
      const okAudio =
        file.type === "audio/mpeg" ||
        file.type === "audio/mp3" ||
        file.name.toLowerCase().endsWith(".mp3");
      if (!okAudio) {
        setError("solo MP3 (audio/mpeg)");
        return null;
      }
      if (file.size > 12 * 1024 * 1024) {
        setError("MP3 > 12MB — acortá el track");
        return null;
      }
    }
    const form = new FormData();
    form.append(
      "file",
      file,
      file.name || (kind === "audio" ? "theme.mp3" : "photo.jpg")
    );
    const res = await fetch("/api/media", {
      method: "POST",
      body: form,
      credentials: "include",
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(d.error || "error al subir");
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

  async function onMusicPick(file: File | null) {
    if (!file) return;
    setMusicUploading(true);
    setError("");
    try {
      const id = await uploadMedia(file, "audio");
      if (id) {
        setMusicId(id);
        setMusicUrl(`/api/media/${id}`);
        setMusicClear(false);
        setOk("MP3 listo — guardá el perfil para aplicar");
      }
    } finally {
      setMusicUploading(false);
    }
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
        profile_theme: profileTheme,
        profile_custom: {
          background: customBg.trim() || undefined,
          font: customFont.trim() || undefined,
          primary: customPrimary.trim() || undefined,
          accent: customAccent.trim() || undefined,
          css: customCss.trim() || undefined,
        },
        dm_privacy: dmPrivacy,
        connections: conn,
        pgp_public_key: pgpKey,
        pgp_fingerprint: pgpFp,
      };
      if (avatarId !== null) payload.avatar_media_id = avatarId;
      if (bannerId !== null) payload.banner_media_id = bannerId;
      if (musicClear) payload.profile_music_media_id = null;
      else if (musicId !== null) payload.profile_music_media_id = musicId;

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
      setMusicId(null);
      setMusicClear(false);
      if (d.user?.profile_music_url) {
        setMusicUrl(d.user.profile_music_url);
      } else if (musicClear) {
        setMusicUrl(null);
      }
    } catch {
      setError("red caída");
    } finally {
      setSaving(false);
    }
  }

  async function requestEmailChange() {
    setEmailBusy(true);
    setError("");
    setOk("");
    setOtpDevHint("");
    try {
      const res = await apiFetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_change",
          email: newEmail.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "no se pudo pedir el cambio");
        return;
      }
      setPendingEmail(d.pending_email || newEmail.trim().toLowerCase());
      setOk(d.message || "OTP enviado al nuevo correo");
      if (d.code_dev) {
        setOtpDevHint(`dev OTP: ${d.code_dev}`);
      }
    } catch {
      setError("red caída");
    } finally {
      setEmailBusy(false);
    }
  }

  async function confirmEmailChange() {
    setEmailBusy(true);
    setError("");
    setOk("");
    try {
      const res = await apiFetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_change",
          code: emailOtp.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "código inválido");
        return;
      }
      if (d.user) setMe(d.user as Me);
      setOk(d.message || "email actualizado");
      setPendingEmail(null);
      setNewEmail("");
      setEmailOtp("");
      setOtpDevHint("");
    } catch {
      setError("red caída");
    } finally {
      setEmailBusy(false);
    }
  }

  async function resendVerifyOtp() {
    setEmailBusy(true);
    setError("");
    setOk("");
    setOtpDevHint("");
    try {
      const res = await apiFetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend_verify" }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "no se pudo enviar OTP");
        return;
      }
      if (d.already) {
        setOk("email ya verificado");
      } else {
        setOk(d.message || "OTP reenviado");
      }
      if (d.code_dev) setOtpDevHint(`dev OTP: ${d.code_dev}`);
    } catch {
      setError("red caída");
    } finally {
      setEmailBusy(false);
    }
  }

  async function confirmVerifyOtp() {
    setEmailBusy(true);
    setError("");
    setOk("");
    try {
      // si hay cambio pendiente, usar confirm_change; si no, verify clásico
      if (pendingEmail) {
        const res = await apiFetch("/api/auth/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm_change",
            code: emailOtp.trim(),
          }),
        });
        const d = await res.json();
        if (!res.ok) {
          setError(d.error || "código inválido");
          return;
        }
        if (d.user) setMe(d.user as Me);
        setOk(d.message || "email actualizado");
        setPendingEmail(null);
        setNewEmail("");
        setEmailOtp("");
        return;
      }
      const res = await apiFetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code: emailOtp.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "código inválido");
        return;
      }
      if (d.user) setMe(d.user as Me);
      setOk("email verificado");
      setEmailOtp("");
      setOtpDevHint("");
    } catch {
      setError("red caída");
    } finally {
      setEmailBusy(false);
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

          <h3 className="settings-sub">tema del perfil público</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Fondo, colores y decoración en{" "}
            <Link href={`/u/${encodeURIComponent(me.username)}`}>
              /u/{me.username}
            </Link>
            . No todos tienen que ser matrix-verde.
          </p>
          <div className="profile-theme-grid" role="listbox" aria-label="tema de perfil">
            {PROFILE_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={profileTheme === t.id}
                className={`profile-theme-card${
                  profileTheme === t.id ? " on" : ""
                }`}
                onClick={() => setProfileTheme(t.id)}
                style={{
                  borderColor:
                    profileTheme === t.id ? t.vars.accent : undefined,
                }}
              >
                <span
                  className="profile-theme-thumb"
                  style={{ backgroundImage: `url(${t.preview})` }}
                />
                <span className="profile-theme-meta">
                  <strong style={{ color: t.vars.accent }}>{t.name}</strong>
                  <span className="muted">{t.description}</span>
                </span>
              </button>
            ))}
          </div>

          <h3 className="settings-sub">CSS / estilo personalizado</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Sobre el tema base: fondo, fuente y colores. Opcional: CSS avanzado
            (sanitizado, sin scripts). Máx {PROFILE_CSS_MAX} chars.
          </p>
          <div className="settings-css-grid">
            <label htmlFor="s-bg">
              color de fondo
              <input
                id="s-bg"
                type="text"
                value={customBg}
                onChange={(e) => setCustomBg(e.target.value)}
                placeholder="#0a120a o vacío = tema"
                maxLength={40}
              />
            </label>
            <label htmlFor="s-bg-pick" className="settings-color-pick">
              <span className="muted">picker</span>
              <input
                id="s-bg-pick"
                type="color"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(customBg) ? customBg : "#0a120a"
                }
                onChange={(e) => setCustomBg(e.target.value)}
              />
            </label>
            <label htmlFor="s-primary">
              color principal (texto)
              <input
                id="s-primary"
                type="text"
                value={customPrimary}
                onChange={(e) => setCustomPrimary(e.target.value)}
                placeholder="#b8ffc8"
                maxLength={40}
              />
            </label>
            <label htmlFor="s-primary-pick" className="settings-color-pick">
              <span className="muted">picker</span>
              <input
                id="s-primary-pick"
                type="color"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(customPrimary)
                    ? customPrimary
                    : "#b8ffc8"
                }
                onChange={(e) => setCustomPrimary(e.target.value)}
              />
            </label>
            <label htmlFor="s-accent">
              color de acento
              <input
                id="s-accent"
                type="text"
                value={customAccent}
                onChange={(e) => setCustomAccent(e.target.value)}
                placeholder="#33ff66"
                maxLength={40}
              />
            </label>
            <label htmlFor="s-accent-pick" className="settings-color-pick">
              <span className="muted">picker</span>
              <input
                id="s-accent-pick"
                type="color"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(customAccent)
                    ? customAccent
                    : "#33ff66"
                }
                onChange={(e) => setCustomAccent(e.target.value)}
              />
            </label>
            <label htmlFor="s-font" style={{ gridColumn: "1 / -1" }}>
              fuente
              <select
                id="s-font"
                value={customFont}
                onChange={(e) => setCustomFont(e.target.value)}
              >
                <option value="">(del tema / default)</option>
                {PROFILE_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label htmlFor="s-css">CSS custom (avanzado)</label>
          <textarea
            id="s-css"
            className="settings-css-area"
            value={customCss}
            onChange={(e) =>
              setCustomCss(e.target.value.slice(0, PROFILE_CSS_MAX))
            }
            rows={8}
            maxLength={PROFILE_CSS_MAX}
            spellCheck={false}
            placeholder={`.profile-public-card {\n  border-radius: 16px;\n}\n.profile-public-name {\n  letter-spacing: 0.1em;\n}`}
          />
          <p className="muted" style={{ fontSize: "0.75rem" }}>
            {customCss.length}/{PROFILE_CSS_MAX} · se scopea a tu perfil ·{" "}
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setCustomBg("");
                setCustomFont("");
                setCustomPrimary("");
                setCustomAccent("");
                setCustomCss("");
              }}
            >
              resetear estilo
            </button>
          </p>

          <h3 className="settings-sub">música del perfil (MP3)</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Suena en loop en tu página pública. Máx 12MB · solo{" "}
            <code>.mp3</code>. Respetá copyright / usá tracks libres.
          </p>
          <div className="settings-music-row">
            {musicUrl && !musicClear ? (
              <audio
                controls
                src={musicUrl}
                style={{ width: "100%", maxWidth: 360, height: 36 }}
              />
            ) : (
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                sin track todavía
              </span>
            )}
            <div className="settings-inline">
              <label className="btn secondary settings-file-btn">
                {musicUploading ? "subiendo…" : "[ subir MP3 ]"}
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,.mp3"
                  hidden
                  disabled={musicUploading || uploading}
                  onChange={(e) =>
                    void onMusicPick(e.target.files?.[0] || null)
                  }
                />
              </label>
              {(musicUrl || musicId) && !musicClear ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setMusicClear(true);
                    setMusicId(null);
                    setMusicUrl(null);
                  }}
                >
                  [ quitar ]
                </button>
              ) : null}
            </div>
          </div>

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
          <h3 className="settings-sub">correo electrónico</h3>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Actual: <code>{me.email || "—"}</code>
            {me.email_verified ? (
              <span className="tag ok" style={{ marginLeft: 8 }}>
                verificado
              </span>
            ) : (
              <span className="tag" style={{ marginLeft: 8 }}>
                sin verificar
              </span>
            )}
          </p>
          {!me.email_verified && (
            <div className="settings-email-block">
              <p className="form-error" style={{ marginTop: 0 }}>
                verificá tu email para publicar y chatear en nexo.
              </p>
              <button
                type="button"
                className="btn secondary"
                disabled={emailBusy}
                onClick={() => void resendVerifyOtp()}
              >
                {emailBusy ? "…" : "[ enviar / reenviar OTP ]"}
              </button>
              <div className="settings-inline" style={{ marginTop: 10 }}>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="código 6 dígitos"
                  value={emailOtp}
                  onChange={(e) =>
                    setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
                <button
                  className="btn"
                  type="button"
                  disabled={emailBusy || emailOtp.length !== 6}
                  onClick={() => void confirmVerifyOtp()}
                >
                  confirmar
                </button>
              </div>
            </div>
          )}

          <div className="settings-email-block">
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              Cambiar email: enviamos un OTP al correo <strong>nuevo</strong>.
              El cambio se aplica al confirmar el código.
            </p>
            {pendingEmail && (
              <p className="form-ok" style={{ margin: "6px 0" }}>
                pendiente → <code>{pendingEmail}</code>
              </p>
            )}
            <div className="settings-inline" style={{ marginBottom: 8 }}>
              <input
                type="email"
                autoComplete="email"
                placeholder="nuevo@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <button
                type="button"
                className="btn secondary"
                disabled={emailBusy || !newEmail.trim()}
                onClick={() => void requestEmailChange()}
              >
                {emailBusy ? "…" : "enviar OTP"}
              </button>
            </div>
            <div className="settings-inline">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="OTP del email nuevo"
                value={emailOtp}
                onChange={(e) =>
                  setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              <button
                type="button"
                className="btn"
                disabled={emailBusy || emailOtp.length !== 6 || !pendingEmail}
                onClick={() => void confirmEmailChange()}
              >
                aplicar cambio
              </button>
            </div>
            {otpDevHint ? (
              <p className="muted" style={{ fontSize: "0.8rem", marginTop: 8 }}>
                {otpDevHint}
              </p>
            ) : null}
          </div>

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
            {me.email_verified ? " · verificado" : " · sin verificar"}
          </p>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Para cambiar o verificar el correo usá la pestaña{" "}
            <button
              type="button"
              className="linkish"
              onClick={() => setTab("privacy")}
            >
              privacidad
            </button>
            .
          </p>
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
