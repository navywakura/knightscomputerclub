/**
 * Moderación de imágenes NSFW (porno / gore) vía SpaceXAI / xAI vision.
 * Env: XAI_API_KEY (server-side only).
 */

export type NsfwResult = {
  allowed: boolean;
  reason?: string;
  labels?: string[];
  skipped?: boolean;
};

const MODEL = process.env.XAI_VISION_MODEL || "grok-4.5";

/**
 * Analiza imagen (buffer) y bloquea porno o gore.
 * Si no hay XAI_API_KEY, deniega en producción y permite en dev (con log).
 */
export async function moderateImageBuffer(
  buf: Buffer,
  mime: string
): Promise<NsfwResult> {
  const key = process.env.XAI_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      return {
        allowed: false,
        reason:
          "moderación IA no configurada (XAI_API_KEY). Contactá al admin del nodo.",
        skipped: true,
      };
    }
    console.warn("[nsfw] XAI_API_KEY ausente — skip en desarrollo");
    return { allowed: true, skipped: true };
  }

  // xAI image input: jpg/png preferidos; webp/gif → intentar igual o rechazar gif animado
  let useMime = mime;
  let useBuf = buf;
  if (mime === "image/gif" || mime === "image/webp") {
    // vision docs: jpg/png — re-label as png may fail; still try jpeg data url for jpeg only
    // for webp/gif we still send and let model handle, or convert not available without sharp
    useMime = mime === "image/webp" ? "image/webp" : "image/gif";
  }

  const b64 = useBuf.toString("base64");
  const dataUrl = `data:${useMime};base64,${b64}`;

  const prompt = `You are a strict content safety classifier for a public tech forum.
Analyze the image. Reply with ONLY compact JSON (no markdown):
{"nsfw":boolean,"porn":boolean,"gore":boolean,"labels":string[],"reason":string}

Rules:
- porn=true if sexual content, nudity for arousal, genitals, explicit sex acts
- gore=true if graphic violence, severe injury, real blood/organs for shock
- nsfw=true if porn OR gore
- artistic/non-explicit anatomy, medical diagrams, memes without explicit sex/gore: nsfw=false
Be conservative: if unsure and looks like porn or gore, set nsfw=true.`;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "low" },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[nsfw] xAI error", res.status, errText.slice(0, 400));
      // fail closed on API errors in prod
      return {
        allowed: false,
        reason: "no se pudo verificar la imagen (moderación). reintentá.",
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content || "";
    const json = extractJson(raw);
    if (!json) {
      console.error("[nsfw] bad model output", raw.slice(0, 300));
      return {
        allowed: false,
        reason: "respuesta de moderación ilegible. reintentá.",
      };
    }

    const porn = Boolean(json.porn);
    const gore = Boolean(json.gore);
    const nsfw = Boolean(json.nsfw) || porn || gore;
    const labels = Array.isArray(json.labels)
      ? json.labels.map(String).slice(0, 8)
      : [];
    const reason = String(json.reason || "").slice(0, 200);

    if (nsfw) {
      return {
        allowed: false,
        labels,
        reason:
          porn && gore
            ? "contenido bloqueado: NSFW (porno y gore)"
            : porn
              ? "contenido bloqueado: NSFW (porno / sexual)"
              : gore
                ? "contenido bloqueado: NSFW (gore / violencia gráfica)"
                : reason || "contenido bloqueado: NSFW",
      };
    }

    return { allowed: true, labels, reason };
  } catch (e) {
    console.error("[nsfw]", e);
    return {
      allowed: false,
      reason: "error de moderación de imagen. reintentá.",
    };
  }
}

function extractJson(text: string): Record<string, unknown> | null {
  const t = text.trim();
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    /* try fenced */
  }
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
