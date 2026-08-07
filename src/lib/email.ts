/**
 * Envío de email (OTP verificación) vía Resend.
 * https://resend.com/docs/send-with-nodejs
 *
 * Prod requiere:
 *   RESEND_API_KEY=re_...
 *   EMAIL_FROM="Nodo KCC <noreply@tudominio-verificado.com>"
 *
 * El default onboarding@resend.dev SOLO entrega al email de la cuenta Resend.
 */

function trimEnv(name: string): string {
  const v = process.env[name];
  if (!v) return "";
  // Vercel a veces guarda comillas literales al pegar
  return v.trim().replace(/^['"]|['"]$/g, "");
}

/** Normaliza "Name <a@b.c>" o "a@b.c" */
export function normalizeFromAddress(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const angled = s.match(/^(.+?)\s*<\s*([^<>\s@]+@[^<>\s@]+)\s*>$/);
  if (angled) {
    const name = angled[1].trim().replace(/^["']|["']$/g, "");
    const email = angled[2].trim().toLowerCase();
    if (!email.includes("@")) return null;
    return name ? `${name} <${email}>` : email;
  }
  // solo email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s.toLowerCase();
  return null;
}

function isDevSandboxFrom(from: string): boolean {
  return /onboarding@resend\.dev/i.test(from);
}

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; status?: number; detail?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  const key = trimEnv("RESEND_API_KEY");
  const fromRaw = trimEnv("EMAIL_FROM");
  const fromNormalized = normalizeFromAddress(fromRaw);
  const from =
    fromNormalized ||
    "knightscomputer.club <onboarding@resend.dev>";

  if (!key) {
    console.warn(
      "[email] RESEND_API_KEY ausente — OTP en logs (solo dev):\n",
      opts.subject,
      "→",
      opts.to,
      "\n",
      opts.text
    );
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error:
          "RESEND_API_KEY no está en Vercel (Production). Añadila y Redeploy.",
      };
    }
    return { ok: true };
  }

  if (process.env.NODE_ENV === "production") {
    if (!fromRaw || !fromNormalized) {
      return {
        ok: false,
        error:
          'EMAIL_FROM inválido o vacío. Usá: Nodo <noreply@tudominio.com> (dominio verificado en Resend).',
      };
    }
    if (isDevSandboxFrom(from)) {
      return {
        ok: false,
        error:
          "EMAIL_FROM sigue en onboarding@resend.dev — en prod solo llega a tu email de Resend. Poné un from del dominio verificado.",
      };
    }
  }

  const to = opts.to.trim().toLowerCase();
  if (!to.includes("@")) {
    return { ok: false, error: "destinatario inválido" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html || `<pre>${escapeHtml(opts.text)}</pre>`,
      }),
    });

    const rawBody = await res.text().catch(() => "");
    let parsed: { id?: string; message?: string; name?: string; statusCode?: number } =
      {};
    try {
      parsed = rawBody ? (JSON.parse(rawBody) as typeof parsed) : {};
    } catch {
      /* body no JSON */
    }

    if (!res.ok) {
      const resendMsg =
        parsed.message ||
        parsed.name ||
        rawBody.slice(0, 280) ||
        `HTTP ${res.status}`;
      console.error("[email] resend fail", {
        status: res.status,
        from,
        to,
        resendMsg: resendMsg.slice(0, 300),
      });

      // mensajes accionables (sin filtrar la API key)
      let error = "no se pudo enviar el email (Resend)";
      if (res.status === 401 || res.status === 403) {
        error =
          "RESEND_API_KEY rechazada (401/403). Revisá la key en Vercel Production.";
      } else if (/domain|not verified|from/i.test(resendMsg)) {
        error = `Resend rechazó el remitente: ${resendMsg}. Verificá el dominio y EMAIL_FROM.`;
      } else if (/invalid/i.test(resendMsg)) {
        error = `Resend: ${resendMsg}`;
      } else if (res.status >= 500) {
        error = "Resend caído temporalmente — reintentá en un minuto.";
      } else {
        error = `Resend (${res.status}): ${resendMsg}`;
      }

      return {
        ok: false,
        error,
        status: res.status,
        detail: resendMsg.slice(0, 200),
      };
    }

    console.log("[email] resend ok", {
      id: parsed.id,
      to: to.replace(/(.{2}).+(@.+)/, "$1***$2"),
      from,
    });
    return { ok: true, id: parsed.id };
  } catch (e) {
    console.error("[email] network", e);
    return { ok: false, error: "error de red al contactar Resend" };
  }
}

export async function sendOtpEmail(
  to: string,
  code: string,
  username: string,
  purpose: "verify" | "change" = "verify"
) {
  const isChange = purpose === "change";
  // No poner el código en el subject (filtros spam / previews)
  const subject = isChange
    ? `[knightscomputer.club] confirmar nuevo email`
    : `[knightscomputer.club] código de verificación`;
  const line = isChange
    ? "Tu código OTP para confirmar el cambio de correo es:"
    : "Tu código OTP para verificar la cuenta es:";
  return sendEmail({
    to,
    subject,
    text: [
      `Hola @${username},`,
      ``,
      line,
      ``,
      `  ${code}`,
      ``,
      `Válido 15 minutos. Si no pediste esto, ignorá el mensaje.`,
      ``,
      `— knightscomputer.club`,
    ].join("\n"),
    html: `
      <div style="font-family:ui-monospace,monospace;background:#050805;color:#b8ffc8;padding:24px;border-radius:4px">
        <p style="margin:0 0 12px">Hola <strong>@${escapeHtml(username)}</strong>,</p>
        <p style="margin:0 0 8px;color:#8ab898">${escapeHtml(line)}</p>
        <p style="font-size:28px;letter-spacing:0.25em;color:#33ff66;margin:16px 0"><strong>${escapeHtml(code)}</strong></p>
        <p style="color:#5a8a62;margin:0;font-size:13px">Válido 15 minutos · knightscomputer.club</p>
      </div>
    `,
  });
}

/** Diagnóstico no secreto: ¿email listo en este runtime? */
export function emailConfigStatus(): {
  hasApiKey: boolean;
  hasFrom: boolean;
  fromLooksValid: boolean;
  fromIsSandbox: boolean;
  fromPreview: string | null;
  productionReady: boolean;
} {
  const key = trimEnv("RESEND_API_KEY");
  const fromRaw = trimEnv("EMAIL_FROM");
  const from = normalizeFromAddress(fromRaw);
  const fromIsSandbox = from ? isDevSandboxFrom(from) : true;
  return {
    hasApiKey: Boolean(key),
    hasFrom: Boolean(fromRaw),
    fromLooksValid: Boolean(from),
    fromIsSandbox,
    fromPreview: from
      ? from.replace(/([^<\s])[^<\s@]*(@)/, "$1***$2")
      : null,
    productionReady: Boolean(key && from && !fromIsSandbox),
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
