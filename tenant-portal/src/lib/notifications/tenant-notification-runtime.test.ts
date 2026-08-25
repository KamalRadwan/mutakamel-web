// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TenantNotificationRuntimeStore,
  resyncTenantNotifications,
} from "./tenant-notification-runtime";

const generation = "tenant:session:user";

describe("TenantNotificationRuntimeStore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("applies a delivery once and detects conflicting replay identities", () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    const payload = createdPayload();

    expect(store.applyCreated(generation, payload)).toBe("applied");
    expect(store.applyCreated(generation, payload)).toBe("duplicate");
    expect(store.getSnapshot()).toMatchObject({
      unreadCount: 0,
      lastRealtimeCursor: "stream-cursor-1",
    });
    expect(store.getSnapshot().items[0]?.deliveredAt).toBeNull();
    expect(store.getSnapshot().items).toHaveLength(1);

    expect(store.applyCreated(generation, {
      ...payload,
      notificationId: uuid(99),
    })).toBe("conflict");
    expect(store.getSnapshot().items).toHaveLength(1);
  });

  it("publishes a complete bounded REST resync atomically", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    mockFetch([
      page([restItem(1)], 2, "page-2", true),
      page([restItem(2)], 2, null, false),
    ]);

    await expect(
      resyncTenantNotifications(generation, "stream-cursor-2", store),
    ).resolves.toBe(true);

    expect(store.getSnapshot()).toMatchObject({
      unreadCount: 2,
      lastRealtimeCursor: "stream-cursor-2",
    });
    expect(store.getSnapshot().items.map((item) => item.id)).toEqual([
      uuid(1),
      uuid(2),
    ]);
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("cursor=page-2"),
      expect.any(Object),
    );
  });

  it("keeps the prior cache and cursor after a partial REST failure", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    store.applyCreated(generation, createdPayload());
    const before = store.getSnapshot();
    mockFetch([
      page([restItem(1)], 2, "page-2", true),
      { invalid: true },
    ]);

    await expect(
      resyncTenantNotifications(generation, "new-cursor", store),
    ).rejects.toBeDefined();

    expect(store.getSnapshot()).toBe(before);
    expect(store.getSnapshot().lastRealtimeCursor).toBe("stream-cursor-1");
  });

  it("cannot apply an async resync across an authentication generation", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    let resolveResponse: ((value: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    }))); 

    const pending = resyncTenantNotifications(generation, null, store);
    await vi.waitFor(() => expect(resolveResponse).toBeTypeOf("function"));
    store.bindGeneration("tenant:other-session:other-user");
    resolveResponse?.(jsonResponse(page([], 0, null, false)));

    await expect(pending).resolves.toBe(false);
    expect(store.getSnapshot()).toMatchObject({
      generation: "tenant:other-session:other-user",
      items: [],
      unreadCount: 0,
    });
  });

  it("retains a live event and rejects bounded retry snapshots that omit its durable row", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    let resolveFirst: ((value: Response) => void) | undefined;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(
        page([restItem(20)], 1, null, false),
      )))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(
        page([restItem(20)], 1, null, false),
      )));
    vi.stubGlobal("fetch", fetcher);

    const pending = resyncTenantNotifications(generation, "resync-start", store);
    await vi.waitFor(() => expect(resolveFirst).toBeTypeOf("function"));
    expect(store.applyCreated(generation, createdPayload())).toBe("applied");
    resolveFirst?.(jsonResponse(page([], 0, null, false)));

    await expect(pending).resolves.toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(store.getSnapshot()).toMatchObject({
      unreadCount: 0,
      lastRealtimeCursor: "stream-cursor-1",
    });
    expect(store.getSnapshot().items.map((item) => item.id)).toEqual([uuid(10)]);
  });

  it("does not double-count a live delivery already present in the retry snapshot", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    let resolveFirst: ((value: Response) => void) | undefined;
    const durableItem = restItemFromPayload(createdPayload());
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(
        page([durableItem], 1, null, false),
      )));
    vi.stubGlobal("fetch", fetcher);

    const pending = resyncTenantNotifications(generation, "resync-start", store);
    await vi.waitFor(() => expect(resolveFirst).toBeTypeOf("function"));
    expect(store.applyCreated(generation, createdPayload())).toBe("applied");
    resolveFirst?.(jsonResponse(page([], 0, null, false)));

    await expect(pending).resolves.toBe(true);
    expect(store.getSnapshot()).toMatchObject({
      unreadCount: 1,
      lastRealtimeCursor: "stream-cursor-1",
    });
    expect(store.getSnapshot().items.map((item) => item.id)).toEqual([uuid(10)]);
  });

  it("prefers a newer REST recipient state over an older live retry overlay", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    store.applyCreated(generation, createdPayload());
    let resolveFirst: ((value: Response) => void) | undefined;
    const newerChangedAt = "2026-08-14T10:04:00.000Z";
    const newerRestItem = {
      ...restItemFromPayload(createdPayload()),
      readAt: newerChangedAt,
      acknowledgedAt: newerChangedAt,
      recipientStateVersion: 2,
    };
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({
        ...page([newerRestItem], 0, null, false),
        unreadRevision: 2,
        unreadChangedAt: newerChangedAt,
      })));
    vi.stubGlobal("fetch", fetcher);

    const pending = resyncTenantNotifications(generation, "resync-start", store);
    await vi.waitFor(() => expect(resolveFirst).toBeTypeOf("function"));
    expect(
      store.applyUpdated(
        generation,
        updatedPayload(1, "2026-08-14T10:03:00.000Z"),
      ),
    ).toBe("applied");
    resolveFirst?.(jsonResponse(page([restItemFromPayload(createdPayload())], 1, null, false)));

    await expect(pending).resolves.toBe(true);
    expect(store.getSnapshot().items[0]).toMatchObject({
      recipientStateVersion: 2,
      readAt: newerChangedAt,
      acknowledgedAt: newerChangedAt,
    });
  });

  it("retains a versioned dismissal over a stale REST retry row", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    store.applyCreated(generation, createdPayload());
    let resolveFirst: ((value: Response) => void) | undefined;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(
        page([{ ...restItem(10), recipientId: uuid(11) }], 1, null, false),
      )));
    vi.stubGlobal("fetch", fetcher);
    const dismissedAt = "2026-08-14T10:03:00.000Z";

    const pending = resyncTenantNotifications(generation, "resync-start", store);
    await vi.waitFor(() => expect(resolveFirst).toBeTypeOf("function"));
    expect(store.applyUpdated(generation, {
      ...updatedPayload(1, dismissedAt, null),
      change: "DISMISSED",
      state: {
        readAt: null,
        acknowledgedAt: null,
        dismissedAt,
      },
    })).toBe("applied");
    resolveFirst?.(jsonResponse(page([restItem(10)], 1, null, false)));

    await expect(pending).resolves.toBe(true);
    expect(store.getSnapshot().items).toEqual([]);
  });

  it("rejects equal unread revisions with different authority", () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    const changedAt = "2026-08-14T10:05:00.000Z";
    expect(store.applyUnreadCount(generation, 2, 5, changedAt)).toBe("applied");
    const before = store.getSnapshot();

    expect(() => store.replaceAfterResync(
      generation,
      [],
      3,
      5,
      changedAt,
      "retry-cursor",
      before.revision,
    )).toThrow("unread revision equivocated");
    expect(store.getSnapshot()).toBe(before);
  });

  it("fences recipient and unread state ordering", () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    store.applyCreated(generation, createdPayload());
    const changedAt = "2026-08-14T10:01:00.000Z";

    expect(store.applyUpdated(generation, updatedPayload(1, changedAt))).toBe(
      "applied",
    );
    expect(store.applyUpdated(generation, updatedPayload(0, changedAt))).toBe(
      "stale",
    );
    expect(store.applyUpdated(generation, updatedPayload(1, changedAt))).toBe(
      "duplicate",
    );
    expect(store.applyUpdated(generation, updatedPayload(1, changedAt, null))).toBe(
      "conflict",
    );
    expect(store.applyUpdated(generation, updatedPayload(3, changedAt))).toBe(
      "gap",
    );
    expect(store.getSnapshot().items[0]?.readAt).toBe(changedAt);

    expect(store.applyUnreadCount(generation, 2, 10, changedAt)).toBe("applied");
    expect(store.applyUnreadCount(generation, 9, 9, changedAt)).toBe("stale");
    expect(store.applyUnreadCount(generation, 2, 10, changedAt)).toBe("duplicate");
    expect(store.applyUnreadCount(generation, 3, 10, changedAt)).toBe("conflict");
    expect(store.applyUnreadCount(generation, 0, 12, changedAt)).toBe("gap");
    expect(store.getSnapshot().unreadCount).toBe(2);
  });

  it("seeds ordering authorities from the REST recovery snapshot", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    const restored = {
      ...restItem(10),
      recipientId: uuid(11),
      recipientStateVersion: 5,
    };
    mockFetch([{
      ...page([restored], 1, null, false),
      unreadRevision: 8,
      unreadChangedAt: "2026-08-14T10:02:00.000Z",
    }]);

    await expect(
      resyncTenantNotifications(generation, "restored-cursor", store),
    ).resolves.toBe(true);
    expect(
      store.applyUpdated(
        generation,
        updatedPayload(7, "2026-08-14T10:03:00.000Z"),
      ),
    ).toBe("gap");
    expect(
      store.applyUpdated(
        generation,
        updatedPayload(6, "2026-08-14T10:03:00.000Z"),
      ),
    ).toBe("applied");
    expect(
      store.applyUnreadCount(
        generation,
        0,
        10,
        "2026-08-14T10:03:00.000Z",
      ),
    ).toBe("gap");
    expect(
      store.applyUnreadCount(
        generation,
        0,
        9,
        "2026-08-14T10:03:00.000Z",
      ),
    ).toBe("applied");
  });

  it("never derives unread totals from cross-queue creation ordering", () => {
    const stateFirst = new TenantNotificationRuntimeStore();
    stateFirst.bindGeneration(generation);
    expect(
      stateFirst.applyUnreadCount(
        generation,
        7,
        3,
        "2026-08-14T10:05:00.000Z",
      ),
    ).toBe("applied");
    expect(stateFirst.applyCreated(generation, createdPayload())).toBe("applied");
    expect(stateFirst.getSnapshot().unreadCount).toBe(7);

    const createdFirst = new TenantNotificationRuntimeStore();
    createdFirst.bindGeneration(generation);
    expect(createdFirst.applyCreated(generation, createdPayload())).toBe("applied");
    expect(createdFirst.getSnapshot().unreadCount).toBe(0);
    expect(
      createdFirst.applyUnreadCount(
        generation,
        7,
        3,
        "2026-08-14T10:05:00.000Z",
      ),
    ).toBe("applied");
    expect(createdFirst.getSnapshot().unreadCount).toBe(7);
  });

  it.each(["READ", "DISMISSED"] as const)(
    "never derives unread totals from cross-queue %s ordering",
    (change) => {
      const changedAt = "2026-08-14T10:06:00.000Z";
      const statePayload = {
        ...updatedPayload(1, changedAt),
        change,
        state: {
          readAt: change === "READ" ? changedAt : null,
          acknowledgedAt: null,
          dismissedAt: change === "DISMISSED" ? changedAt : null,
        },
      };

      const countFirst = new TenantNotificationRuntimeStore();
      countFirst.bindGeneration(generation);
      expect(countFirst.applyCreated(generation, createdPayload())).toBe("applied");
      expect(countFirst.applyUnreadCount(generation, 4, 1, changedAt)).toBe("applied");
      expect(countFirst.applyUpdated(generation, statePayload)).toBe("applied");
      expect(countFirst.applyUpdated(generation, statePayload)).toBe("duplicate");
      expect(countFirst.getSnapshot().unreadCount).toBe(4);

      const stateFirst = new TenantNotificationRuntimeStore();
      stateFirst.bindGeneration(generation);
      expect(stateFirst.applyCreated(generation, createdPayload())).toBe("applied");
      expect(stateFirst.applyUpdated(generation, statePayload)).toBe("applied");
      expect(stateFirst.getSnapshot().unreadCount).toBe(0);
      expect(stateFirst.applyUnreadCount(generation, 4, 1, changedAt)).toBe("applied");
      expect(stateFirst.applyUnreadCount(generation, 4, 1, changedAt)).toBe("duplicate");
      expect(stateFirst.getSnapshot().unreadCount).toBe(4);
    },
  );

  it("preserves REST authority for a delayed delivery duplicate and rejects conflict", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    const payload = createdPayload();
    const authoritative = {
      ...restItem(10),
      recipientId: payload.recipientId,
      sourceApp: "worker-app",
      notificationType: payload.type,
      priority: payload.priority,
      title: payload.title,
      body: payload.body,
      actionUrl: null,
      entityType: null,
      entityId: null,
      channels: ["IN_APP", "EMAIL"],
      metadata: payload.metadata,
      createdAt: payload.createdAt,
      deliveredAt: "2026-08-14T10:05:00.000Z",
    };
    mockFetch([page([authoritative], 1, null, false)]);

    await expect(resyncTenantNotifications(generation, null, store)).resolves.toBe(true);
    const before = store.getSnapshot().items[0];
    expect(store.applyCreated(generation, payload)).toBe("duplicate");
    expect(store.getSnapshot().items[0]).toBe(before);
    expect(store.getSnapshot().items[0]).toMatchObject({
      sourceApp: "worker-app",
      channels: ["IN_APP", "EMAIL"],
      deliveredAt: "2026-08-14T10:05:00.000Z",
    });

    expect(store.applyCreated(generation, {
      ...payload,
      deliveryEventId: uuid(15),
      title: "Conflicting delayed delivery",
    })).toBe("conflict");
    expect(store.getSnapshot().items[0]).toBe(before);
  });

  it("rejects incomplete duplicate equality and unbounded REST metadata", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    const original = createdPayload();
    expect(store.applyCreated(generation, original)).toBe("applied");
    expect(store.applyCreated(generation, {
      ...original,
      deliveryEventId: uuid(13),
      cursor: "stream-cursor-2",
    })).toBe("duplicate");
    expect(store.applyCreated(generation, {
      ...original,
      deliveryEventId: uuid(14),
      priority: "P1_HIGH",
    })).toBe("conflict");

    mockFetch([page([{ ...restItem(1), metadata: { nested: { unsafe: true } } }], 1, null, false)]);
    await expect(resyncTenantNotifications(generation, null, store)).rejects.toBeDefined();
    expect(store.getSnapshot().items).toHaveLength(1);
  });

  it("rejects an oversized REST response before parsing or replacing cache state", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    store.applyCreated(generation, createdPayload());
    const before = store.getSnapshot();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("x".repeat(1_048_577), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );

    await expect(
      resyncTenantNotifications(generation, "oversized-cursor", store),
    ).rejects.toMatchObject({
      response: {
        status: 502,
        data: { errorCode: "API_RESPONSE_TOO_LARGE" },
      },
    });
    expect(store.getSnapshot()).toBe(before);
  });
});

