/**
 * Envío de email (OTP verificación).
 * Preferido: RESEND_API_KEY (https://resend.com) — funciona bien en Vercel.
 * Fallback dev: log del OTP a consola.
 */

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM || "knightscomputer.club <onboarding@resend.dev>";

  if (!key) {
    console.warn(
      "[email] RESEND_API_KEY no configurada — OTP en logs (solo dev):\n",
      opts.subject,
      "→",
      opts.to,
      "\n",
      opts.text
    );
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error: "email no configurado (RESEND_API_KEY). contactá al admin.",
      };
    }
    return { ok: true };
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
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html || `<pre>${escapeHtml(opts.text)}</pre>`,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[email] resend", res.status, t.slice(0, 300));
      return { ok: false, error: "no se pudo enviar el email" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email]", e);
    return { ok: false, error: "error de red al enviar email" };
  }
}

export async function sendOtpEmail(to: string, code: string, username: string) {
  return sendEmail({
    to,
    subject: `[knightscomputer.club] código de verificación: ${code}`,
    text: [
      `Hola @${username},`,
      ``,
      `Tu código OTP para verificar la cuenta es:`,
      ``,
      `  ${code}`,
      ``,
      `Válido 15 minutos. Si no pediste esto, ignorá el mensaje.`,
      ``,
      `— knightscomputer.club`,
    ].join("\n"),
    html: `
      <div style="font-family:monospace;background:#050805;color:#b8ffc8;padding:24px">
        <p>Hola <strong>@${escapeHtml(username)}</strong>,</p>
        <p>Tu código OTP:</p>
        <p style="font-size:28px;letter-spacing:0.2em;color:#33ff66"><strong>${escapeHtml(code)}</strong></p>
        <p style="color:#5a8a62">Válido 15 minutos.</p>
      </div>
    `,
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
