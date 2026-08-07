import { ensureNotifySchema } from "./schema";
import { NotificationStore } from "./store";
import type {
  CreateNotificationInput,
  ListNotificationsOpts,
  NotificationRecord,
  NotifyServiceConfig,
} from "./types";

/**
 * API de alto nivel del kit.
 *
 * ```ts
 * const notify = createNotifyService({ db, appId: "mi-web" });
 * await notify.ensureSchema();
 * await notify.notify({ userId: 1, type: "reply", title: "Nueva respuesta", href: "/t/1" });
 * ```
 */
export class NotifyService {
  readonly appId: string;
  private store: NotificationStore;
  private schemaReady = false;

  constructor(private config: NotifyServiceConfig) {
    this.appId = config.appId || "default";
    this.store = new NotificationStore(config.db, this.appId);
  }

  async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await ensureNotifySchema(this.config.db);
    this.schemaReady = true;
  }

  async notify(input: CreateNotificationInput): Promise<NotificationRecord> {
    await this.ensureSchema();
    return this.store.create(input);
  }

  async notifyMany(
    userIds: number[],
    shared: Omit<CreateNotificationInput, "userId">
  ): Promise<number> {
    await this.ensureSchema();
    return this.store.createMany(userIds, shared);
  }

  async list(opts: ListNotificationsOpts): Promise<NotificationRecord[]> {
    await this.ensureSchema();
    return this.store.list(opts);
  }

  async unreadCount(userId: number): Promise<number> {
    await this.ensureSchema();
    return this.store.countUnread(userId);
  }

  async markRead(userId: number, ids: number[]): Promise<number> {
    await this.ensureSchema();
    return this.store.markRead(userId, ids);
  }

  async markAllRead(userId: number): Promise<number> {
    await this.ensureSchema();
    return this.store.markAllRead(userId);
  }

  async purgeOld(days = 90): Promise<number> {
    await this.ensureSchema();
    return this.store.deleteOld(days);
  }

  /** Snapshot para el badge del header */
  async inbox(userId: number, limit = 20) {
    await this.ensureSchema();
    const [items, unread] = await Promise.all([
      this.store.list({ userId, limit }),
      this.store.countUnread(userId),
    ]);
    return { items, unread };
  }
}

export function createNotifyService(config: NotifyServiceConfig): NotifyService {
  return new NotifyService(config);
}
