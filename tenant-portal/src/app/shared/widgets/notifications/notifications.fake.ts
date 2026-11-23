// In-memory stand-in for core-app `tenant/notifications` (TenantNotificationsController + NotificationsService).
// Errors carry `{ code, message }` only, as the backend sends them: no `details`.
import { ApiError } from '../../../core/api/api-errors';
import { fakeDelay } from '../../../core/fake/fake-utils';
import {
  NOTIFICATION_LIMITS,
  NotificationListResult,
  NotificationQuery,
  NotificationReadAllResult,
  NotificationUnreadCount,
  NotificationView,
} from './notifications.model';

type Lang = 'ar' | 'en';

interface Seed {
  id: string;
  notificationType: string;
  priority: 'P1_HIGH' | 'P2_NORMAL';
  title: Record<Lang, string>;
  body: Record<Lang, string>;
  actionUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  minutesAgo: number;
  read: boolean;
}

const SEEDS: readonly Seed[] = [
  {
    id: '019a7c10-0001-7000-8000-000000000001',
    notificationType: 'core.activity.reminder',
    priority: 'P1_HIGH',
    title: { en: 'Follow-up call due in 15 minutes', ar: 'موعد مكالمة المتابعة بعد 15 دقيقة' },
    body: {
      en: 'Call with Horizon Retail at 15:00.',
      ar: 'مكالمة مع شركة أفق للتجزئة الساعة 15:00.',
    },
    actionUrl: '/workspace/operations/activities',
    entityType: 'Activity',
    entityId: '019a7c20-0001-7000-8000-000000000001',
    minutesAgo: 5,
    read: false,
  },
  {
    id: '019a7c10-0002-7000-8000-000000000002',
    notificationType: 'crm.lead.assigned',
    priority: 'P2_NORMAL',
    title: { en: 'New lead assigned to you', ar: 'أُسند إليك عميل محتمل جديد' },
    body: {
      en: 'Khaled Mansour from Delta Logistics.',
      ar: 'خالد منصور من شركة دلتا للخدمات اللوجستية.',
    },
    actionUrl: '/crm/leads',
    entityType: 'Lead',
    entityId: '019a7c20-0002-7000-8000-000000000002',
    minutesAgo: 25,
    read: false,
  },
  {
    id: '019a7c10-0003-7000-8000-000000000003',
    notificationType: 'core.activity.assigned',
    priority: 'P2_NORMAL',
    title: { en: 'Activity assigned to you', ar: 'أُسند إليك نشاط' },
    body: {
      en: 'Prepare the quotation for Al Noor Trading.',
      ar: 'إعداد عرض السعر لشركة النور للتجارة.',
    },
    actionUrl: '/workspace/operations/activities',
    entityType: 'Activity',
    entityId: '019a7c20-0003-7000-8000-000000000003',
    minutesAgo: 120,
    read: false,
  },
  {
    id: '019a7c10-0004-7000-8000-000000000004',
    notificationType: 'record.owner_changed',
    priority: 'P2_NORMAL',
    title: { en: 'You are now the owner of a record', ar: 'أصبحت مالك سجل' },
    body: {
      en: 'Opportunity Enterprise Renewal was transferred to you.',
      ar: 'نُقلت إليك ملكية فرصة تجديد اشتراك المؤسسات.',
    },
    actionUrl: null,
    entityType: 'Opportunity',
    entityId: '019a7c20-0004-7000-8000-000000000004',
    minutesAgo: 60 * 26,
    read: false,
  },
  {
    id: '019a7c10-0005-7000-8000-000000000005',
    notificationType: 'core.activity.completed',
    priority: 'P2_NORMAL',
    title: { en: 'Activity completed', ar: 'اكتمل نشاط' },
    body: {
      en: 'Sara Ahmed completed the demo meeting with Atlas Industrial.',
      ar: 'أكملت سارة أحمد اجتماع العرض مع شركة أطلس الصناعية.',
    },
    actionUrl: '/workspace/operations/activities',
    entityType: 'Activity',
    entityId: '019a7c20-0005-7000-8000-000000000005',
    minutesAgo: 60 * 29,
    read: true,
  },
  {
    id: '019a7c10-0006-7000-8000-000000000006',
    notificationType: 'core.activity.updated',
    priority: 'P2_NORMAL',
    title: { en: 'Activity updated', ar: 'عُدِّل نشاط' },
    body: {
      en: 'The site visit to Nile Foods moved to Thursday.',
      ar: 'نُقل موعد الزيارة الميدانية لشركة النيل للأغذية إلى يوم الخميس.',
    },
    actionUrl: '/workspace/operations/activities',
    entityType: 'Activity',
    entityId: '019a7c20-0006-7000-8000-000000000006',
    minutesAgo: 60 * 75,
    read: true,
  },
  {
    id: '019a7c10-0007-7000-8000-000000000007',
    notificationType: 'core.activity.cancelled',
    priority: 'P2_NORMAL',
    title: { en: 'Activity cancelled', ar: 'أُلغي نشاط' },
    body: {
      en: 'The call with Oasis Tech was cancelled.',
      ar: 'أُلغيت المكالمة مع شركة واحة التقنية.',
    },
    actionUrl: null,
    entityType: 'Activity',
    entityId: '019a7c20-0007-7000-8000-000000000007',
    minutesAgo: 60 * 100,
    read: true,
  },
  {
    id: '019a7c10-0008-7000-8000-000000000008',
    notificationType: 'record.deleted',
    priority: 'P2_NORMAL',
    title: { en: 'A record you own was deleted', ar: 'حُذف سجل تملكه' },
    body: {
      en: 'Lead Red Sea Shipping was deleted by Omar Hassan.',
      ar: 'حذف عمر حسن العميل المحتمل شركة البحر الأحمر للشحن.',
    },
    actionUrl: null,
    entityType: 'Lead',
    entityId: '019a7c20-0008-7000-8000-000000000008',
    minutesAgo: 60 * 140,
    read: true,
  },
];

