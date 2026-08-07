"use strict";

const readline = require("readline");
const {
  login,
  logout,
  me,
  boards,
  messages,
  sendMessage,
  joinBoard,
  setProfileMedia,
  patchProfile,
} = require("./api");
const { loadSession, getBaseUrl, clearSession } = require("./config");
const { c, banner, fmtMsg, promptLabel } = require("./style");

/**
 * Shell interactiva KCC — solo Nexo + perfil (avatar/banner).
 */
async function runShell(initialBoard = null) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let board = null; // { id, slug, name }
  let lastId = 0;
  let pollTimer = null;
  let username = loadSession()?.user?.username || null;

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPoll() {
    stopPoll();
    if (!board) return;
    pollTimer = setInterval(async () => {
      try {
        const d = await messages(board.id, lastId);
        const list = d.messages || [];
        if (list.length) {
          for (const m of list) {
            if (m.deleted) continue;
            process.stdout.write("\r\x1b[K");
            console.log(fmtMsg(m));
            lastId = Math.max(lastId, m.id);
          }
          rl.prompt(true);
        }
      } catch {
        /* soft */
      }
    }, 3500);
  }

  function setPrompt() {
    rl.setPrompt(promptLabel(username, board));
    rl.prompt();
  }

  console.log(banner());
  console.log(c.dim(`api: ${getBaseUrl()}`));
  console.log(c.dim('escribí "help" · solo // nexo · perfil: avatar/banner\n'));

  async function doLogin(args) {
    let user = args[0];
    let pass = args[1];
    if (!user) {
      user = await ask(rl, "login (user/email): ");
    }
    if (!pass) {
      pass = await ask(rl, "password: ", true);
    }
    const u = await login(user.trim(), pass);
    username = u.username;
    console.log(c.ok(`// ok · @${u.username}${u.is_vip ? " [VIP]" : ""}`));
  }

  async function doBoards() {
    const d = await boards();
    const list = d.boards || [];
    if (!list.length) {
      console.log(c.dim("(sin boards)"));
      return;
    }
    console.log(c.accent("  id   slug                     name / owner"));
    for (const b of list) {
      const id = String(b.id).padStart(4);
      const slug = String(b.slug || "").slice(0, 22).padEnd(22);
      console.log(
        `  ${id}  ${slug}  ${b.name}  ${c.dim("@" + (b.owner_name || "?"))}`
      );
    }
  }

  async function doJoin(arg) {
    if (!arg) {
      console.log(c.err("uso: join <id|slug>"));
      return;
    }
    const d = await boards();
    const list = d.boards || [];
    const q = String(arg).toLowerCase();
    const found =
      list.find((b) => String(b.id) === q) ||
      list.find((b) => String(b.slug).toLowerCase() === q) ||
      list.find((b) => String(b.name).toLowerCase().includes(q));
    if (!found) {
      console.log(c.err(`board no encontrado: ${arg}`));
      return;
    }
    await joinBoard(found.id);
    board = {
      id: Number(found.id),
      slug: found.slug,
      name: found.name,
    };
    lastId = 0;
    const hist = await messages(board.id, 0);
    const listM = hist.messages || [];
    console.log(c.ok(`\n// unido a ${board.name} (#${board.id})`));
    console.log(c.dim("— últimas mensajes —"));
    for (const m of listM.slice(-30)) {
      if (m.deleted) continue;
      console.log(fmtMsg(m));
      lastId = Math.max(lastId, m.id);
    }
    console.log(c.dim("— fin historial · escribí para chatear · /leave —\n"));
    startPoll();
  }

  async function doLeave() {
    stopPoll();
    board = null;
    lastId = 0;
    console.log(c.dim("saliste del board"));
  }

  async function handleLine(line) {
    const raw = line.replace(/\r$/, "");
    const t = raw.trim();
    if (!t) return;

    // en board: comandos con / o keywords
    const isCmd =
      t.startsWith("/") ||
      /^(help|login|logout|boards|join|leave|exit|quit|me|whoami|avatar|banner|profile|nick|bio|clear)\b/i.test(
        t
      );

    if (!isCmd && board) {
      // mensaje de chat
      try {
        const d = await sendMessage(board.id, raw);
        if (d.message) {
          console.log(fmtMsg(d.message, true));
          lastId = Math.max(lastId, d.message.id);
        }
      } catch (e) {
        console.log(c.err(e.message));
      }
      return;
    }

    const parts = t.replace(/^\//, "").split(/\s+/);
    const cmd = (parts[0] || "").toLowerCase();
    const args = parts.slice(1);
    const rest = t.replace(/^\//, "").slice(cmd.length).trim();

    try {
      switch (cmd) {
        case "help":
        case "?":
          printHelp();
          break;
        case "login":
          await doLogin(args);
          break;
        case "logout":
          await logout();
          username = null;
          await doLeave();
          console.log(c.dim("sesión cerrada"));
          break;
        case "me":
        case "whoami": {
          const d = await me();
          const u = d.user;
          if (!u) {
            console.log(c.err("no logueado"));
            break;
          }
          username = u.username;
          console.log(
            c.ok(
              `@${u.username}` +
                (u.display_name ? ` (${u.display_name})` : "") +
                (u.is_vip ? " [VIP]" : "") +
                (u.avatar_url ? ` avatar=${u.avatar_url}` : "") +
                (u.banner_url ? ` banner=${u.banner_url}` : "")
            )
          );
          break;
        }
        case "boards":
        case "ls":
          await doBoards();
          break;
        case "join":
        case "j":
          await doJoin(args[0] || rest);
          break;
        case "leave":
        case "part":
          await doLeave();
          break;
        case "avatar":
          if (!args[0]) {
            console.log(c.err("uso: avatar /ruta/foto.jpg"));
            break;
          }
          {
            const r = await setProfileMedia("avatar", args[0]);
            console.log(c.ok(`avatar ok · id=${r.mediaId} · ${r.url}`));
          }
          break;
        case "banner":
          if (!args[0]) {
            console.log(c.err("uso: banner /ruta/imagen.jpg  (VIP)"));
            break;
          }
          {
            const r = await setProfileMedia("banner", args[0]);
            console.log(c.ok(`banner ok · id=${r.mediaId} · ${r.url}`));
          }
          break;
        case "nick":
        case "display":
          if (!rest) {
            console.log(c.err("uso: nick Nombre Visible"));
            break;
          }
          await patchProfile({ display_name: rest });
          console.log(c.ok(`display_name = ${rest}`));
          break;
        case "bio":
          await patchProfile({ bio: rest.slice(0, 100) });
          console.log(c.ok("bio actualizada"));
          break;
        case "profile":
          await doBoards(); // noop if just want profile
          {
            const d = await me();
            const u = d.user;
            if (!u) {
              console.log(c.err("login primero"));
              break;
            }
            console.log(JSON.stringify(u, null, 2));
          }
          break;
        case "clear":
          console.clear();
          console.log(banner());
          break;
        case "exit":
        case "quit":
        case "q":
          stopPoll();
          rl.close();
          return "exit";
        default:
          if (board) {
            // fallback send
            const d = await sendMessage(board.id, raw);
            if (d.message) {
              console.log(fmtMsg(d.message, true));
              lastId = Math.max(lastId, d.message.id);
            }
          } else {
            console.log(c.err(`comando desconocido: ${cmd} · help`));
          }
      }
    } catch (e) {
      console.log(c.err(e.message || String(e)));
    }
  }

  // bootstrap session
  try {
    if (loadSession()?.cookie) {
      const d = await me();
      if (d.user) {
        username = d.user.username;
        console.log(c.dim(`sesión: @${username}`));
      }
    }
  } catch {
    clearSession();
    console.log(c.dim("sin sesión — login <user> <pass>"));
  }

  if (initialBoard) {
    try {
      await doJoin(initialBoard);
    } catch (e) {
      console.log(c.err(e.message));
    }
  }

  setPrompt();

  for await (const line of rl) {
    const r = await handleLine(line);
    if (r === "exit") break;
    setPrompt();
  }

  stopPoll();
  console.log(c.dim("\n// kcc out"));
}

function printHelp() {
  console.log(`
${c.accent("KCC CLI · solo // nexo")}
  help                 esta ayuda
  login [user] [pass]  iniciar sesión
  logout               cerrar sesión
  me / whoami          usuario actual
  boards / ls          listar boards nexo
  join <id|slug>       entrar al chat del board
  leave                salir del board
  <texto>              (en un board) enviar mensaje

${c.accent("perfil (solo CLI)")}
  avatar <archivo>     foto de perfil (jpg/png/webp/gif ≤8MB)
  banner <archivo>     banner VIP
  nick <nombre>        display name
  bio <texto>          biografía (≤100)
  profile              dump JSON del perfil

  clear                limpiar pantalla
  exit / quit          salir
`);
}

function ask(rl, q, hidden = false) {
  return new Promise((resolve) => {
    if (!hidden) {
      rl.question(q, resolve);
      return;
    }
    // password mask simple
    const stdin = process.stdin;
    process.stdout.write(q);
    let buf = "";
    const onData = (ch) => {
      const s = ch.toString("utf8");
      if (s === "\n" || s === "\r" || s === "\u0004") {
        stdin.removeListener("data", onData);
        if (stdin.isTTY) stdin.setRawMode(false);
        process.stdout.write("\n");
        resolve(buf);
        return;
      }
      if (s === "\u0003") {
        process.exit(130);
      }
      if (s === "\u007f" || s === "\b") {
        buf = buf.slice(0, -1);
        return;
      }
      buf += s;
    };
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.on("data", onData);
  });
}

module.exports = { runShell, printHelp };
