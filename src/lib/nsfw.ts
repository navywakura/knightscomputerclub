/**
 * Moderación de imágenes NSFW (porno / gore) — free-first.
 *
 * Mejor opción gratis: Google Gemini Flash (vision + free tier).
 *   1) https://aistudio.google.com/apikey → crear API key
 *   2) Vercel env: GEMINI_API_KEY=...
 *
 * Fallback gratis (opcional): Groq vision (Llama 4 Scout, etc.)
 *   GROQ_API_KEY + modelo multimodal.
 *
 * Orden por defecto (NSFW_PROVIDER=auto):
 *   gemini → groq → (opcional xai si quedó configurado)
 *
 * Env:
 *   NSFW_PROVIDER=auto|gemini|groq|xai
 *   GEMINI_API_KEY=
 *   GEMINI_VISION_MODEL=gemini-2.5-flash
 *   GROQ_API_KEY=
 *   GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
 *   XAI_API_KEY=          (legacy / opcional, no free)
 *   XAI_VISION_MODEL=grok-4.5
 */

export type NsfwResult = {
  allowed: boolean;
  reason?: string;
  labels?: string[];
  skipped?: boolean;
  provider?: string;
};

type Provider = "gemini" | "groq" | "xai";

const PROMPT = `You are a strict content safety classifier for a public tech forum.
Analyze the image. Reply with ONLY compact JSON (no markdown):
{"nsfw":boolean,"porn":boolean,"gore":boolean,"labels":string[],"reason":string}

Rules:
- porn=true if sexual content, nudity for arousal, genitals, explicit sex acts
- gore=true if graphic violence, severe injury, real blood/organs for shock
- nsfw=true if porn OR gore
- artistic/non-explicit anatomy, medical diagrams, memes without explicit sex/gore: nsfw=false
Be conservative: if unsure and looks like porn or gore, set nsfw=true.`;

/**
 * Analiza imagen (buffer) y bloquea porno o gore.
 * Sin clave free en prod → deniega. En dev sin clave → permite con log.
 */
export async function moderateImageBuffer(
  buf: Buffer,
  mime: string
): Promise<NsfwResult> {
  const providers = resolveProviders();
  if (providers.length === 0) {
    if (process.env.NODE_ENV === "production") {
      return {
        allowed: false,
        reason:
          "moderación IA no configurada. Configurá GEMINI_API_KEY (gratis en Google AI Studio).",
        skipped: true,
      };
    }
    console.warn(
      "[nsfw] sin GEMINI_API_KEY / GROQ_API_KEY — skip en desarrollo"
    );
    return { allowed: true, skipped: true };
  }

  const useMime = normalizeMime(mime);
  const b64 = buf.toString("base64");
  const dataUrl = `data:${useMime};base64,${b64}`;

  let lastFail: NsfwResult | null = null;

  for (const provider of providers) {
    try {
      const raw =
        provider === "gemini"
          ? await callGemini(b64, useMime)
          : provider === "groq"
            ? await callOpenAiCompat({
                baseUrl: "https://api.groq.com/openai/v1",
                apiKey: process.env.GROQ_API_KEY!,
                model:
                  process.env.GROQ_VISION_MODEL ||
                  "meta-llama/llama-4-scout-17b-16e-instruct",
                dataUrl,
              })
            : await callOpenAiCompat({
                baseUrl: "https://api.x.ai/v1",
                apiKey: process.env.XAI_API_KEY!,
                model: process.env.XAI_VISION_MODEL || "grok-4.5",
                dataUrl,
              });

      if (!raw.ok) {
        console.error(
          `[nsfw] ${provider} error`,
          raw.status,
          raw.text.slice(0, 400)
        );
        lastFail = {
          allowed: false,
          reason: "no se pudo verificar la imagen (moderación). reintentá.",
          provider,
        };
        // rate limit / 5xx → try next provider
        if (raw.status === 429 || raw.status >= 500) continue;
        // auth/bad request on primary: still try fallback if any
        continue;
      }

      const json = extractJson(raw.content);
      if (!json) {
        console.error(
          `[nsfw] ${provider} bad output`,
          raw.content.slice(0, 300)
        );
        lastFail = {
          allowed: false,
          reason: "respuesta de moderación ilegible. reintentá.",
          provider,
        };
        continue;
      }

      return decide(json, provider);
    } catch (e) {
      console.error(`[nsfw] ${provider}`, e);
      lastFail = {
        allowed: false,
        reason: "error de moderación de imagen. reintentá.",
        provider,
      };
    }
  }

  return (
    lastFail || {
      allowed: false,
      reason: "error de moderación de imagen. reintentá.",
    }
  );
}

function resolveProviders(): Provider[] {
  const forced = (process.env.NSFW_PROVIDER || "auto").toLowerCase().trim();
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
  const hasXai = Boolean(process.env.XAI_API_KEY?.trim());

  if (forced === "gemini") return hasGemini ? ["gemini"] : [];
  if (forced === "groq") return hasGroq ? ["groq"] : [];
  if (forced === "xai") return hasXai ? ["xai"] : [];

  // auto: free-first
  const list: Provider[] = [];
  if (hasGemini) list.push("gemini");
  if (hasGroq) list.push("groq");
  if (hasXai) list.push("xai"); // legacy paid optional
  return list;
}

function normalizeMime(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/png") return mime;
  if (mime === "image/webp") return "image/webp";
  if (mime === "image/gif") return "image/gif";
  return "image/jpeg";
}

function decide(
  json: Record<string, unknown>,
  provider: string
): NsfwResult {
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
      provider,
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

  return { allowed: true, labels, reason, provider };
}

/** Google Gemini free tier — generateContent + inline base64 */
async function callGemini(
  b64: string,
  mime: string
): Promise<{ ok: true; content: string } | { ok: false; status: number; text: string }> {
  const key = process.env.GEMINI_API_KEY!;
  const model =
    process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: PROMPT },
            {
              inline_data: {
                mime_type: mime,
                data: b64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 200,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, text };
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const content =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("") || "";

  return { ok: true, content };
}

/** OpenAI-compatible multimodal (Groq, xAI legacy) */
async function callOpenAiCompat(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  dataUrl: string;
}): Promise<{ ok: true; content: string } | { ok: false; status: number; text: string }> {
  const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "image_url",
              image_url: { url: opts.dataUrl },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, text };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content || "";
  return { ok: true, content };
}

function extractJson(text: string): Record<string, unknown> | null {
  const t = text.trim();
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    /* try fenced / embedded */
  }
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