interface StoredRow {
  seed: Seed;
  createdAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  dismissedAt: string | null;
  version: number;
}

let rows: StoredRow[] = createRows();
let userInactive = false;
let forcedError: ApiError | null = null;

/** Test helper: simulate a missing or inactive recipient (list, unread count and every state change then 404). */
export function setFakeNotificationUserInactive(inactive: boolean): void {
  userInactive = inactive;
}

/** Test helper: force notification reads/writes to fail with a specific ApiError (e.g. 500). */
export function setFakeNotificationError(error: ApiError | null): void {
  forcedError = error;
}

function assertUserActive(): void {
  if (userInactive) throw new ApiError(404, 'NOTIFICATION_USER_NOT_FOUND');
}

function assertAvailable(): void {
  if (forcedError) throw forcedError;
  assertUserActive();
}

let unreadRevision = 1;
let unreadChangedAt = new Date().toISOString();

function createRows(now = Date.now()): StoredRow[] {
  return SEEDS.map((seed) => {
    const createdAt = new Date(now - seed.minutesAgo * 60_000).toISOString();
    return {
      seed,
      createdAt,
      readAt: seed.read ? createdAt : null,
      acknowledgedAt: null,
      dismissedAt: null,
      version: 1,
    };
  }).sort(compareNewestFirst);
}

function compareNewestFirst(a: StoredRow, b: StoredRow): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.seed.id < b.seed.id ? 1 : -1;
}

/** Keys the fake received, in call order ("read:<id>" -> key). The fake does not enforce them. */
let receivedKeys: { action: string; key: string | undefined }[] = [];

/** Test helper: the x-idempotency-keys the write fakes received, in call order. */
export function fakeNotificationKeys(): readonly { action: string; key: string | undefined }[] {
  return receivedKeys;
}

/** Test helper: restore the seeded inbox. */
export function resetFakeNotifications(): void {
  receivedKeys = [];
  rows = createRows();
  userInactive = false;
  forcedError = null;
  unreadRevision = 1;
  unreadChangedAt = new Date().toISOString();
}

