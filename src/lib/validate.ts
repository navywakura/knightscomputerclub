/**
 * Validación estricta de entrada (anti-tampering Burp / fuzzing).
 * Solo campos permitidos; tipos estrictos.
 */
import { z } from "zod";

const captchaAnswer = z.union([z.string(), z.number()]).optional();
const captchaToken = z.string().max(500).optional();

export const loginSchema = z
  .object({
    username: z.string().min(1).max(64).optional(),
    email: z.string().email().max(255).optional(),
    password: z.string().min(1).max(128),
    login: z.string().min(1).max(255).optional(),
  })
  .strict();

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9_\-]+$/),
    email: z.string().email().max(255),
    password: z.string().min(8).max(128),
    captcha_token: captchaToken,
    captcha_answer: captchaAnswer,
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    code: z.string().min(4).max(12).optional(),
    otp: z.string().min(4).max(12).optional(),
    email: z.string().email().max(255).optional(),
  })
  .strict();

export const forumPostSchema = z
  .object({
    thread_id: z.coerce.number().int().positive().optional(),
    thread: z.coerce.number().int().positive().optional(),
    body: z.string().min(1).max(20000).optional(),
    content: z.string().min(1).max(20000).optional(),
    captcha_token: captchaToken,
    captcha_answer: captchaAnswer,
    sign_pgp: z.union([z.boolean(), z.literal("1"), z.literal("0")]).optional(),
    pgp_signature: z.string().max(16000).optional(),
  })
  .strict();

export const forumPostDeleteSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

export const forumThreadSchema = z
  .object({
    category: z.string().min(1).max(64).optional(),
    category_slug: z.string().min(1).max(64).optional(),
    title: z.string().min(3).max(200),
    body: z.string().min(3).max(20000).optional(),
    content: z.string().min(3).max(20000).optional(),
    captcha_token: captchaToken,
    captcha_answer: captchaAnswer,
  })
  .strict();

export const forumThreadDeleteSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

export const nexoMessagePostSchema = z
  .object({
    board_id: z.coerce.number().int().positive().optional(),
    board: z.coerce.number().int().positive().optional(),
    body: z.string().min(1).max(4000).optional(),
    content: z.string().min(1).max(4000).optional(),
    reply_to_id: z.coerce.number().int().positive().nullable().optional(),
  })
  .strict();

export const nexoMessagePatchSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    message_id: z.coerce.number().int().positive().optional(),
    action: z.enum(["edit", "delete", "pin", "unpin"]).optional(),
    body: z.string().min(1).max(4000).optional(),
  })
  .strict();

/** @deprecated use nexoMessagePostSchema / Patch */
export const nexoMessageSchema = nexoMessagePostSchema;

export const nexoBoardPostSchema = z
  .object({
    name: z.string().min(2).max(64),
    description: z.string().max(400).optional(),
    slug: z.string().max(48).optional(),
    icon_media_id: z
      .union([z.coerce.number().int().positive(), z.null(), z.literal("")])
      .optional(),
    captcha_token: captchaToken,
    captcha_answer: captchaAnswer,
  })
  .strict();

/** PATCH board: owner edita nombre, descripción e icono */
export const nexoBoardPatchSchema = z
  .object({
    board_id: z.coerce.number().int().positive(),
    name: z.string().min(2).max(64).optional(),
    description: z.string().max(400).optional(),
    icon_media_id: z
      .union([z.coerce.number().int().positive(), z.null(), z.literal("")])
      .optional(),
  })
  .strict();

export const nexoDmPostSchema = z
  .object({
    action: z
      .enum([
        "open",
        "unlock",
        "message",
        "edit",
        "delete",
        "ephemeral",
      ])
      .optional(),
    username: z.string().max(40).optional(),
    pin: z.string().max(8).optional(),
    thread_id: z.coerce.number().int().positive().optional(),
    body: z.string().max(4000).optional(),
    message_id: z.coerce.number().int().positive().optional(),
    id: z.coerce.number().int().positive().optional(),
    minutes: z.coerce.number().int().min(0).max(10080).optional(),
    ephemeral_minutes: z.coerce.number().int().min(0).max(10080).optional(),
  })
  .strict();

