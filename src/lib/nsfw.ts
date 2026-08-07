/**
 * Moderación de imágenes NSFW (porno / gore) — free-first, fail-open.
 *
 * Prioridad: Gemini Flash (gratis) → Groq vision → xAI (legacy).
 *
 * Comportamiento de fallos (NSFW_FAIL_MODE):
 *   open  (default) — si no hay key / API rota / JSON ilegible → PERMITE subir
 *   closed — bloquea si no se puede verificar (antiguo, rompe avatar/banner)
 *
 * Env:
 *   GEMINI_API_KEY=          (https://aistudio.google.com/apikey)
 *   GEMINI_VISION_MODEL=gemini-2.0-flash
 *   GROQ_API_KEY=
 *   XAI_API_KEY=
 *   NSFW_PROVIDER=auto|gemini|groq|xai
 *   NSFW_FAIL_MODE=open|closed
 */

export type NsfwResult = {
  allowed: boolean;
  reason?: string;
  labels?: string[];
  skipped?: boolean;
  provider?: string;
};

type Provider = "gemini" | "groq" | "xai";

const PROMPT = `You are a content safety classifier for a public tech forum.
Reply with ONLY this JSON object (no markdown fences, no extra text):
{"nsfw":false,"porn":false,"gore":false,"labels":[],"reason":"ok"}

Rules:
- porn=true only for sexual content, genitals, explicit sex acts, or nudity clearly for arousal
- gore=true only for graphic real violence, severe injury, organs for shock value
- nsfw=true if porn OR gore; otherwise nsfw=false
- normal selfies, avatars, landscapes, memes, art, logos, screenshots: all false
- if unsure, prefer nsfw=false (false positives block profile photos)`;

function failOpen(): boolean {
  const mode = (process.env.NSFW_FAIL_MODE || "open").toLowerCase().trim();
  return mode !== "closed";
}

/**
 * Analiza imagen y bloquea solo porno/gore claros.
 * Fallos de infra / sin key → allow si NSFW_FAIL_MODE=open (default).
 */
