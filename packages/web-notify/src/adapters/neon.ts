import type { NotifyDb } from "../types";

/**
 * Convierte SQL con $1,$2… a llamada tagged-template de Neon.
 * (Las builds HTTP de neon no siempre exponen sql.query)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runAsTagged(sql: any, text: string, params: unknown[]): Promise<unknown> {
  const re = /\$(\d+)/g;
  const strings: string[] = [];
  const values: unknown[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    strings.push(text.slice(cursor, m.index));
    const idx = Number(m[1]) - 1;
    values.push(params[idx]);
    cursor = m.index + m[0].length;
  }
  strings.push(text.slice(cursor));

  const tpl = strings as unknown as TemplateStringsArray;
  Object.defineProperty(tpl, "raw", { value: strings });
  return sql(tpl, ...values);
}

function normalizeResult(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (
    result &&
    typeof result === "object" &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

/**
 * Adapter para `@neondatabase/serverless` (tagged template o .query).
 *
 * ```ts
 * import { neon } from "@neondatabase/serverless";
 * import { createNeonNotifyDb } from "@web-notify";
 * const db = createNeonNotifyDb(neon(process.env.DATABASE_URL!));
 * ```
 */
export function createNeonNotifyDb(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any
): NotifyDb {
  return {
    async query<T = Record<string, unknown>>(
      text: string,
      params: unknown[] = []
    ): Promise<T[]> {
      if (typeof sql.query === "function") {
        try {
          const result = await sql.query(text, params);
          return normalizeResult(result) as T[];
        } catch {
          /* fallback tagged */
        }
      }

      const result = await runAsTagged(sql, text, params);
      return normalizeResult(result) as T[];
    },
  };
}
