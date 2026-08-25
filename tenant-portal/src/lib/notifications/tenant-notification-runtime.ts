import { z } from "zod";
import { customTenantFetch, unwrapCoreData } from "@/lib/api/axiosClient";

const MAX_CACHED_NOTIFICATIONS = 500;
const MAX_NOTIFICATION_IDENTITIES = 1_000;
const MAX_RESYNC_PAGES = 10;
const PAGE_SIZE = 50;
const MAX_RESYNC_RETRIES = 3;
const MAX_NOTIFICATION_RESPONSE_BYTES = 1_048_576;

const nullableIsoDateSchema = z.iso.datetime({ offset: true }).nullable();
const metadataValueSchema = z.union([
  z.string().max(512),
  z.number().int().safe(),
  z.boolean(),
  z.null(),
]);
const metadataSchema = z
  .record(z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/), metadataValueSchema)
  .refine((value) => Object.keys(value).length <= 16, {
    message: "Notification metadata exceeds its entry bound.",
  });
const notificationViewSchema = z.strictObject({
  id: z.uuid(),
  recipientId: z.uuid(),
  sourceApp: z.string().min(1).max(128),
  notificationType: z.string().min(1).max(128),
  priority: z.string().min(1).max(64),
  title: z.string().min(1).max(720),
  body: z.string().min(1).max(16_384),
  actionUrl: z
    .string()
    .max(1_024)
    .refine(isSafeNotificationRoute, "Notification action is not same-origin safe.")
    .nullable(),
  entityType: z.string().max(128).nullable(),
  entityId: z.uuid().nullable(),
  channels: z.array(z.string().min(1).max(64)).max(16),
  metadata: metadataSchema,
  createdAt: z.iso.datetime({ offset: true }),
  readAt: nullableIsoDateSchema,
  acknowledgedAt: nullableIsoDateSchema,
  deliveredAt: nullableIsoDateSchema,
  recipientStateVersion: z.number().int().safe().min(0),
});

const notificationListSchema = z
  .strictObject({
    items: z.array(notificationViewSchema).max(PAGE_SIZE),
    unreadCount: z.number().int().min(0),
    unreadRevision: z.number().int().safe().min(0),
    unreadChangedAt: z.iso.datetime({ offset: true }),
    nextCursor: z.string().min(1).max(2_048).nullable(),
    hasNext: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.hasNext !== (value.nextCursor !== null)) {
      context.addIssue({
        code: "custom",
        path: ["nextCursor"],
        message: "Notification pagination cursor and hasNext disagree.",
      });
    }
  });

export type TenantNotification = z.infer<typeof notificationViewSchema>;

export interface TenantNotificationSnapshot {
  readonly generation: string | null;
  readonly items: readonly TenantNotification[];
  readonly unreadCount: number;
  readonly lastRealtimeCursor: string | null;
  readonly revision: number;
}

export interface RealtimeNotificationCreated {
  readonly notificationId: string;
  readonly recipientId: string;
  readonly deliveryEventId: string;
  readonly cursor: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly priority: string;
  readonly entity: { readonly type: string; readonly id: string } | null;
  readonly action: { readonly route: string } | null;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly silent: boolean;
  readonly metadata: Readonly<
    Record<string, string | number | boolean | null>
  >;
}

export interface RealtimeNotificationUpdated {
  readonly notificationId: string;
  readonly recipientId: string;
  readonly change: "READ" | "ACKNOWLEDGED" | "DISMISSED";
  readonly state: {
    readonly readAt: string | null;
    readonly acknowledgedAt: string | null;
    readonly dismissedAt: string | null;
  };
  readonly changedAt: string;
  readonly recipientStateVersion: number;
}

export type NotificationOrderingResult =
  | "applied"
  | "duplicate"
  | "stale"
  | "gap"
  | "conflict"
  | "missing";

type Listener = () => void;
type ResyncOverlayMutation =
  | {
      readonly kind: "UPSERT";
      readonly item: TenantNotification;
      readonly requiresRestPresence: boolean;
    }
  | {
      readonly kind: "DELETE";
      readonly recipientStateVersion: number;
    };

