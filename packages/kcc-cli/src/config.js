"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const DIR = path.join(os.homedir(), ".kcc");
const SESSION_FILE = path.join(DIR, "session.json");

const DEFAULT_BASE =
  process.env.KCC_API_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.knightscomputer.club";

function ensureDir() {
  if (!fs.existsSync(DIR)) {
    fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  }
}

function loadSession() {
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(data) {
  ensureDir();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), {
    mode: 0o600,
  });
}

function clearSession() {
  try {
    fs.unlinkSync(SESSION_FILE);
  } catch {
    /* */
  }
}

function getBaseUrl() {
  const s = loadSession();
  const base = (s && s.baseUrl) || DEFAULT_BASE;
  return String(base).replace(/\/$/, "");
}

function getCookie() {
  const s = loadSession();
  return (s && s.cookie) || "";
}

module.exports = {
  DIR,
  SESSION_FILE,
  DEFAULT_BASE,
  loadSession,
  saveSession,
  clearSession,
  getBaseUrl,
  getCookie,
  ensureDir,
};
