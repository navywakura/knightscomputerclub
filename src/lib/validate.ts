/**
 * Validación estricta de entrada (anti-tampering Burp / fuzzing).
 * Solo campos permitidos; tipos estrictos.
 */
import { z } from "zod";

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
    captcha_token: z.string().max(500).optional(),
    captcha_answer: z.union([z.string(), z.number()]).optional(),
  })
  .strict();

export const forumPostSchema = z
  .object({
    thread_id: z.coerce.number().int().positive().optional(),
    thread: z.coerce.number().int().positive().optional(),
    body: z.string().min(1).max(20000).optional(),
    content: z.string().min(1).max(20000).optional(),
    captcha_token: z.string().max(500).optional(),
    captcha_answer: z.union([z.string(), z.number()]).optional(),
    sign_pgp: z.union([z.boolean(), z.string()]).optional(),
    pgp_signature: z.string().max(16000).optional(),
  })
  .strict();

export const forumThreadSchema = z
  .object({
    category: z.string().min(1).max(64).optional(),
    category_slug: z.string().min(1).max(64).optional(),
    title: z.string().min(3).max(200),
    body: z.string().min(3).max(20000).optional(),
    content: z.string().min(3).max(20000).optional(),
    captcha_token: z.string().max(500).optional(),
    captcha_answer: z.union([z.string(), z.number()]).optional(),
  })
  .strict();

export const nexoMessageSchema = z
  .object({
    board_id: z.coerce.number().int().positive().optional(),
    board: z.coerce.number().int().positive().optional(),
    body: z.string().min(1).max(4000).optional(),
    content: z.string().min(1).max(4000).optional(),
    reply_to_id: z.coerce.number().int().positive().nullable().optional(),
    id: z.coerce.number().int().positive().optional(),
    message_id: z.coerce.number().int().positive().optional(),
    action: z.enum(["edit", "delete", "pin", "unpin"]).optional(),
  })
  .strict();

export const reportSchema = z
  .object({
    target_type: z.enum([
      "forum_post",
      "forum_thread",
      "nexo_message",
      "nexo_dm",
      "user",
    ]),
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