const EMPTY_SNAPSHOT: TenantNotificationSnapshot = Object.freeze({
  generation: null,
  items: Object.freeze([]),
  unreadCount: 0,
  lastRealtimeCursor: null,
  revision: 0,
});

export class TenantNotificationRuntimeStore {
  private snapshot: TenantNotificationSnapshot = EMPTY_SNAPSHOT;
  private readonly listeners = new Set<Listener>();
  private readonly deliveryEvents = new Map<string, string>();
  private readonly notificationFingerprints = new Map<
    string,
    {
      readonly comparableFingerprint: string;
      readonly liveFingerprint?: string;
    }
  >();
  private readonly recipientStateVersions = new Map<
    string,
    {
      readonly version: number;
      readonly stateFingerprint: string;
      readonly eventFingerprint?: string;
    }
  >();
  private unreadState: {
    readonly revision: number;
    readonly fingerprint: string;
  } | null = null;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): TenantNotificationSnapshot => this.snapshot;

  readonly getUnreadOrderingRevision = (): number | null =>
    this.unreadState?.revision ?? null;

  readonly getRecipientStateVersion = (notificationId: string): number | null =>
    this.recipientStateVersions.get(notificationId)?.version ?? null;

  bindGeneration(generation: string | null): void {
    if (this.snapshot.generation === generation) return;
    this.deliveryEvents.clear();
    this.notificationFingerprints.clear();
    this.recipientStateVersions.clear();
    this.unreadState = null;
    this.commit({
      generation,
      items: Object.freeze([]),
      unreadCount: 0,
      lastRealtimeCursor: null,
    });
  }

  clear(): void {
    this.deliveryEvents.clear();
    this.notificationFingerprints.clear();
    this.recipientStateVersions.clear();
    this.unreadState = null;
    this.commit({
      generation: null,
      items: Object.freeze([]),
      unreadCount: 0,
      lastRealtimeCursor: null,
    });
  }

  applyCreated(
    generation: string,
    payload: RealtimeNotificationCreated,
  ): "applied" | "duplicate" | "stale" | "conflict" {
    if (this.snapshot.generation !== generation) return "stale";
    const deliveryIdentity = deliveryFingerprint(payload);
    const notificationIdentity = notificationFingerprint(payload);
    const comparableIdentity = notificationComparableFingerprint(payload);
    const priorFingerprint = this.deliveryEvents.get(payload.deliveryEventId);
    if (priorFingerprint !== undefined) {
      return priorFingerprint === deliveryIdentity
        ? "duplicate"
        : "conflict";
    }

    const existing = this.snapshot.items.find(
      (item) => item.id === payload.notificationId,
    );
    const priorNotificationFingerprint =
      this.notificationFingerprints.get(payload.notificationId) ??
      (existing
        ? {
            comparableFingerprint:
              notificationComparableFingerprintFromItem(existing),
          }
        : undefined);
    if (priorNotificationFingerprint !== undefined) {
      if (
        priorNotificationFingerprint.comparableFingerprint !== comparableIdentity ||
        (priorNotificationFingerprint.liveFingerprint !== undefined &&
          priorNotificationFingerprint.liveFingerprint !== notificationIdentity)
      ) {
        return "conflict";
      }
      this.rememberDelivery(payload.deliveryEventId, deliveryIdentity);
      return "duplicate";
    }

    const item: TenantNotification = Object.freeze({
      id: payload.notificationId,
      recipientId: payload.recipientId,
      sourceApp: "realtime",
      notificationType: payload.type,
      priority: payload.priority,
      title: payload.title,
      body: payload.body,
      actionUrl: payload.action?.route ?? null,
      entityType: payload.entity?.type ?? null,
      entityId: payload.entity?.id ?? null,
      channels: ["IN_APP"],
      metadata: Object.freeze({ ...payload.metadata }),
      createdAt: payload.createdAt,
      readAt: existing?.readAt ?? null,
      acknowledgedAt: existing?.acknowledgedAt ?? null,
      // Adapter acceptance is delivery-attempt evidence, not an authenticated
      // recipient receipt. REST remains authoritative for deliveredAt.
      deliveredAt: existing?.deliveredAt ?? null,
      recipientStateVersion: existing?.recipientStateVersion ?? 0,
    });
    const items = existing
      ? Object.freeze(
          this.snapshot.items.map((candidate) =>
            candidate.id === payload.notificationId ? item : candidate,
          ),
        )
      : Object.freeze(
          [item, ...this.snapshot.items].slice(0, MAX_CACHED_NOTIFICATIONS),
        );

    this.rememberDelivery(payload.deliveryEventId, deliveryIdentity);
    rememberBounded(
      this.notificationFingerprints,
      payload.notificationId,
      {
        comparableFingerprint: comparableIdentity,
        liveFingerprint: notificationIdentity,
      },
    );
    this.commit({
      generation,
      items,
      // Creation and recipient-state facts arrive on independent durable
      // queues. Only the revisioned unread counter or REST snapshot may set
      // this aggregate; incrementing here can double-count reordered facts.
      unreadCount: this.snapshot.unreadCount,
      lastRealtimeCursor: payload.cursor,
    });
    return "applied";
  }

  applyUpdated(
    generation: string,
    payload: RealtimeNotificationUpdated,
  ): NotificationOrderingResult {
    if (this.snapshot.generation !== generation) return "stale";
    const eventFingerprint = recipientStateFingerprint(payload);
    const stateFingerprint = recipientStateProjectionFingerprint(payload.state);
    const rememberedState = this.recipientStateVersions.get(
      payload.notificationId,
    );
    const index = this.snapshot.items.findIndex(
      (item) => item.id === payload.notificationId,
    );
    if (index < 0) {
      if (!rememberedState) return "missing";
      if (payload.recipientStateVersion < rememberedState.version) return "stale";
      if (payload.recipientStateVersion === rememberedState.version) {
        return rememberedState.eventFingerprint === eventFingerprint
          ? "duplicate"
          : "conflict";
      }
      return payload.recipientStateVersion > rememberedState.version + 1
        ? "gap"
        : "missing";
    }
    const existing = this.snapshot.items[index];
    if (existing.recipientId !== payload.recipientId) return "conflict";
    const prior = rememberedState ?? {
      version: existing.recipientStateVersion,
      stateFingerprint: notificationStateFingerprint(existing),
    };
    if (prior) {
      if (payload.recipientStateVersion < prior.version) return "stale";
      if (payload.recipientStateVersion === prior.version) {
        return (prior.eventFingerprint !== undefined
          ? eventFingerprint === prior.eventFingerprint
          : stateFingerprint === prior.stateFingerprint)
          ? "duplicate"
          : "conflict";
      }
      if (payload.recipientStateVersion !== prior.version + 1) return "gap";
    }
    rememberBounded(this.recipientStateVersions, payload.notificationId, {
        version: payload.recipientStateVersion,
        stateFingerprint,
        eventFingerprint,
      });
    if (payload.change === "DISMISSED") {
      this.commit({
        ...this.snapshot,
        items: Object.freeze(
          this.snapshot.items.filter((item) => item.id !== payload.notificationId),
        ),
        // Only revisioned unread-count facts or REST may set the aggregate.
        unreadCount: this.snapshot.unreadCount,
      });
      return "applied";
    }
    const updated: TenantNotification = Object.freeze({
      ...existing,
      readAt: payload.state.readAt,
      acknowledgedAt: payload.state.acknowledgedAt,
      recipientStateVersion: payload.recipientStateVersion,
    });
    const items = [...this.snapshot.items];
    items[index] = updated;
    this.commit({
      ...this.snapshot,
      items: Object.freeze(items),
      unreadCount: this.snapshot.unreadCount,
    });
    return "applied";
  }

  applyUnreadCount(
    generation: string,
    unreadCount: number,
    unreadRevision: number,
    changedAt: string,
  ): NotificationOrderingResult {
    if (this.snapshot.generation !== generation) return "stale";
    const fingerprint = JSON.stringify([unreadCount, unreadRevision, changedAt]);
    if (this.unreadState) {
      if (unreadRevision < this.unreadState.revision) return "stale";
      if (unreadRevision === this.unreadState.revision) {
        return fingerprint === this.unreadState.fingerprint
          ? "duplicate"
          : "conflict";
      }
      if (unreadRevision !== this.unreadState.revision + 1) return "gap";
    }
    this.unreadState = { revision: unreadRevision, fingerprint };
    this.commit({ ...this.snapshot, unreadCount });
    return "applied";
  }

  replaceAfterResync(
    generation: string,
    items: readonly TenantNotification[],
    unreadCount: number,
    unreadRevision: number,
    unreadChangedAt: string,
    lastRealtimeCursor: string | null,
    expectedRevision: number,
  ): boolean {
    if (
      this.snapshot.generation !== generation ||
      this.snapshot.revision !== expectedRevision
    ) {
      return false;
    }
    const priorUnreadState = this.unreadState;
    const restUnreadFingerprint = JSON.stringify([
      unreadCount,
      unreadRevision,
      unreadChangedAt,
    ]);
    if (
      priorUnreadState?.revision === unreadRevision &&
      priorUnreadState.fingerprint !== restUnreadFingerprint
    ) {
      throw new Error("Notification unread revision equivocated during resync.");
    }
    const preserveNewerUnread =
      priorUnreadState !== null && priorUnreadState.revision > unreadRevision;
    for (const item of items) {
      const priorNotification = this.notificationFingerprints.get(item.id);
      const comparableFingerprint =
        notificationComparableFingerprintFromItem(item);
      if (
        priorNotification &&
        priorNotification.comparableFingerprint !== comparableFingerprint
      ) {
        throw new Error("Notification immutable identity equivocated during resync.");
      }
      const prior = this.recipientStateVersions.get(item.id);
      const stateFingerprint = notificationStateFingerprint(item);
      if (prior && prior.version > item.recipientStateVersion) {
        throw new Error("Notification resync attempted to regress recipient state.");
      }
      if (
        prior?.version === item.recipientStateVersion &&
        prior.stateFingerprint !== stateFingerprint
      ) {
        throw new Error("Notification recipient state equivocated during resync.");
      }
    }
    for (const item of items) {
      const priorNotification = this.notificationFingerprints.get(item.id);
      rememberBounded(this.notificationFingerprints, item.id, {
        comparableFingerprint: notificationComparableFingerprintFromItem(item),
        ...(priorNotification?.liveFingerprint === undefined
          ? {}
          : { liveFingerprint: priorNotification.liveFingerprint }),
      });
      const prior = this.recipientStateVersions.get(item.id);
      if (!prior || prior.version <= item.recipientStateVersion) {
        rememberBounded(this.recipientStateVersions, item.id, {
          version: item.recipientStateVersion,
          stateFingerprint: notificationStateFingerprint(item),
        });
      }
    }
    if (!preserveNewerUnread) {
      this.unreadState = {
        revision: unreadRevision,
        fingerprint: restUnreadFingerprint,
      };
    }
    this.commit({
      generation,
      items: Object.freeze([...items]),
      unreadCount: preserveNewerUnread ? this.snapshot.unreadCount : unreadCount,
      lastRealtimeCursor,
    });
    return true;
  }

  private rememberDelivery(deliveryEventId: string, fingerprint: string) {
    this.deliveryEvents.set(deliveryEventId, fingerprint);
    if (this.deliveryEvents.size <= MAX_CACHED_NOTIFICATIONS) return;
    const oldest = this.deliveryEvents.keys().next().value as string | undefined;
    if (oldest !== undefined) this.deliveryEvents.delete(oldest);
  }

  private commit(
    next: Omit<TenantNotificationSnapshot, "revision"> & {
      readonly revision?: number;
    },
  ): void {
    this.snapshot = Object.freeze({
      generation: next.generation,
      items: next.items,
      unreadCount: next.unreadCount,
      lastRealtimeCursor: next.lastRealtimeCursor,
      revision: this.snapshot.revision + 1,
    });
    for (const listener of [...this.listeners]) listener();
  }
}