export const nexoMembersPostSchema = z
  .object({
    board_id: z.coerce.number().int().positive().optional(),
    board: z.coerce.number().int().positive().optional(),
  })
  .strict();

export const mediaJsonSchema = z
  .object({
    data: z.string().min(1).optional(),
    base64: z.string().min(1).optional(),
    mime: z.string().max(64).optional(),
    type: z.string().max(64).optional(),
    filename: z.string().max(180).optional(),
    name: z.string().max(180).optional(),
  })
  .strict();

export const profilePatchSchema = z
  .object({
    display_name: z.string().max(64).optional(),
    username: z.string().min(3).max(32).optional(),
    bio: z.string().max(100).optional(),
    profile_theme: z
      .enum([
        "matrix",
        "meadow",
        "galaxy",
        "flowers",
        "anime",
        "ocean",
        "sunset",
      ])
      .optional(),
    dm_privacy: z.enum(["everyone", "friends"]).optional(),
    avatar_media_id: z
      .union([z.coerce.number().int().positive(), z.null(), z.literal("")])
      .optional(),
    banner_media_id: z
      .union([z.coerce.number().int().positive(), z.null(), z.literal("")])
      .optional(),
    connections: z.record(z.string().max(200)).optional(),
    pgp_public_key: z.string().max(12000).optional(),
    pgp_fingerprint: z.string().max(80).optional(),
  })
  .strict();

export const profileDeleteSchema = z
  .object({
    confirm: z.string().min(1).max(64),
  })
  .strict();

export const friendsPostSchema = z
  .object({
    action: z
      .enum(["request", "accept", "reject", "cancel", "remove"])
      .optional(),
    username: z.string().max(40).optional(),
    friendship_id: z.coerce.number().int().positive().optional(),
    user_id: z.coerce.number().int().positive().optional(),
  })
  .strict();

export const reportSchema = z
  .object({
    target_type: z
      .enum([
        "forum_post",
        "forum_thread",
        "nexo_message",
        "nexo_dm",
        "user",
      ])
      .optional(),
    type: z.string().max(32).optional(),
    target_id: z.coerce.number().int().positive().optional(),
    id: z.coerce.number().int().positive().optional(),
    reason: z
      .enum([
        "spam",
        "harassment",
        "nsfw",
        "illegal",
        "impersonation",
        "other",
      ])
      .optional(),
    details: z.string().max(500).optional(),
    body: z.string().max(500).optional(),
  })
  .strict();

export const reportPatchSchema = z
  .object({
    id: z.coerce.number().int().positive(),
    status: z.enum(["open", "reviewed", "dismissed"]),
  })
  .strict();

/** Pastebin ZK: solo ciphertext + iv (nunca plaintext ni key) */
export const pasteCreateSchema = z
  .object({
    ciphertext: z.string().min(8).max(512_000),
    iv: z.string().min(8).max(128),
    /** horas hasta expirar; 0 = 7 días default server */
    expires_in_hours: z.coerce.number().int().min(0).max(24 * 30).optional(),
    burn_after_read: z.boolean().optional(),
  })
  .strict();

export function parseJsonBody<T>(
  schema: z.ZodType<T>,
  raw: unknown
): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(raw);
  if (!r.success) {
    const msg = r.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    return { ok: false, error: msg || "payload inválido" };
  }
  return { ok: true, data: r.data };
}

/** Lee JSON del request y valida con schema. */
export async function readJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const raw = await req.json().catch(() => null);
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "JSON object requerido" };
  }
  // Rechazar claves desconocidas ya lo hace .strict();
  // Rechazar prototype pollution keys
  if (
    Object.prototype.hasOwnProperty.call(raw, "__proto__") ||
    Object.prototype.hasOwnProperty.call(raw, "constructor")
  ) {
    return { ok: false, error: "payload inválido" };
  }
  return parseJsonBody(schema, raw);
}
