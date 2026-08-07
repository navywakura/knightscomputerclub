"use strict";

const fs = require("fs");
const path = require("path");
const {
  getBaseUrl,
  getCookie,
  loadSession,
  saveSession,
  clearSession,
} = require("./config");

function extractSessionCookie(res) {
  // Node 18+ 
  let cookies = [];
  if (typeof res.headers.getSetCookie === "function") {
    cookies = res.headers.getSetCookie();
  } else {
    const sc = res.headers.get("set-cookie");
    if (sc) cookies = [sc];
  }
  for (const c of cookies) {
    const m = String(c).match(/kc_session=([^;]+)/);
    if (m) return `kc_session=${m[1]}`;
  }
  return null;
}

async function api(method, p, { body, formData, json = true } = {}) {
  const base = getBaseUrl();
  const cookie = getCookie();
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body && !formData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${base}${p}`, {
    method,
    headers,
    body: formData
      ? formData
      : body
        ? JSON.stringify(body)
        : undefined,
  });

  // refresh cookie if rotated
  const nextCookie = extractSessionCookie(res);
  if (nextCookie) {
    const s = loadSession() || {};
    saveSession({ ...s, cookie: nextCookie, baseUrl: base });
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(
      (data && (data.error || data.message)) || `HTTP ${res.status}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function login(login, password) {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `login falló (${res.status})`);
  }
  const cookie = extractSessionCookie(res);
  if (!cookie) {
    throw new Error(
      "login OK pero sin cookie kc_session — ¿proxy strippea Set-Cookie?"
    );
  }
  saveSession({
    cookie,
    baseUrl: base,
    user: data.user || null,
    loggedAt: new Date().toISOString(),
  });
  return data.user;
}

async function logout() {
  try {
    await api("POST", "/api/auth/logout");
  } catch {
    /* */
  }
  clearSession();
}

async function me() {
  return api("GET", "/api/auth/me");
}

async function boards() {
  return api("GET", "/api/nexo/boards");
}

async function messages(boardId, after = 0) {
  const q = after
    ? `?board=${boardId}&after=${after}`
    : `?board=${boardId}`;
  return api("GET", `/api/nexo/messages${q}`);
}

async function sendMessage(boardId, body) {
  return api("POST", "/api/nexo/messages", {
    body: { board_id: boardId, body },
  });
}

async function joinBoard(boardId) {
  return api("POST", "/api/nexo/members", {
    body: { board_id: boardId },
  });
}

/**
 * Sube imagen a /api/media y la asigna como avatar o banner.
 * @param {"avatar"|"banner"} kind
 * @param {string} filePath
 */
async function setProfileMedia(kind, filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`archivo no existe: ${abs}`);
  }
  const buf = fs.readFileSync(abs);
  if (buf.length > 8 * 1024 * 1024) {
    throw new Error("archivo > 8MB");
  }
  const name = path.basename(abs);
  const ext = path.extname(name).toLowerCase();
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
          ? "image/gif"
          : "image/jpeg";

  // Node 18+: FormData + Blob/File
  const form = new FormData();
  const bytes = new Uint8Array(buf);
  let part;
  if (typeof File !== "undefined") {
    part = new File([bytes], name || "upload.jpg", { type: mime });
    form.append("file", part);
  } else {
    part = new Blob([bytes], { type: mime });
    form.append("file", part, name || "upload.jpg");
  }

  const base = getBaseUrl();
  const cookie = getCookie();
  if (!cookie) throw new Error("no hay sesión — kcc login");

  const up = await fetch(`${base}/api/media`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  const upData = await up.json().catch(() => ({}));
  if (!up.ok) {
    throw new Error(upData.error || `upload falló (${up.status})`);
  }
  const mediaId = Number(upData.id);
  if (!mediaId) throw new Error("upload sin id");

  const patchBody =
    kind === "banner"
      ? { banner_media_id: mediaId }
      : { avatar_media_id: mediaId };

  const patch = await api("PATCH", "/api/profile", { body: patchBody });
  return { mediaId, user: patch.user, url: upData.url };
}

async function patchProfile(fields) {
  return api("PATCH", "/api/profile", { body: fields });
}

module.exports = {
  api,
  login,
  logout,
  me,
  boards,
  messages,
  sendMessage,
  joinBoard,
  setProfileMedia,
  patchProfile,
  extractSessionCookie,
};