function deliveryFingerprint(payload: RealtimeNotificationCreated): string {
  return JSON.stringify([
    payload.notificationId,
    payload.recipientId,
    payload.cursor,
    notificationFingerprint(payload),
  ]);
}

function notificationFingerprint(payload: RealtimeNotificationCreated): string {
  return JSON.stringify([
    payload.notificationId,
    payload.recipientId,
    payload.type,
    payload.title,
    payload.body,
    payload.priority,
    payload.entity,
    payload.action,
    payload.createdAt,
    payload.expiresAt,
    payload.silent,
    Object.entries(payload.metadata).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  ]);
}

function notificationComparableFingerprint(
  payload: RealtimeNotificationCreated,
): string {
  return JSON.stringify([
    payload.notificationId,
    payload.recipientId,
    payload.type,
    payload.title,
    payload.body,
    payload.priority,
    payload.entity?.type ?? null,
    payload.entity?.id ?? null,
    payload.action?.route ?? null,
    payload.createdAt,
    Object.entries(payload.metadata).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  ]);
}

function notificationComparableFingerprintFromItem(
  item: TenantNotification,
): string {
  return JSON.stringify([
    item.id,
    item.recipientId,
    item.notificationType,
    item.title,
    item.body,
    item.priority,
    item.entityType,
    item.entityId,
    item.actionUrl,
    item.createdAt,
    Object.entries(item.metadata).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  ]);
}

