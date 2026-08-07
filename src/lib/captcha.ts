import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 10 * 60 * 1000; // 10 min

function secret(): string {
  const s =
    process.env.CAPTCHA_SECRET ||
    process.env.JWT_SECRET ||
    "dev-captcha-insecure";
  return s;
}

export type CaptchaChallenge = {
  id: string;
  question: string;
  /** token firmado para enviar con la respuesta */
  token: string;
};

/** Genera captcha aritmético simple a+b */
export function createCaptcha(): CaptchaChallenge {
  const a = 2 + Math.floor(Math.random() * 12);
  const b = 1 + Math.floor(Math.random() * 9);
  const answer = a + b;
  const exp = Date.now() + TTL_MS;
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const payload = `${id}.${answer}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return {
    id,
    question: `${a} + ${b} = ?`,
    token: `${payload}.${sig}`,
  };
}

export function verifyCaptcha(
  token: string | null | undefined,
  answerRaw: string | number | null | undefined
): { ok: true } | { ok: false; error: string } {
  if (!token || answerRaw === null || answerRaw === undefined || answerRaw === "") {
    return { ok: false, error: "captcha requerido" };
  }
  const parts = String(token).split(".");
  if (parts.length !== 4) {
    return { ok: false, error: "captcha inválido" };
  }
  const [id, answerStr, expStr, sig] = parts;
  const payload = `${id}.${answerStr}.${expStr}`;
  const expected = createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "captcha inválido" };
    }
  } catch {
    return { ok: false, error: "captcha inválido" };
  }

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) {
    return { ok: false, error: "captcha expirado — regenerá" };
  }

  const expectedAns = Number(answerStr);
  const given = Number(String(answerRaw).trim());
  if (!Number.isFinite(given) || given !== expectedAns) {
    return { ok: false, error: "captcha incorrecto" };
  }

  return { ok: true };
}
