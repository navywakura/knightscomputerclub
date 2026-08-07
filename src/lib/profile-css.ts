/**
 * CSS personalizado del perfil público.
 * Sanitización estricta: no scripts, no @import externo malicioso.
 */

export const PROFILE_CSS_MAX = 6000;

export const PROFILE_FONTS = [
  { id: "mono", label: "IBM Plex Mono", stack: '"IBM Plex Mono", ui-monospace, monospace' },
  { id: "vt323", label: "VT323 (CRT)", stack: '"VT323", "Share Tech Mono", monospace' },
  { id: "share", label: "Share Tech Mono", stack: '"Share Tech Mono", monospace' },
  { id: "system", label: "System UI", stack: 'system-ui, -apple-system, sans-serif' },
  { id: "serif", label: "Georgia serif", stack: 'Georgia, "Times New Roman", serif' },
  { id: "orbitron", label: "Orbitron", stack: '"Orbitron", system-ui, sans-serif' },
] as const;

export type ProfileFontId = (typeof PROFILE_FONTS)[number]["id"];

export type ProfileCustomStyle = {
  /** color de fondo o vacío = tema */
  background?: string;
  /** id de fuente o stack libre sanitizado */
  font?: string;
  /** color principal (texto / cards) */
  primary?: string;
  /** color de acento */
  accent?: string;
  /** CSS extra del usuario (ya sanitizado al guardar) */
  css?: string;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB =
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i;

export function isSafeColor(v: string): boolean {
  const s = v.trim();
  if (!s || s.length > 40) return false;
  if (HEX.test(s)) return true;
  if (RGB.test(s)) return true;
  // nombres CSS simples
  if (/^[a-z]{3,20}$/i.test(s)) return true;
  return false;
}

export function isSafeFont(v: string): boolean {
  const s = v.trim();
  if (!s || s.length > 120) return false;
  // solo letras, comillas, comas, espacios, guiones
  if (!/^[\w\s"',\-]+$/i.test(s)) return false;
  if (/expression|url\s*\(|@|<|>|javascript/i.test(s)) return false;
  return true;
}

/**
 * Limpia CSS de usuario para inyección en <style>.
 * NO es un parser CSS completo: deniega patrones peligrosos.
 */
export function sanitizeProfileCss(raw: string): string {
  let css = String(raw || "")
    .slice(0, PROFILE_CSS_MAX)
    .replace(/\0/g, "");

  // cortar cualquier intento de romper el style tag
  css = css.replace(/<\/style/gi, "");
  css = css.replace(/<[^>]*>/g, "");

  // bloqueos duros
  const banned = [
    /@import/gi,
    /@charset/gi,
    /expression\s*\(/gi,
    /behavior\s*:/gi,
    /-moz-binding/gi,
    /javascript\s*:/gi,
    /vbscript\s*:/gi,
    /data\s*:\s*text\/html/gi,
    /data\s*:\s*image\/svg/gi,
  ];
  for (const re of banned) {
    css = css.replace(re, "/*blocked*/");
  }

  // url() solo relative /https /api/media /profile-themes
  css = css.replace(/url\s*\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (_m, _q, u) => {
    const url = String(u).trim();
    if (
      url.startsWith("/api/media/") ||
      url.startsWith("/profile-themes/") ||
      url.startsWith("https://") ||
      url.startsWith("http://")
    ) {
      if (/javascript:|data:/i.test(url)) return "url(about:blank)";
      return `url("${url.replace(/"/g, "")}")`;
    }
    return "/*url-blocked*/";
  });

  return css.trim();
}

export function parseProfileCustom(raw: unknown): ProfileCustomStyle {
  if (!raw) return {};
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  } else {
    return {};
  }

  const out: ProfileCustomStyle = {};
  if (typeof obj.background === "string" && isSafeColor(obj.background)) {
    out.background = obj.background.trim();
  }
  if (typeof obj.font === "string") {
    const f = obj.font.trim();
    const known = PROFILE_FONTS.find((x) => x.id === f);
    if (known) out.font = known.id;
    else if (isSafeFont(f)) out.font = f;
  }
  if (typeof obj.primary === "string" && isSafeColor(obj.primary)) {
    out.primary = obj.primary.trim();
  }
  if (typeof obj.accent === "string" && isSafeColor(obj.accent)) {
    out.accent = obj.accent.trim();
  }
  if (typeof obj.css === "string" && obj.css.trim()) {
    out.css = sanitizeProfileCss(obj.css);
  }
  return out;
}

export function fontStackFor(font: string | undefined): string | null {
  if (!font) return null;
  const known = PROFILE_FONTS.find((x) => x.id === font);
  if (known) return known.stack;
  if (isSafeFont(font)) return font;
  return null;
}

/**
 * CSS variables + reglas scopeadas al perfil.
 * custom.css se envuelve en `.profile-public[data-profile-user="…"]`
 */
export function buildProfileCustomCss(
  username: string,
  custom: ProfileCustomStyle
): string {
  const scope = `.profile-public[data-profile-user="${cssEscapeAttr(username)}"]`;
  const lines: string[] = [];

  const font = fontStackFor(custom.font);
  if (custom.background || font || custom.primary || custom.accent) {
    lines.push(`${scope} {`);
    if (custom.background) {
      lines.push(`  --pt-card-bg: ${custom.background};`);
      // fondo de página sólido si el user eligió color
      lines.push(`  --pt-custom-bg: ${custom.background};`);
    }
    if (custom.primary) {
      lines.push(`  --pt-text: ${custom.primary};`);
      lines.push(`  --pt-card-border: ${custom.primary};`);
    }
    if (custom.accent) {
      lines.push(`  --pt-accent: ${custom.accent};`);
      lines.push(`  --pt-link: ${custom.accent};`);
      lines.push(`  --pt-btn-border: ${custom.accent};`);
      lines.push(`  --pt-glow: color-mix(in srgb, ${custom.accent} 45%, transparent);`);
    }
    if (font) {
      lines.push(`  font-family: ${font};`);
    }
    lines.push(`}`);
  }

  if (custom.background) {
    lines.push(`${scope} .profile-theme-bg {`);
    lines.push(
      `  background-image: linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.75)), linear-gradient(${custom.background}, ${custom.background});`
    );
    lines.push(`  background-size: cover;`);
    lines.push(`}`);
  }

  if (custom.css) {
    // scope: reescribir selectores de primer nivel con prefijo
    const scoped = scopeUserCss(custom.css, scope);
    lines.push(scoped);
  }

  return lines.join("\n");
}

function cssEscapeAttr(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-]/g, (c) => `\\${c}`);
}

/**
 * Prefija cada bloque con el scope del perfil (naive pero útil).
 * El CSS del user se asume ya sanitizado.
 */
function scopeUserCss(css: string, scope: string): string {
  // no intentar parsear perfecto; envolver todo en un bloque anidado no es CSS válido
  // en browsers antiguos. Mejor: prefix simple de reglas.
  const parts = css.split("}");
  const out: string[] = [];
  for (const part of parts) {
    const chunk = part.trim();
    if (!chunk) continue;
    const brace = chunk.indexOf("{");
    if (brace < 0) continue;
    const selectors = chunk.slice(0, brace).trim();
    const body = chunk.slice(brace + 1).trim();
    if (!selectors || !body) continue;
    // no permitir @-rules peligrosas restantes
    if (selectors.startsWith("@")) {
      if (/^@(keyframes|media|supports)\b/i.test(selectors)) {
        // dejar media/keyframes sin re-scope complejo
        out.push(`${selectors} { ${body} }`);
      }
      continue;
    }
    const scopedSels = selectors
      .split(",")
      .map((s) => {
        const t = s.trim();
        if (!t) return "";
        if (t.startsWith(scope) || t.includes("profile-public")) return t;
        // :root / body / html → scope del perfil
        if (/^(html|body|:root)$/i.test(t)) return scope;
        return `${scope} ${t}`;
      })
      .filter(Boolean)
      .join(", ");
    if (scopedSels) out.push(`${scopedSels} { ${body} }`);
  }
  return out.join("\n");
}

export function emptyProfileCustom(): ProfileCustomStyle {
  return {};
}
