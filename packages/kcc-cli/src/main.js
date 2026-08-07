"use strict";

const {
  login,
  logout,
  me,
  boards,
  setProfileMedia,
  patchProfile,
} = require("./api");
const { loadSession, getBaseUrl, clearSession, saveSession } = require("./config");
const { runShell, printHelp } = require("./shell");
const { c, banner } = require("./style");

async function main(argv) {
  const [cmd, ...args] = argv;

  if (!cmd || cmd === "shell" || cmd === "sh" || cmd === "repl") {
    await runShell(args[0] || null);
    return;
  }

  switch (cmd) {
    case "help":
    case "-h":
    case "--help":
      printHelp();
      console.log(`
${c.dim("one-shot:")}
  kcc login <user> <pass>
  kcc boards
  kcc join <slug>     (abre shell en ese board)
  kcc avatar <file>
  kcc banner <file>
  kcc base <url>      (API base, default prod)
`);
      break;

    case "base": {
      const url = args[0];
      if (!url) {
        console.log(getBaseUrl());
        break;
      }
      const s = loadSession() || {};
      saveSession({ ...s, baseUrl: url.replace(/\/$/, "") });
      console.log(c.ok(`baseUrl = ${url}`));
      break;
    }

    case "login": {
      const user = args[0];
      const pass = args[1];
      if (!user || !pass) {
        console.error("uso: kcc login <user|email> <password>");
        process.exit(1);
      }
      const u = await login(user, pass);
      console.log(c.ok(`logged in as @${u.username}`));
      break;
    }

    case "logout":
      await logout();
      console.log(c.dim("logout ok"));
      break;

    case "me":
    case "whoami": {
      const d = await me();
      console.log(JSON.stringify(d.user, null, 2));
      break;
    }

    case "boards":
    case "ls": {
      const d = await boards();
      for (const b of d.boards || []) {
        console.log(`${b.id}\t${b.slug}\t${b.name}\t@${b.owner_name}`);
      }
      break;
    }

    case "join":
    case "j":
      await runShell(args[0] || null);
      break;

    case "avatar": {
      if (!args[0]) {
        console.error("uso: kcc avatar ./foto.jpg");
        process.exit(1);
      }
      const r = await setProfileMedia("avatar", args[0]);
      console.log(c.ok(`avatar → ${r.url}`));
      break;
    }

    case "banner": {
      if (!args[0]) {
        console.error("uso: kcc banner ./banner.jpg  (VIP)");
        process.exit(1);
      }
      const r = await setProfileMedia("banner", args[0]);
      console.log(c.ok(`banner → ${r.url}`));
      break;
    }

    case "nick": {
      await patchProfile({ display_name: args.join(" ") });
      console.log(c.ok("display_name actualizado"));
      break;
    }

    case "version":
    case "-v":
    case "--version": {
      let ver = "0.0.0";
      try {
        // eslint-disable-next-line import/no-dynamic-require, global-require
        ver = require("../package.json").version;
      } catch {
        /* */
      }
      console.log(`kcc-cli ${ver}`);
      console.log(banner());
      break;
    }

    default:
      console.error(`comando desconocido: ${cmd}`);
      console.error("kcc help");
      process.exit(1);
  }
}

module.exports = { main };