function mockFetch(pages: unknown[]): void {
  const implementation = vi.fn();
  for (const body of pages) {
    implementation.mockImplementationOnce(() =>
      Promise.resolve(jsonResponse(body)),
    );
  }
  vi.stubGlobal("fetch", implementation);
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function page(
  items: unknown[],
  unreadCount: number,
  nextCursor: string | null,
  hasNext: boolean,
) {
  return {
    items,
    unreadCount,
    unreadRevision: 1,
    unreadChangedAt: "2026-08-14T10:00:00.000Z",
    nextCursor,
    hasNext,
  };
}

function restItem(suffix: number) {
  return {
    id: uuid(suffix),
    recipientId: uuid(suffix + 100),
    sourceApp: "core-app",
    notificationType: "tenant.test",
    priority: "P2_NORMAL",
    title: `Notification ${suffix}`,
    body: "Validated body",
    actionUrl: null,
    entityType: null,
    entityId: null,
    channels: ["IN_APP"],
    metadata: {},
    createdAt: "2026-08-14T10:00:00.000Z",
    readAt: null,
    acknowledgedAt: null,
    deliveredAt: "2026-08-14T10:00:00.000Z",
    recipientStateVersion: 0,
  };
}

function createdPayload() {
  return {
    notificationId: uuid(10),
    recipientId: uuid(11),
    deliveryEventId: uuid(12),
    cursor: "stream-cursor-1",
    type: "tenant.test",
    title: "New tenant notification",
    body: "A validated notification body.",
    priority: "P2_NORMAL",
    entity: null,
    action: null,
    createdAt: "2026-08-14T10:00:00.000Z",
    expiresAt: null,
    silent: false,
    metadata: {},
  };
}

function restItemFromPayload(payload: ReturnType<typeof createdPayload>) {
  return {
    ...restItem(10),
    recipientId: payload.recipientId,
    sourceApp: "worker-app",
    notificationType: payload.type,
    priority: payload.priority,
    title: payload.title,
    body: payload.body,
    actionUrl: null,
    entityType: null,
    entityId: null,
    metadata: payload.metadata,
    createdAt: payload.createdAt,
  };
}

function updatedPayload(
  recipientStateVersion: number,
  changedAt: string,
  readAt: string | null = changedAt,
) {
  return {
    notificationId: uuid(10),
    recipientId: uuid(11),
    change: "READ" as const,
    state: {
      readAt,
      acknowledgedAt: null,
      dismissedAt: null,
    },
    changedAt,
    recipientStateVersion,
  };
}

function uuid(suffix: number): string {
  return `019ff4ca-b3c1-73a3-b27e-${suffix.toString().padStart(12, "0")}`;
}