function toView(row: StoredRow, lang: Lang): NotificationView {
  const { seed } = row;
  return {
    id: seed.id,
    recipientId: seed.id.replace(/^019a7c10/, '019a7c30'),
    sourceApp: seed.notificationType.startsWith('crm.') ? 'CRM' : 'CORE',
    notificationType: seed.notificationType,
    priority: seed.priority,
    title: seed.title[lang],
    body: seed.body[lang],
    actionUrl: seed.actionUrl,
    entityType: seed.entityType,
    entityId: seed.entityId,
    channels: ['IN_APP'],
    metadata: {},
    createdAt: row.createdAt,
    readAt: row.readAt,
    acknowledgedAt: row.acknowledgedAt,
    deliveredAt: row.createdAt,
    recipientStateVersion: row.version,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function active(): StoredRow[] {
  return rows.filter((row) => row.dismissedAt === null);
}

function unreadNow(): number {
  return active().filter((row) => row.readAt === null).length;
}

function bumpUnread(): void {
  unreadRevision += 1;
  unreadChangedAt = new Date().toISOString();
}

function encodeCursor(createdAt: string, id: string): string {
  return btoa(JSON.stringify({ createdAt, id }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeCursor(raw: string): { createdAt: string; id: string } {
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((raw.length + 3) % 4);
    const value = JSON.parse(atob(padded)) as { createdAt?: unknown; id?: unknown };
    if (
      typeof value.createdAt === 'string' &&
      !Number.isNaN(Date.parse(value.createdAt)) &&
      typeof value.id === 'string' &&
      UUID.test(value.id)
    ) {
      return { createdAt: value.createdAt, id: value.id };
    }
  } catch {
    // Falls through to the backend error below.
  }
  throw new ApiError(400, 'NOTIFICATION_CURSOR_INVALID');
}

/** `IdParamDto` rejects a non-UUID with the global validation error before the service runs. */
function assertUuid(id: string): void {
  if (!UUID.test(id)) throw new ApiError(400, 'CORE_VALIDATION_FAILED');
}

/** Missing, dismissed and other recipients' notifications all return the same 404. */
function findActive(id: string): StoredRow {
  assertUuid(id);
  const row = active().find((item) => item.seed.id === id);
  if (!row) throw new ApiError(404, 'NOTIFICATION_NOT_FOUND');
  return row;
}

function findOwned(id: string): StoredRow {
  assertUuid(id);
  const row = rows.find((item) => item.seed.id === id);
  if (!row) throw new ApiError(404, 'NOTIFICATION_NOT_FOUND');
  return row;
}

/** `GET tenant/notifications?limit&cursor&unreadOnly` */
export async function fakeListNotifications(
  query: NotificationQuery = {},
): Promise<NotificationListResult> {
  await fakeDelay(200);
  const limit = query.limit ?? NOTIFICATION_LIMITS.defaultLimit;
  if (
    !Number.isInteger(limit) ||
    limit < NOTIFICATION_LIMITS.minLimit ||
    limit > NOTIFICATION_LIMITS.maxLimit
  ) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }
  if (query.cursor !== undefined && query.cursor.length > NOTIFICATION_LIMITS.cursor) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED');
  }
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  assertAvailable();
  const lang: Lang = 'en';
  const matching = active().filter((row) => {
    if (query.unreadOnly && row.readAt !== null) return false;
    if (cursor) {
      if (row.createdAt > cursor.createdAt) return false;
      if (row.createdAt === cursor.createdAt && row.seed.id >= cursor.id) return false;
    }
    return true;
  });
  const page = matching.slice(0, limit);
  const hasNext = matching.length > limit;
  const last = page.at(-1);
  return {
    items: page.map((row) => toView(row, lang)),
    unreadCount: unreadNow(),
    unreadRevision,
    unreadChangedAt,
    nextCursor: hasNext && last ? encodeCursor(last.createdAt, last.seed.id) : null,
    hasNext,
  };
}

/** `GET tenant/notifications/unread-count` */
export async function fakeGetUnreadCount(): Promise<NotificationUnreadCount> {
  await fakeDelay(80);
  assertAvailable();
  return { unreadCount: unreadNow() };
}

/** `GET tenant/notifications/:id` */
export async function fakeGetNotification(id: string): Promise<NotificationView> {
  await fakeDelay(120);
  const row = findActive(id);
  assertAvailable();
  return toView(row, 'en');
}

/** `POST tenant/notifications/read-all` → `{ updated }` */
export async function fakeMarkAllNotificationsRead(
  idempotencyKey?: string,
): Promise<NotificationReadAllResult> {
  receivedKeys.push({ action: 'read-all', key: idempotencyKey });
  await fakeDelay(160);
  assertAvailable();
  const now = new Date().toISOString();
  let updated = 0;
  for (const row of active()) {
    if (row.readAt === null) {
      row.readAt = now;
      row.version += 1;
      updated += 1;
    }
  }
  if (updated > 0) bumpUnread();
  return { updated };
}

/** `POST tenant/notifications/:id/read` → 204 */
export async function fakeMarkNotificationRead(id: string, idempotencyKey?: string): Promise<void> {
  receivedKeys.push({ action: `read:${id}`, key: idempotencyKey });
  await fakeDelay(100);
  const row = findOwned(id);
  assertAvailable();
  if (row.dismissedAt !== null) return;
  if (row.readAt === null) {
    row.readAt = new Date().toISOString();
    row.version += 1;
    bumpUnread();
  }
}

/** `POST tenant/notifications/:id/acknowledge` → 204 (also records the item as read) */
export async function fakeAcknowledgeNotification(
  id: string,
  idempotencyKey?: string,
): Promise<void> {
  receivedKeys.push({ action: `acknowledge:${id}`, key: idempotencyKey });
  await fakeDelay(100);
  const row = findOwned(id);
  assertAvailable();
  if (row.dismissedAt !== null) return;
  const now = new Date().toISOString();
  let changed = false;
  if (row.acknowledgedAt === null) {
    row.acknowledgedAt = now;
    changed = true;
  }
  if (row.readAt === null) {
    row.readAt = now;
    changed = true;
    bumpUnread();
  }
  if (changed) row.version += 1;
}

/** `DELETE tenant/notifications/:id` → 204 (dismisses for this recipient only) */
export async function fakeDismissNotification(id: string, idempotencyKey?: string): Promise<void> {
  receivedKeys.push({ action: `dismiss:${id}`, key: idempotencyKey });
  await fakeDelay(100);
  const row = findOwned(id);
  assertAvailable();
  if (row.dismissedAt !== null) return;
  row.dismissedAt = new Date().toISOString();
  row.version += 1;
  if (row.readAt === null) bumpUnread();
}
