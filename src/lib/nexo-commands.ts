/**
 * Comandos estilo IRC para el composer de Nexo.
 * Se ejecutan en cliente; no van al servidor salvo que envíen un mensaje (/me).
 */

export type CommandResult =
  | { type: "message"; body: string }
  | { type: "theme"; theme: string }
  | { type: "clear" }
  | { type: "help"; text: string }
  | { type: "error"; text: string }
  | { type: "noop" };

const THEMES = new Set(["matrix", "serial", "neon", "default", "silver"]);

/**
 * @returns null si no es un comando (enviar normal)
 */
export function parseNexoCommand(
  raw: string,
  meUsername?: string
): CommandResult | null {
  const t = raw.trim();
  if (!t.startsWith("/")) return null;

  const parts = t.slice(1).split(/\s+/);
  const cmd = (parts[0] || "").toLowerCase();
  const rest = t.slice(1 + (parts[0]?.length || 0)).trim();

  switch (cmd) {
    case "help":
    case "?":
      return {
        type: "help",
        text: [
          "comandos nexo:",
          "/help — esta ayuda",
          "/me <acción> — mensaje de acción",
          "/shrug — ¯\\_(ツ)_/¯",
          "/clear — limpia la vista local del chat",
          "/theme matrix|serial|neon|default — skin VIP (local)",
          "/tableflip · /unflip · /lenny",
        ].join("\n"),
      };
    case "me":
      if (!rest) return { type: "error", text: "uso: /me saluda al nodo" };
      return {
        type: "message",
        body: `* ${meUsername || "user"} ${rest}`,
      };
    case "shrug":
      return { type: "message", body: "¯\\_(ツ)_/¯" };
    case "tableflip":
      return { type: "message", body: "(╯°□°）╯︵ ┻━┻" };
    case "unflip":
      return { type: "message", body: "┬─┬ ノ( ゜-゜ノ)" };
    case "lenny":
      return { type: "message", body: "( ͡° ͜ʖ ͡°)" };
    case "clear":
      return { type: "clear" };
    case "theme": {
      const th = (rest.split(/\s+/)[0] || "").toLowerCase();
      const map: Record<string, string> = {
        matrix: "matrix",
        green: "matrix",
        serial: "serial",
        silver: "serial",
        neon: "neon",
        red: "neon",
        default: "default",
        off: "default",
      };
      const theme = map[th];
      if (!theme || (theme !== "default" && !THEMES.has(theme))) {
        return {
          type: "error",
          text: "uso: /theme matrix|serial|neon|default",
        };
      }
      return { type: "theme", theme };
    }
    default:
      // no es comando conocido → enviar texto tal cual (puede ser path /foo)
      if (cmd.length <= 12 && !rest.includes("\n")) {
        return {
          type: "error",
          text: `comando /${cmd} desconocido · /help`,
        };
      }
      return null;
  }
}
