import {
  createNeonNotifyDb,
  createNotifyService,
  type NotifyService,
} from "@web-notify";
import { getDb } from "@/lib/db";

const APP_ID = process.env.NOTIFY_APP_ID || "knightscomputer";

let service: NotifyService | null = null;

/** Instancia del kit @knights/web-notify para este sitio */
export function getNotify(): NotifyService {
  if (!service) {
    const sql = getDb();
    service = createNotifyService({
      db: createNeonNotifyDb(sql),
      appId: APP_ID,
    });
  }
  return service;
}

/** Emite sin tumbar el request si falla (best-effort) */
export async function safeNotify(
  ...args: Parameters<NotifyService["notify"]>
): Promise<void> {
  try {
    await getNotify().notify(...args);
  } catch (e) {
    console.error("[notify]", e);
  }
}

export async function safeNotifyMany(
  userIds: number[],
  shared: Parameters<NotifyService["notifyMany"]>[1]
): Promise<void> {
  try {
    const filtered = userIds.filter((id) => Number.isFinite(id));
    if (!filtered.length) return;
    await getNotify().notifyMany(filtered, shared);
  } catch (e) {
    console.error("[notifyMany]", e);
  }
}
