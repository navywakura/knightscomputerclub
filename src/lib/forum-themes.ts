/** Temas visuales del foro — perk VIP (y owner). */

export type ForumThemeId = "default" | "matrix" | "serial" | "neon";

export type ForumTheme = {
  id: ForumThemeId;
  label: string;
  /** tono principal para UI */
  accent: string;
  description: string;
  /** fondo; null = sin imagen (tema default del sitio) */
  background: string | null;
  /** preview miniatura */
  thumb: string | null;
};

export const FORUM_THEME_KEY = "kc_forum_theme_v1";

export const FORUM_THEMES: ForumTheme[] = [
  {
    id: "default",
    label: "NODE DEFAULT",
    accent: "verde matrix clásico",
    description: "Tema base del nodo (sin wallpaper).",
    background: null,
    thumb: null,
  },
  {
    id: "matrix",
    label: "MATRIX RAIN",
    accent: "verde",
    description: "Lluvia digital · acentos verde neón.",
    background: "/forum-themes/matrix-green.jpg",
    thumb: "/forum-themes/matrix-green.jpg",
  },
  {
    id: "serial",
    label: "SERIAL SILVER",
    accent: "gris plata",
    description: "Mono industrial · acentos plata / steel.",
    background: "/forum-themes/serial-silver.jpg",
    thumb: "/forum-themes/serial-silver.jpg",
  },
  {
    id: "neon",
    label: "NEON STREET",
    accent: "rojo oscuro",
    description: "Calle cyber · acentos rojo / magenta.",
    background: "/forum-themes/neon-red.jpg",
    thumb: "/forum-themes/neon-red.jpg",
  },
];

export function isForumThemeId(v: string): v is ForumThemeId {
  return FORUM_THEMES.some((t) => t.id === v);
}

export function readForumTheme(): ForumThemeId {
  if (typeof window === "undefined") return "default";
  try {
    const v = localStorage.getItem(FORUM_THEME_KEY) || "default";
    return isForumThemeId(v) ? v : "default";
  } catch {
    return "default";
  }
}

export function writeForumTheme(id: ForumThemeId) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FORUM_THEME_KEY, id);
  } catch {
    /* */
  }
}

/** Perks VIP — lista para /donate y UI */
export const VIP_PERKS: Array<{ title: string; body: string }> = [
  {
    title: "Badge [VIP] en el foro",
    body: "Handle en oro eléctrico y etiqueta visible en posts y lista online.",
  },
  {
    title: "Temas del foro y nexo (exclusivo)",
    body: "Misma skin en /forum y /nexo: Matrix (verde), Serial Silver (plata) o Neon Street (rojo). Se guarda en el navegador.",
  },
  {
    title: "Crear tablones en // nexo",
    body: "Solo VIP crea tablones en /nexo: salen el chat y el board del foro bajo // nexo al mismo tiempo. El resto chatea y usa DMs con PIN.",
  },
  {
    title: "Apoyo al nodo",
    body: "Tu donación mantiene RXos, hosting y la infra del club sin ads ni trackers.",
  },
  {
    title: "Señal, no ruido",
    body: "Mismo acceso al código y al debate — sin paywall del kernel. El VIP es cosmética + reconocimiento + nexo boards.",
  },
];