function recipientStateFingerprint(
  payload: RealtimeNotificationUpdated,
): string {
  return JSON.stringify([
    payload.notificationId,
    payload.recipientId,
    payload.change,
    payload.state,
    payload.changedAt,
    payload.recipientStateVersion,
  ]);
}

function recipientStateProjectionFingerprint(state: {
  readonly readAt: string | null;
  readonly acknowledgedAt: string | null;
  readonly dismissedAt: string | null;
}): string {
  return JSON.stringify([
    state.readAt,
    state.acknowledgedAt,
    state.dismissedAt,
  ]);
}

function notificationStateFingerprint(item: TenantNotification): string {
  return recipientStateProjectionFingerprint({
    readAt: item.readAt,
    acknowledgedAt: item.acknowledgedAt,
    dismissedAt: null,
  });
}

function isSafeNotificationRoute(value: string): boolean {
  const path = value.split(/[?#]/u, 1)[0] ?? "";
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    value.normalize("NFC") === value &&
    !/[\u0000-\u001f\u007f\\]/u.test(value) &&
    !path.includes("//") &&
    !/%(?:00|2e|2f|5c)/iu.test(path) &&
    !path.split("/").some((part) => part === "." || part === "..")
  );
}

function rememberBounded<K, V>(map: Map<K, V>, key: K, value: V): void {
  map.delete(key);
  map.set(key, value);
  while (map.size > MAX_NOTIFICATION_IDENTITIES) {
    const oldest = map.keys().next().value as K | undefined;
    if (oldest === undefined) return;
    map.delete(oldest);
  }
}

export const tenantNotificationRuntime = new TenantNotificationRuntimeStore();

export async function resyncTenantNotifications(
  generation: string,
  lastRealtimeCursor: string | null,
  store = tenantNotificationRuntime,
): Promise<boolean> {
  const overlay = new Map<string, ResyncOverlayMutation>();
  let overlayUnreadCount: number | undefined;
  let overlayUnreadRevision: number | undefined;
  let overlayRealtimeCursor: string | null | undefined;
  for (let attempt = 0; attempt < MAX_RESYNC_RETRIES; attempt += 1) {
    const startSnapshot = store.getSnapshot();
    const startUnreadRevision = store.getUnreadOrderingRevision();
    if (startSnapshot.generation !== generation) return false;
    const expectedRevision = startSnapshot.revision;
    const items: TenantNotification[] = [];
    const ids = new Set<string>();
    let cursor: string | null = null;
    let unreadCount: number | null = null;
    let unreadRevision: number | null = null;
    let unreadChangedAt: string | null = null;
    let concurrentChange = false;

    for (let pageNumber = 0; pageNumber < MAX_RESYNC_PAGES; pageNumber += 1) {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor !== null) params.set("cursor", cursor);
      const response = await customTenantFetch<unknown>(
        `/api/tenant/core/v1/notifications?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          maxResponseBytes: MAX_NOTIFICATION_RESPONSE_BYTES,
        },
      );
      const page = notificationListSchema.parse(
        unwrapCoreData<unknown>(response.data),
      );
      unreadCount ??= page.unreadCount;
      unreadRevision ??= page.unreadRevision;
      unreadChangedAt ??= page.unreadChangedAt;
      if (
        page.unreadCount !== unreadCount ||
        page.unreadRevision !== unreadRevision ||
        page.unreadChangedAt !== unreadChangedAt
      ) {
        throw new Error("Notification unread authority changed during resync.");
      }
      for (const item of page.items) {
        if (ids.has(item.id)) {
          throw new Error("Notification resync returned a duplicate item.");
        }
        ids.add(item.id);
        items.push(Object.freeze(item));
      }
      if (!page.hasNext) {
        const merged = applyResyncOverlay(items, overlay);
        if (!merged.complete) {
          concurrentChange = true;
          break;
        }
        const mergedUnreadCount =
          overlayUnreadCount !== undefined &&
          overlayUnreadRevision !== undefined &&
          overlayUnreadRevision > unreadRevision
            ? overlayUnreadCount
            : unreadCount;
        if (
          store.replaceAfterResync(
            generation,
            merged.items,
            mergedUnreadCount,
            unreadRevision,
            unreadChangedAt,
            overlayRealtimeCursor !== undefined
              ? overlayRealtimeCursor
              : lastRealtimeCursor,
            expectedRevision,
          )
        ) {
          return true;
        }
        rememberConcurrentChanges(
          startSnapshot,
          store.getSnapshot(),
          startUnreadRevision,
          store.getUnreadOrderingRevision(),
          (notificationId) =>
            store.getRecipientStateVersion(notificationId),
          overlay,
          (value, revision, isAuthoritative) => {
            if (isAuthoritative) {
              overlayUnreadCount = value;
              overlayUnreadRevision = revision ?? undefined;
            }
          },
          (value) => {
            overlayRealtimeCursor = value;
          },
        );
        concurrentChange = true;
        break;
      }
      cursor = page.nextCursor;
    }
    if (!concurrentChange) {
      throw new Error("Notification resync exceeded the bounded page limit.");
    }
  }
  return false;
}

function rememberConcurrentChanges(
  before: TenantNotificationSnapshot,
  after: TenantNotificationSnapshot,
  beforeUnreadRevision: number | null,
  afterUnreadRevision: number | null,
  recipientStateVersion: (notificationId: string) => number | null,
  overlay: Map<string, ResyncOverlayMutation>,
  rememberUnreadCount: (
    value: number,
    revision: number | null,
    isAuthoritative: boolean,
  ) => void,
  rememberRealtimeCursor: (value: string | null) => void,
): void {
  if (before.generation !== after.generation) return;
  const beforeItems = new Map(before.items.map((item) => [item.id, item]));
  const afterItems = new Map(after.items.map((item) => [item.id, item]));
  for (const [id, item] of afterItems) {
    const prior = beforeItems.get(id);
    if (!prior || JSON.stringify(prior) !== JSON.stringify(item)) {
      rememberOverlayMutation(overlay, {
        kind: "UPSERT",
        item,
        requiresRestPresence: prior === undefined,
      });
    }
  }
  for (const id of beforeItems.keys()) {
    if (!afterItems.has(id)) {
      const version = recipientStateVersion(id);
      if (version === null) {
        throw new Error("Notification dismissal lost its state version.");
      }
      rememberOverlayMutation(overlay, {
        kind: "DELETE",
        recipientStateVersion: version,
      }, id);
    }
  }
  rememberUnreadCount(
    after.unreadCount,
    afterUnreadRevision,
    afterUnreadRevision !== beforeUnreadRevision,
  );
  if (after.lastRealtimeCursor !== before.lastRealtimeCursor) {
    rememberRealtimeCursor(after.lastRealtimeCursor);
  }
}

function applyResyncOverlay(
  restItems: readonly TenantNotification[],
  overlay: ReadonlyMap<string, ResyncOverlayMutation>,
): { readonly complete: boolean; readonly items: TenantNotification[] } {
  const merged = new Map(restItems.map((item) => [item.id, item]));
  const promoted: TenantNotification[] = [];
  for (const [id, mutation] of overlay) {
    const restItem = merged.get(id);
    if (mutation.kind === "DELETE") {
      if (!restItem) continue;
      if (restItem.recipientStateVersion > mutation.recipientStateVersion) {
        continue;
      }
      if (restItem.recipientStateVersion === mutation.recipientStateVersion) {
        throw new Error("Notification dismissal equivocated during resync.");
      }
      merged.delete(id);
      continue;
    }
    const item = mutation.item;
    if (!restItem && mutation.requiresRestPresence) {
      return { complete: false, items: [] };
    }
    if (restItem) {
      if (restItem.recipientStateVersion > item.recipientStateVersion) continue;
      if (restItem.recipientStateVersion === item.recipientStateVersion) {
        if (
          notificationStateFingerprint(restItem) !==
          notificationStateFingerprint(item)
        ) {
          throw new Error("Notification recipient state equivocated during retry.");
        }
        continue;
      }
    }
    merged.delete(id);
    promoted.push(item);
  }
  return {
    complete: true,
    items: [...promoted.reverse(), ...merged.values()].slice(
      0,
      MAX_CACHED_NOTIFICATIONS,
    ),
  };
}

function rememberOverlayMutation(
  overlay: Map<string, ResyncOverlayMutation>,
  mutation: ResyncOverlayMutation,
  explicitId?: string,
): void {
  const id = explicitId ??
    (mutation.kind === "UPSERT" ? mutation.item.id : undefined);
  if (!id) throw new Error("Notification overlay identity is missing.");
  const incomingVersion = mutation.kind === "UPSERT"
    ? mutation.item.recipientStateVersion
    : mutation.recipientStateVersion;
  const prior = overlay.get(id);
  if (prior) {
    const priorVersion = prior.kind === "UPSERT"
      ? prior.item.recipientStateVersion
      : prior.recipientStateVersion;
    if (priorVersion > incomingVersion) return;
    if (priorVersion === incomingVersion) {
      if (
        prior.kind !== mutation.kind ||
        (prior.kind === "UPSERT" &&
          mutation.kind === "UPSERT" &&
          notificationStateFingerprint(prior.item) !==
            notificationStateFingerprint(mutation.item))
      ) {
        throw new Error("Notification overlay state equivocated.");
      }
      return;
    }
    if (mutation.kind === "UPSERT" && prior.kind === "UPSERT") {
      mutation = {
        ...mutation,
        requiresRestPresence:
          prior.requiresRestPresence || mutation.requiresRestPresence,
      };
    }
  }
  overlay.set(id, mutation);
}

export async function markTenantNotificationRead(
  notificationId: string,
): Promise<void> {
  await customTenantFetch(
    `/api/tenant/core/v1/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "POST" },
  );
}

export async function markAllTenantNotificationsRead(): Promise<void> {
  await customTenantFetch("/api/tenant/core/v1/notifications/read-all", {
    method: "POST",
  });
}
