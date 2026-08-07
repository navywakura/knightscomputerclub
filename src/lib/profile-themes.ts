/**
 * Temas visuales del perfil público (/u/username).
 * Fondos HD en public/profile-themes/ — podés reemplazar los JPG sin tocar código.
 */

export type ProfileThemeId =
  | "matrix"
  | "meadow"
  | "galaxy"
  | "flowers"
  | "anime"
  | "ocean"
  | "sunset";

export type ProfileTheme = {
  id: ProfileThemeId;
  name: string;
  description: string;
  /** Fondo principal (page) */
  bg: string;
  /** Imagen de banner por defecto del tema (si el user no tiene banner VIP) */
  banner: string;
  /** Decoraciones laterales / esquinas (PNG o JPG de internet) */
  decors: string[];
  /** Preview chica en settings */
  preview: string;
  /** CSS vars (inline style) */
  vars: {
    accent: string;
    accentSoft: string;
    text: string;
    textMuted: string;
    cardBg: string;
    cardBorder: string;
    glow: string;
    link: string;
    btnBg: string;
    btnBorder: string;
  };
};

export const DEFAULT_PROFILE_THEME: ProfileThemeId = "matrix";

export const PROFILE_THEMES: ProfileTheme[] = [
  {
    id: "matrix",
    name: "Matrix CRT",
    description: "Verde terminal clásico del nodo",
    bg: "/profile-themes/matrix-bg.jpg",
    banner: "/profile-themes/matrix-banner.jpg",
    preview: "/profile-themes/matrix-preview.jpg",
    decors: [
      "/profile-themes/decor/matrix-circuit.jpg",
      "/profile-themes/decor/matrix-leaf.jpg",
    ],
    vars: {
      accent: "#33ff66",
      accentSoft: "rgba(51,255,102,0.15)",
      text: "#b8ffc8",
      textMuted: "#5a8a62",
      cardBg: "rgba(10,18,10,0.92)",
      cardBorder: "#1f5a2a",
      glow: "rgba(51,255,102,0.35)",
      link: "#33ff66",
      btnBg: "#0a140c",
      btnBorder: "#1f5a2a",
    },
  },
  {
    id: "meadow",
    name: "Prado / naturaleza",
    description: "Verde hierba, cielo y calma",
    bg: "/profile-themes/meadow-bg.jpg",
    banner: "/profile-themes/meadow-banner.jpg",
    preview: "/profile-themes/meadow-preview.jpg",
    decors: [
      "/profile-themes/decor/meadow-fern.jpg",
      "/profile-themes/decor/meadow-butterfly.jpg",
    ],
    vars: {
      accent: "#6bcb77",
      accentSoft: "rgba(107,203,119,0.18)",
      text: "#e8f5e9",
      textMuted: "#a8c5a0",
      cardBg: "rgba(18,32,20,0.88)",
      cardBorder: "#4a7c59",
      glow: "rgba(107,203,119,0.4)",
      link: "#9be89b",
      btnBg: "#1a2e1c",
      btnBorder: "#4a7c59",
    },
  },
  {
    id: "galaxy",
    name: "Galaxia",
    description: "Espacio profundo, nebulosas y estrellas",
    bg: "/profile-themes/galaxy-bg.jpg",
    banner: "/profile-themes/galaxy-banner.jpg",
    preview: "/profile-themes/galaxy-preview.jpg",
    decors: [
      "/profile-themes/decor/galaxy-star.jpg",
      "/profile-themes/decor/galaxy-planet.jpg",
    ],
    vars: {
      accent: "#c4b5fd",
      accentSoft: "rgba(196,181,253,0.18)",
      text: "#eef2ff",
      textMuted: "#a5b4fc",
      cardBg: "rgba(12,10,28,0.9)",
      cardBorder: "#6366f1",
      glow: "rgba(167,139,250,0.45)",
      link: "#c4b5fd",
      btnBg: "#1e1b4b",
      btnBorder: "#7c3aed",
    },
  },
  {
    id: "flowers",
    name: "Flores",
    description: "Petalos, primavera y pastel",
    bg: "/profile-themes/flowers-bg.jpg",
    banner: "/profile-themes/flowers-banner.jpg",
    preview: "/profile-themes/flowers-preview.jpg",
    decors: [
      "/profile-themes/decor/flowers-rose.jpg",
      "/profile-themes/decor/flowers-petal.jpg",
    ],
    vars: {
      accent: "#f472b6",
      accentSoft: "rgba(244,114,182,0.18)",
      text: "#fff1f5",
      textMuted: "#f9a8d4",
      cardBg: "rgba(40,16,28,0.88)",
      cardBorder: "#db2777",
      glow: "rgba(244,114,182,0.4)",
      link: "#fbcfe8",
      btnBg: "#4a1830",
      btnBorder: "#ec4899",
    },
  },
  {
    id: "anime",
    name: "Anime / sakura",
    description: "Cerezos, neón suave y vibe 90s",
    bg: "/profile-themes/anime-bg.jpg",
    banner: "/profile-themes/anime-banner.jpg",
    preview: "/profile-themes/anime-preview.jpg",
    decors: [
      "/profile-themes/decor/anime-sakura.jpg",
      "/profile-themes/decor/anime-lantern.jpg",
    ],
    vars: {
      accent: "#fb7185",
      accentSoft: "rgba(251,113,133,0.2)",
      text: "#fff7ed",
      textMuted: "#fda4af",
      cardBg: "rgba(40,20,32,0.9)",
      cardBorder: "#e11d48",
      glow: "rgba(251,113,133,0.4)",
      link: "#fda4af",
      btnBg: "#3f1a28",
      btnBorder: "#f43f5e",
    },
  },
  {
    id: "ocean",
    name: "Océano",
    description: "Azul profundo y espuma",
    bg: "/profile-themes/ocean-bg.jpg",
    banner: "/profile-themes/ocean-banner.jpg",
    preview: "/profile-themes/ocean-preview.jpg",
    decors: [
      "/profile-themes/decor/ocean-wave.jpg",
      "/profile-themes/decor/ocean-shell.jpg",
    ],
    vars: {
      accent: "#38bdf8",
      accentSoft: "rgba(56,189,248,0.18)",
      text: "#e0f2fe",
      textMuted: "#7dd3fc",
      cardBg: "rgba(8,20,36,0.9)",
      cardBorder: "#0284c7",
      glow: "rgba(56,189,248,0.4)",
      link: "#7dd3fc",
      btnBg: "#0c2a40",
      btnBorder: "#0ea5e9",
    },
  },
  {
    id: "sunset",
    name: "Atardecer",
    description: "Naranja, oro y cielo de fin de día",
    bg: "/profile-themes/sunset-bg.jpg",
    banner: "/profile-themes/sunset-banner.jpg",
    preview: "/profile-themes/sunset-preview.jpg",
    decors: [
      "/profile-themes/decor/sunset-sun.jpg",
      "/profile-themes/decor/sunset-cloud.jpg",
    ],
    vars: {
      accent: "#fb923c",
      accentSoft: "rgba(251,146,60,0.2)",
      text: "#fff7ed",
      textMuted: "#fdba74",
      cardBg: "rgba(40,22,12,0.9)",
      cardBorder: "#ea580c",
      glow: "rgba(251,146,60,0.4)",
      link: "#fdba74",
      btnBg: "#3d2410",
      btnBorder: "#f97316",
    },
  },
];

const THEME_IDS = new Set(PROFILE_THEMES.map((t) => t.id));

export function isProfileThemeId(v: unknown): v is ProfileThemeId {
  return typeof v === "string" && THEME_IDS.has(v as ProfileThemeId);
}

export function getProfileTheme(id: unknown): ProfileTheme {
  if (isProfileThemeId(id)) {
    return PROFILE_THEMES.find((t) => t.id === id) || PROFILE_THEMES[0];
  }
  return PROFILE_THEMES.find((t) => t.id === DEFAULT_PROFILE_THEME)!;
}

/** CSS variables object for style={} */
export function profileThemeStyle(theme: ProfileTheme): Record<string, string> {
  const v = theme.vars;
  return {
    "--pt-accent": v.accent,
    "--pt-accent-soft": v.accentSoft,
    "--pt-text": v.text,
    "--pt-muted": v.textMuted,
    "--pt-card-bg": v.cardBg,
    "--pt-card-border": v.cardBorder,
    "--pt-glow": v.glow,
    "--pt-link": v.link,
    "--pt-btn-bg": v.btnBg,
    "--pt-btn-border": v.btnBorder,
    "--pt-bg-image": `url(${theme.bg})`,
  };
}
