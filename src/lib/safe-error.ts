/**
 * Errores seguros en producción: no filtrar stack ni detalle SQL.
 */

export function publicError(
  e: unknown,
  fallback = "error interno del nodo"
): string {
  if (process.env.NODE_ENV !== "production") {
    if (e instanceof Error) return e.message;
    return String(e);
  }
  return fallback;
}

export function logServerError(tag: string, e: unknown): void {
  console.error(tag, e);
}
