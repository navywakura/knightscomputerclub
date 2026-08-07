import type {
  CreateNotificationInput,
  ListNotificationsOpts,
  NotificationRecord,
  NotifyDb,
} from "./types";

function mapRow(r: Record<string, unknown>): NotificationRecord {
  let payload: Record<string, unknown> = {};
  const raw = r.payload;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    payload = raw as Record<string, unknown>;
  } else if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  return {
    id: Number(r.id),
    app_id: String(r.app_id),
    user_id: Number(r.user_id),
    type: String(r.type),
    title: String(r.title),
    body: String(r.body || ""),
    href: r.href != null ? String(r.href) : null,
    actor_id: r.actor_id != null ? Number(r.actor_id) : null,
    actor_label: r.actor_label != null ? String(r.actor_label) : null,
    payload,
    read_at: r.read_at != null ? String(r.read_at) : null,
    created_at: String(r.created_at),
  };
}

export class NotificationStore {
  constructor(
    private db: NotifyDb,
    private appId: string
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const rows = await this.db.query(
      `INSERT INTO web_notifications
        (app_id, user_id, type, title, body, href, actor_id, actor_label, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING *`,
      [
        this.appId,
        input.userId,
        input.type.slice(0, 64),
        input.title.slice(0, 280),
        input.body || "",
        input.href ?? null,
        input.actorId ?? null,
        input.actorLabel ? String(input.actorLabel).slice(0, 128) : null,
        JSON.stringify(input.payload || {}),
      ]
    );
    return mapRow(rows[0] as Record<string, unknown>);
  }

  /** Crea N notificaciones (mismo contenido, distintos userId). */
  async createMany(
    userIds: number[],
    shared: Omit<CreateNotificationInput, "userId">
  ): Promise<number> {
    const unique = [...new Set(userIds.filter((id) => Number.isFinite(id)))];
    let n = 0;
    for (const userId of unique) {
      await this.create({ ...shared, userId });
      n += 1;
    }
    return n;
  }

  async list(opts: ListNotificationsOpts): Promise<NotificationRecord[]> {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);
    const rows = opts.unreadOnly
      ? await this.db.query(
          `SELECT * FROM web_notifications
           WHERE app_id = $1 AND user_id = $2 AND read_at IS NULL
           ORDER BY created_at DESC
           LIMIT $3 OFFSET $4`,
          [this.appId, opts.userId, limit, offset]
        )
      : await this.db.query(
          `SELECT * FROM web_notifications
           WHERE app_id = $1 AND user_id = $2
           ORDER BY created_at DESC
           LIMIT $3 OFFSET $4`,
          [this.appId, opts.userId, limit, offset]
        );
    return rows.map((r) => mapRow(r as Record<string, unknown>));
  }

  async countUnread(userId: number): Promise<number> {
    const rows = await this.db.query<{ n: string | number }>(
      `SELECT COUNT(*)::int AS n FROM web_notifications
       WHERE app_id = $1 AND user_id = $2 AND read_at IS NULL`,
      [this.appId, userId]
    );
    return Number(rows[0]?.n || 0);
  }

  async markRead(userId: number, ids: number[]): Promise<number> {
    const safe = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    if (!safe.length) return 0;
    // placeholders $3..$n (portable; evita ANY(array) en algunos drivers HTTP)
    const ph = safe.map((_, i) => `$${i + 3}`).join(", ");
    const rows = await this.db.query<{ id: number }>(
      `UPDATE web_notifications
       SET read_at = NOW()
       WHERE app_id = $1 AND user_id = $2 AND id IN (${ph})
         AND read_at IS NULL
       RETURNING id`,
      [this.appId, userId, ...safe]
    );
    return rows.length;
  }

  async markAllRead(userId: number): Promise<number> {
    const rows = await this.db.query<{ id: number }>(
      `UPDATE web_notifications
       SET read_at = NOW()
       WHERE app_id = $1 AND user_id = $2 AND read_at IS NULL
       RETURNING id`,
      [this.appId, userId]
    );
    return rows.length;
  }

  async deleteOld(days = 90): Promise<number> {
    const rows = await this.db.query<{ id: number }>(
      `DELETE FROM web_notifications
       WHERE app_id = $1
         AND created_at < NOW() - ($2::text || ' days')::interval
       RETURNING id`,
      [this.appId, String(days)]
    );
    return rows.length;
  }
}
