/**
 * Resumen diario de notificaciones por email (máx. 1 cada ~24h).
 */

import { ensureSchema, getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/site";

const APP_ID = process.env.NOTIFY_APP_ID || "knightscomputer";
/** Usuarios por corrida de cron (evitar timeout Vercel) */
const MAX_USERS_PER_RUN = 80;
const MAX_ITEMS_PER_EMAIL = 40;

export type DigestItem = {
  type: string;
  title: string;
  body: string;
  href: string | null;
  created_at: string;
  actor_label: string | null;
};

export type DigestRunResult = {
  candidates: number;
  sent: number;
  skippedEmpty: number;
  errors: number;
  details: Array<{ userId: number; username: string; status: string; n?: number }>;
};

function typeLabel(type: string): string {
  if (type === "nexo.dm") return "DM";
  if (type === "nexo.mention") return "mención";
  if (type.startsWith("forum.")) return "foro";
  if (type.startsWith("friend")) return "amigos";
  return type || "aviso";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sinceForUser(lastSent: string | null | undefined): Date {
  if (lastSent) {
    const t = new Date(lastSent).getTime();
    if (Number.isFinite(t)) return new Date(t);
  }
  // primera vez: últimas 24h
  return new Date(Date.now() - 24 * 60 * 60_000);
}

export function buildDigestEmail(opts: {
  username: string;
  items: DigestItem[];
  siteUrl: string;
}): { subject: string; text: string; html: string } {
  const n = opts.items.length;
  const subject = `[knightscomputer.club] resumen · ${n} notificación${n === 1 ? "" : "es"}`;
  const site = opts.siteUrl.replace(/\/$/, "");
  const lines = [
    `Hola @${opts.username},`,
    ``,
    `Resumen de las últimas ~24h en knightscomputer.club:`,
    ``,
  ];
  for (const it of opts.items) {
    const when = (() => {
      try {
        return new Date(it.created_at).toLocaleString("es-ES", {
          timeZone: "UTC",
          dateStyle: "short",
          timeStyle: "short",
        });
      } catch {
        return "";
      }
    })();
    const kind = typeLabel(it.type);
    lines.push(`• [${kind}] ${it.title}`);
    if (it.body) lines.push(`  ${it.body.slice(0, 160)}`);
    if (it.href) {
      const url = it.href.startsWith("http") ? it.href : `${site}${it.href}`;
      lines.push(`  → ${url}`);
    }
    if (when) lines.push(`  (${when} UTC)`);
    lines.push(``);
  }
  lines.push(`Ver todas: ${site}/`);
  lines.push(`Preferencias (silenciar resumen): ${site}/settings`);
  lines.push(``);
  lines.push(`— knightscomputer.club`);
  lines.push(`(máximo un correo cada 24 horas; no es un aviso instantáneo)`);

  const itemsHtml = opts.items
    .map((it) => {
      const kind = escapeHtml(typeLabel(it.type));
      const title = escapeHtml(it.title);
      const body = it.body
        ? `<div style="color:#8ab898;font-size:13px;margin:4px 0 0">${escapeHtml(it.body.slice(0, 200))}</div>`
        : "";
      const href = it.href
        ? it.href.startsWith("http")
          ? it.href
          : `${site}${it.href}`
        : null;
      const link = href
        ? `<a href="${escapeHtml(href)}" style="color:#33ff66;font-size:12px">abrir →</a>`
        : "";
      return `<li style="margin:0 0 14px;padding:0 0 12px;border-bottom:1px solid #1f5a2a">
        <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5a8a62">${kind}</div>
        <div style="color:#b8ffc8;font-weight:600;margin-top:2px">${title}</div>
        ${body}
        ${link ? `<div style="margin-top:6px">${link}</div>` : ""}
      </li>`;
    })
    .join("");

  const html = `
    <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#050805;color:#b8ffc8;padding:28px;border-radius:6px;max-width:560px;margin:0 auto">
      <p style="margin:0 0 4px;color:#33ff66;letter-spacing:0.06em;font-size:12px">// knightscomputer.club</p>
      <h1 style="margin:0 0 16px;font-size:18px;color:#00ff41;font-weight:600">Resumen de notificaciones</h1>
      <p style="margin:0 0 18px;color:#8ab898;font-size:14px">
        Hola <strong>@${escapeHtml(opts.username)}</strong> — ${n} aviso${n === 1 ? "" : "s"} en las últimas ~24h.
      </p>
      <ul style="list-style:none;margin:0;padding:0">${itemsHtml}</ul>
      <p style="margin:20px 0 0;font-size:13px">
        <a href="${escapeHtml(site)}/" style="color:#33ff66">abrir el nodo</a>
        ·
        <a href="${escapeHtml(site)}/settings" style="color:#5a8a62">preferencias</a>
      </p>
      <p style="margin:16px 0 0;color:#5a8a62;font-size:11px">
        Un solo correo cada 24 horas. Podés desactivar el resumen en /settings → privacidad.
      </p>
    </div>
  `;

  return { subject, text: lines.join("\n"), html };
}

/**
 * Envía digests pendientes (usuarios con ≥1 notificación nueva y sin email en 24h).
 */
export async function runEmailDigestJob(): Promise<DigestRunResult> {
  await ensureSchema();
  const db = getDb();
  const siteUrl = getSiteUrl();
  const result: DigestRunResult = {
    candidates: 0,
    sent: 0,
    skippedEmpty: 0,
    errors: 0,
    details: [],
  };

  const users = await db`
    SELECT
      id, username, email, email_digest_last_sent
    FROM users
    WHERE email_verified IS TRUE
      AND banned IS NOT TRUE
      AND deleted_at IS NULL
      AND COALESCE(email_digest_enabled, TRUE) IS TRUE
      AND email IS NOT NULL
      AND email <> ''
      AND (
        email_digest_last_sent IS NULL
        OR email_digest_last_sent < NOW() - INTERVAL '23 hours'
      )
    ORDER BY email_digest_last_sent ASC NULLS FIRST
    LIMIT ${MAX_USERS_PER_RUN}
  `;

  result.candidates = users.length;

  for (const u of users as Array<{
    id: number;
    username: string;
    email: string;
    email_digest_last_sent: string | null;
  }>) {
    const userId = Number(u.id);
    const username = String(u.username);
    const email = String(u.email).trim().toLowerCase();
    if (!email.includes("@")) {
      result.skippedEmpty += 1;
      result.details.push({ userId, username, status: "no_email" });
      continue;
    }

    const since = sinceForUser(
      u.email_digest_last_sent ? String(u.email_digest_last_sent) : null
    );
    const sinceIso = since.toISOString();

    let items: DigestItem[] = [];
    try {
      const rows = await db`
        SELECT type, title, body, href, created_at, actor_label
        FROM web_notifications
        WHERE app_id = ${APP_ID}
          AND user_id = ${userId}
          AND created_at > ${sinceIso}::timestamptz
        ORDER BY created_at DESC
        LIMIT ${MAX_ITEMS_PER_EMAIL}
      `;
      items = (rows as Record<string, unknown>[]).map((r) => ({
        type: String(r.type || "system"),
        title: String(r.title || ""),
        body: String(r.body || ""),
        href: r.href != null ? String(r.href) : null,
        created_at: String(r.created_at),
        actor_label: r.actor_label != null ? String(r.actor_label) : null,
      }));
    } catch (e) {
      console.error("[email-digest] load notifications", userId, e);
      result.errors += 1;
      result.details.push({ userId, username, status: "load_error" });
      continue;
    }

    if (!items.length) {
      // avanzar reloj para no re-consultar cada hora sin actividad
      try {
        await db`
          UPDATE users
          SET email_digest_last_sent = NOW()
          WHERE id = ${userId}
        `;
      } catch {
        /* */
      }
      result.skippedEmpty += 1;
      result.details.push({ userId, username, status: "empty" });
      continue;
    }

    const mail = buildDigestEmail({ username, items, siteUrl });
    const sent = await sendEmail({
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    if (!sent.ok) {
      console.error("[email-digest] send fail", userId, sent.error);
      result.errors += 1;
      result.details.push({
        userId,
        username,
        status: `send_fail:${sent.error.slice(0, 80)}`,
        n: items.length,
      });
      continue;
    }

    try {
      await db`
        UPDATE users
        SET email_digest_last_sent = NOW()
        WHERE id = ${userId}
      `;
    } catch (e) {
      console.error("[email-digest] stamp last_sent", userId, e);
    }

    result.sent += 1;
    result.details.push({
      userId,
      username,
      status: "sent",
      n: items.length,
    });
  }

  return result;
}
