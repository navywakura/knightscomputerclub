/**
 * Cifrado zero-knowledge en el browser (Web Crypto API).
 * AES-GCM-256; la key nunca se envía al servidor.
 */

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function generatePasteKey(): Promise<string> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return b64urlEncode(raw);
}

export async function encryptPaste(
  plaintext: string,
  keyB64: string
): Promise<{ ciphertext: string; iv: string }> {
  const keyBytes = b64urlDecode(keyB64);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  return {
    ciphertext: b64urlEncode(ct),
    iv: b64urlEncode(iv),
  };
}

export async function decryptPaste(
  ciphertextB64: string,
  ivB64: string,
  keyB64: string
): Promise<string> {
  const keyBytes = b64urlDecode(keyB64);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const iv = b64urlDecode(ivB64);
  const ct = b64urlDecode(ciphertextB64);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    ct.buffer as ArrayBuffer
  );
  return new TextDecoder().decode(pt);
}

/** Lee #k=... del hash */
export function keyFromHash(hash: string): string | null {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  const k = params.get("k") || params.get("key");
  return k && k.length >= 16 ? k : null;
}

export function hashWithKey(key: string): string {
  return `#k=${key}`;
}
