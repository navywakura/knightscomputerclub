/** Notificación portable — misma forma en cualquier web */

export type NotificationPayload = Record<string, unknown>;

export type NotificationRecord = {
  id: number;
  app_id: string;
  user_id: number;
  type: string;
  title: string;
  body: string;
  href: string | null;
  actor_id: number | null;
  actor_label: string | null;
  payload: NotificationPayload;
  read_at: string | null;
  created_at: string;
};

export type CreateNotificationInput = {
  userId: number;
  type: string;
  title: string;
  body?: string;
  href?: string | null;
  actorId?: number | null;
  actorLabel?: string | null;
  payload?: NotificationPayload;
};

export type ListNotificationsOpts = {
  userId: number;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
};

/**
 * Adapter de DB — implementalo con Neon, pg, Drizzle, etc.
 * Usa placeholders $1, $2… (Postgres).
 */
export type NotifyDb = {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ) => Promise<T[]>;
};

export type NotifyServiceConfig = {
  db: NotifyDb;
  /** Identificador de la web/app (multi-tenant). Default: "default" */
  appId?: string;
};
