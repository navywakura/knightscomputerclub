"use strict";

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  err: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  accent: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function banner() {
  return c.ok(`
╔══════════════════════════════════════╗
║  KCC CLI  ·  // nexo only            ║
║  knightscomputer.club                ║
╚══════════════════════════════════════╝`);
}

function fmtMsg(m, mine = false) {
  const t = m.created_at
    ? new Date(m.created_at).toLocaleTimeString()
    : "";
  const name = m.author_display_name || m.author_name || "?";
  const vip = m.author_is_vip ? c.accent("[VIP] ") : "";
  const body = m.deleted ? c.dim("(eliminado)") : String(m.body || "");
  const head = mine
    ? c.cyan(`you`)
    : c.bold(`@${m.author_name || name}`);
  return `${c.dim(t)} ${vip}${head}${m.author_display_name ? c.dim(" " + name) : ""}: ${body}`;
}

function promptLabel(username, board) {
  const u = username ? `@${username}` : "guest";
  const b = board ? `#${board.slug || board.id}` : "kcc";
  return c.ok(`${u}:${b}> `);
}

module.exports = { c, banner, fmtMsg, promptLabel };
