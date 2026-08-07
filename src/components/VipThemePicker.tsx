"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FORUM_THEMES,
  readForumTheme,
  writeForumTheme,
  type ForumThemeId,
} from "@/lib/forum-themes";
import { isOwnerUser } from "@/lib/ranks";

type UserLike = {
  is_vip?: boolean | null;
  role?: string | null;
  username?: string | null;
};

type Props = {
  user: UserLike | null;
  /** clase extra en el wrap */
  className?: string;
};

/**
 * Selector de skins VIP (foro + nexo).
 * Preferencia en localStorage (kc_forum_theme_v1) — compartida entre apps.
 */
export default function VipThemePicker({ user, className = "" }: Props) {
  const [theme, setTheme] = useState<ForumThemeId>("default");
  const [open, setOpen] = useState(false);

  const canTheme =
    !!user &&
    (Boolean(user.is_vip) ||
      isOwnerUser({ role: user.role, username: user.username }));

  useEffect(() => {
    setTheme(readForumTheme());
  }, []);

  useEffect(() => {
    document.body.setAttribute("data-forum-theme", theme);
  }, [theme]);

  function pick(id: ForumThemeId) {
    if (!canTheme && id !== "default") return;
    setTheme(id);
    writeForumTheme(id);
    setOpen(false);
  }

  const meta = FORUM_THEMES.find((t) => t.id === theme) || FORUM_THEMES[0];

  if (!user) return null;

  if (!canTheme) {
    return (
      <Link
        href="/donate"
        className={`forum-chip ${className}`.trim()}
        title="temas del foro/nexo = perk VIP"
      >
        theme · VIP
      </Link>
    );
  }

  return (
    <div className={`forum-theme-wrap ${className}`.trim()}>
      <button
        type="button"
        className={`forum-chip forum-theme-chip${open ? " on" : ""}`}
        onClick={() => setOpen((x) => !x)}
        title="tema VIP (foro + nexo)"
      >
        theme · {meta.label}
      </button>
      {open ? (
        <div
          className="forum-theme-panel"
          role="dialog"
          aria-label="temas VIP"
        >
          <p className="forum-theme-panel-title">
            <span className="vip-badge" data-text="[VIP]">
              [VIP]
            </span>{" "}
            skins · foro & nexo
          </p>
          <div className="forum-theme-grid">
            {FORUM_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`forum-theme-card${theme === t.id ? " on" : ""} theme-${t.id}`}
                onClick={() => pick(t.id)}
              >
                <span
                  className="forum-theme-thumb"
                  style={
                    t.thumb
                      ? { backgroundImage: `url(${t.thumb})` }
                      : undefined
                  }
                />
                <span className="forum-theme-name">{t.label}</span>
                <span className="forum-theme-desc muted">
                  {t.accent} · {t.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