export async function moderateImageBuffer(
  buf: Buffer,
  mime: string
): Promise<NsfwResult> {
  const providers = resolveProviders();
  if (providers.length === 0) {
    if (failOpen()) {
      console.warn(
        "[nsfw] sin API key — skip (configurá GEMINI_API_KEY para activar moderación)"
      );
      return {
        allowed: true,
        skipped: true,
        reason: "moderación desactivada (sin API key)",
      };
    }
    return {
      allowed: false,
      reason:
        "moderación IA no configurada. Configurá GEMINI_API_KEY (gratis en Google AI Studio).",
      skipped: true,
    };
  }

  // Imágenes muy grandes: no mandar a vision (timeouts / 400); permitir
  // (el upload ya limita a 8MB; re-encode en cliente suele dejar <2MB)
  if (buf.length > 4 * 1024 * 1024) {
    console.warn("[nsfw] imagen >4MB — skip vision, allow");
    return {
      allowed: true,
      skipped: true,
      reason: "skip vision (archivo grande)",
    };
  }

  const useMime = normalizeMime(mime);
  const b64 = buf.toString("base64");
  const dataUrl = `data:${useMime};base64,${b64}`;

  let lastInfraFail: NsfwResult | null = null;

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
        lastInfraFail = {
          allowed: false,
          reason: "no se pudo verificar la imagen (moderación). reintentá.",
          provider,
        };
        continue;
      }

      const json = extractJson(raw.content);
      if (!json) {
        console.error(
          `[nsfw] ${provider} bad output`,
          raw.content.slice(0, 400)
        );
        lastInfraFail = {
          allowed: false,
          reason: "respuesta de moderación ilegible. reintentá.",
          provider,
        };
        continue;
      }

      return decide(json, provider);
    } catch (e) {
      console.error(`[nsfw] ${provider}`, e);
      lastInfraFail = {
        allowed: false,
        reason: "error de moderación de imagen. reintentá.",
        provider,
      };
    }
  }

  // Todos los providers fallaron (infra) — no bloquear perfil/avatar por default
  if (failOpen()) {
    console.warn("[nsfw] providers fallaron — allow (NSFW_FAIL_MODE=open)");
    return {
      allowed: true,
      skipped: true,
      reason: "moderación no disponible (allow)",
      provider: lastInfraFail?.provider,
    };
  }

  return (
    lastInfraFail || {
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

  const list: Provider[] = [];
  if (hasGemini) list.push("gemini");
  if (hasGroq) list.push("groq");
  if (hasXai) list.push("xai");
  return list;
}

function normalizeMime(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/jpg") return "image/jpeg";
  if (mime === "image/png") return "image/png";
  if (mime === "image/webp") return "image/webp";
  if (mime === "image/gif") return "image/gif";
  return "image/jpeg";
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
}

function decide(
  json: Record<string, unknown>,
  provider: string
): NsfwResult {
  const porn = asBool(json.porn);
  const gore = asBool(json.gore);
  // solo confiar en nsfw si es true explícito; si el modelo manda basura, asBool false
  const nsfw = asBool(json.nsfw) || porn || gore;
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

/** Lista de modelos a probar (Gemini free tier varía por cuenta) */
function geminiModels(): string[] {
  const preferred = process.env.GEMINI_VISION_MODEL?.trim();
  const defaults = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-2.5-flash",
  ];
  if (preferred) {
    return [preferred, ...defaults.filter((m) => m !== preferred)];
  }
  return defaults;
}

/** Google Gemini free tier — generateContent + inline base64 */
async function callGemini(
  b64: string,
  mime: string
): Promise<{ ok: true; content: string } | { ok: false; status: number; text: string }> {
  const key = process.env.GEMINI_API_KEY!;
  let lastFail: { ok: false; status: number; text: string } = {
    ok: false,
    status: 0,
    text: "no model tried",
  };

  for (const model of geminiModels()) {
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
                // REST API usa snake_case; algunas libs camelCase — mandamos snake
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
          // 2.5-flash "thinking" puede consumir tokens; dejar margen
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      lastFail = { ok: false, status: res.status, text };
      // 404 model not found → try next
      if (res.status === 404 || res.status === 400) {
        console.warn(`[nsfw] gemini model ${model} → ${res.status}`);
        continue;
      }
      return lastFail;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      promptFeedback?: { blockReason?: string };
    };

    // Gemini safety block del propio prompt/imagen → tratar como nsfw
    if (data.promptFeedback?.blockReason) {
      return {
        ok: true,
        content: JSON.stringify({
          nsfw: true,
          porn: true,
          gore: false,
          labels: ["gemini_safety"],
          reason: String(data.promptFeedback.blockReason),
        }),
      };
    }

    const content =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim() || "";

    if (!content) {
      lastFail = {
        ok: false,
        status: 502,
        text: `empty content from ${model} finish=${data.candidates?.[0]?.finishReason || "?"}`,
      };
      continue;
    }

    return { ok: true, content };
  }

  return lastFail;
}

/** OpenAI-compatible multimodal (Groq, xAI legacy) */
async function callOpenAiCompat(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  dataUrl: string;
}): Promise<{ ok: true; content: string } | { ok: false; status: number; text: string }> {
  const res = await fetch(
    `${opts.baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0,
        max_tokens: 300,
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
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, text };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = String(data.choices?.[0]?.message?.content || "").trim();
  if (!content) {
    return { ok: false, status: 502, text: "empty content" };
  }
  return { ok: true, content };
}

function extractJson(text: string): Record<string, unknown> | null {
  const t = text.trim();
  if (!t) return null;

  // strip markdown fences
  const unfenced = t
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced) as Record<string, unknown>;
  } catch {
    /* embedded object */
  }

  const m = unfenced.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
