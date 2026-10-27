// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TenantNotificationRuntimeStore,
  refreshTenantNotifications,
  resyncTenantNotifications,
  type TenantNotification,
} from "./tenant-notification-runtime";

const generation = "tenant:session:user";

describe("TenantNotificationRuntimeStore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("invalidates queries on data changes and commands without changing recipient ordering", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    const reload = vi.fn(async () => {});
    const unsubscribe = store.subscribeInvalidation(reload);
    const before = store.getSnapshot();
    await store.invalidateQueries();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(before);
    store.setLoadState(generation, "loading");
    store.setLoadState(generation, "ready");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.applyCreated(generation, createdPayload())).toBe("applied");
    expect(reload).toHaveBeenCalledTimes(2);
    expect(store.applyCreated(generation, createdPayload())).toBe("duplicate");
    expect(reload).toHaveBeenCalledTimes(2);
    expect(store.applyUnreadCount(generation, 7, 1, "2026-10-17T12:00:00.000Z")).toBe("applied");
    expect(reload).toHaveBeenCalledTimes(3);
    unsubscribe();
    await store.invalidateQueries();
    expect(reload).toHaveBeenCalledTimes(3);
  });

  it("invalidates historical queries for recipient changes outside the bounded shell cache", () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    const reload = vi.fn(async () => {});
    store.subscribeInvalidation(reload);
    const before = store.getSnapshot();
    expect(store.applyUpdated(generation, {
      notificationId: uuid(999), recipientId: uuid(2), change: "READ",
      state: { readAt: "2026-10-17T12:00:00.000Z", acknowledgedAt: null, dismissedAt: null },
      changedAt: "2026-10-17T12:00:00.000Z", recipientStateVersion: 1,
    })).toBe("missing");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(before);
  });

  it("shares REST hydration and exposes loading without changing the data revision", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    const revision = store.getSnapshot().revision;
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));

    const first = refreshTenantNotifications(generation, null, store);
    const second = refreshTenantNotifications(generation, null, store);
    expect(first).toBe(second);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(store.getSnapshot()).toMatchObject({ loadState: "loading", revision, items: [] });

    resolve(jsonResponse(page([restItem(1)], 7, null, false)));
    await expect(first).resolves.toBe(true);
    expect(store.getSnapshot()).toMatchObject({ loadState: "ready", unreadCount: 7 });
    expect(store.getSnapshot().items).toHaveLength(1);
  });

  it("keeps failed hydration recoverable and preserves a previously loaded cache", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    mockFetch([{ invalid: true }, page([restItem(1)], 3, null, false), { invalid: true }]);

    await expect(refreshTenantNotifications(generation, null, store)).rejects.toBeDefined();
    expect(store.getSnapshot()).toMatchObject({ loadState: "error", items: [] });
    await expect(refreshTenantNotifications(generation, null, store)).resolves.toBe(true);
    const ready = store.getSnapshot();
    await expect(refreshTenantNotifications(generation, null, store)).rejects.toBeDefined();
    expect(store.getSnapshot()).toMatchObject({ loadState: "error", unreadCount: 3 });
    expect(store.getSnapshot().items).toBe(ready.items);
    expect(store.getSnapshot().revision).toBe(ready.revision);
  });

  it("does not publish a prior session's loading failure into a new session", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    let reject!: (error: Error) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((_resolve, fail) => { reject = fail; })));
    const pending = refreshTenantNotifications(generation, null, store);
    await vi.waitFor(() => expect(reject).toBeTypeOf("function"));
    store.bindGeneration("tenant:other-session:other-user");
    reject(new TypeError("Network unavailable"));
    await expect(pending).rejects.toBeDefined();
    expect(store.getSnapshot()).toMatchObject({ generation: "tenant:other-session:other-user", loadState: "idle", items: [] });
  });

  it("starts a fresh post-mutation reconciliation after an older REST request", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }))
      .mockResolvedValueOnce(jsonResponse({ ...page([], 0, null, false), unreadRevision: 2 }));
    vi.stubGlobal("fetch", fetcher);
    const initial = refreshTenantNotifications(generation, null, store);
    const afterMutation = refreshTenantNotifications(generation, null, store, true);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    resolve(jsonResponse(page([restItem(1)], 1, null, false)));
    await initial;
    await expect(afterMutation).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).toMatchObject({ loadState: "ready", unreadCount: 0, items: [] });
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

  it.each([501, 2_000])(
    "hydrates and reconnects a recent window from %i retained notifications",
    async (total) => {
      const store = new TenantNotificationRuntimeStore();
      store.bindGeneration(generation);
      const retained = Array.from({ length: total }, (_, index) =>
        restItem(total - index),
      );
      const before = store.getSnapshot();
      mockFetch(inboxPages(retained, total));
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      await expect(
        resyncTenantNotifications(generation, "initial-cursor", store),
      ).resolves.toBe(true);

      expect(fetch).toHaveBeenCalledTimes(10);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.getSnapshot().revision).toBe(before.revision + 1);
      expect(store.getSnapshot().items).toEqual(retained.slice(0, 500));
      expect(store.getSnapshot().unreadCount).toBe(total);
      expect(store.getUnreadOrderingRevision()).toBe(1);

      const changedAt = "2026-08-14T10:05:00.000Z";
      const reconnected = [
        restItem(total + 1),
        { ...retained[0], readAt: changedAt, recipientStateVersion: 1 },
        ...retained.slice(1),
      ];
      mockFetch(inboxPages(reconnected, total, 2, changedAt));

      await expect(
        resyncTenantNotifications(generation, "reconnect-cursor", store),
      ).resolves.toBe(true);

      expect(fetch).toHaveBeenCalledTimes(10);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(store.getSnapshot().items).toEqual(reconnected.slice(0, 500));
      expect(store.getSnapshot()).toMatchObject({
        unreadCount: total,
        lastRealtimeCursor: "reconnect-cursor",
      });
      expect(store.getUnreadOrderingRevision()).toBe(2);
      unsubscribe();
    },
  );

  it("merges concurrent reads, dismissal, eviction and unread authority in a full window", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    const initial = Array.from({ length: 500 }, (_, index) => restItem(500 - index));
    store.replaceAfterResync(
      generation, initial, 2_000, 1, "2026-08-14T10:00:00.000Z",
      "initial-cursor", store.getSnapshot().revision,
    );
    const changedAt = "2026-08-14T10:05:00.000Z";
    const created = {
      ...createdPayload(),
      notificationId: uuid(501),
      recipientId: uuid(601),
    };
    const newItem = { ...restItemFromPayload(created), id: created.notificationId };
    // Core has omitted the dismissed row. A stale read projection for the
    // evicted tail must still receive the newer live read state on retry.
    const recent = [newItem, initial[0], ...initial.slice(2)];
    const responses = [
      ...inboxPages(initial, 2_000),
      ...inboxPages(recent, 2_000),
    ];
    let request = 0;
    const fetcher = vi.fn(() => {
      if (request === 0) {
        for (const item of [initial[0], initial[499]]) {
          expect(store.applyUpdated(generation, {
            ...updatedPayload(1, changedAt),
            notificationId: item.id,
            recipientId: item.recipientId,
          })).toBe("applied");
        }
        expect(store.applyCreated(generation, created)).toBe("applied");
        expect(store.applyUpdated(generation, {
          ...updatedPayload(1, changedAt, null),
          notificationId: initial[1].id,
          recipientId: initial[1].recipientId,
          change: "DISMISSED",
          state: { readAt: null, acknowledgedAt: null, dismissedAt: changedAt },
        })).toBe("applied");
        expect(store.applyUnreadCount(generation, 1_998, 2, changedAt)).toBe("applied");
      }
      return Promise.resolve(jsonResponse(responses[request++]));
    });
    vi.stubGlobal("fetch", fetcher);

    await expect(
      resyncTenantNotifications(generation, "resync-start", store),
    ).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledTimes(20);
    expect(store.getSnapshot().items.map((item) => item.id)).toEqual(
      recent.map((item) => item.id),
    );
    for (const id of [initial[0].id, initial[499].id]) {
      expect(store.getSnapshot().items.find((item) => item.id === id)).toMatchObject({
        readAt: changedAt,
        recipientStateVersion: 1,
      });
    }
    expect(store.getSnapshot().items.some((item) => item.id === initial[1].id)).toBe(false);
    expect(store.getSnapshot()).toMatchObject({
      unreadCount: 1_998,
      lastRealtimeCursor: created.cursor,
    });
    expect(store.getUnreadOrderingRevision()).toBe(2);
    expect(store.applyUnreadCount(generation, 2_000, 1, changedAt)).toBe("stale");
    expect(store.applyUpdated(generation, {
      ...updatedPayload(0, changedAt),
      notificationId: initial[0].id,
      recipientId: initial[0].recipientId,
    })).toBe("stale");
  });

  it("does not require a delayed creation outside the recent REST window", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    const recent = Array.from({ length: 500 }, (_, index) => restItem(2_000 - index));
    const responses = inboxPages(recent, 2_000);
    let request = 0;
    vi.stubGlobal("fetch", vi.fn(() => {
      if (request === 0) store.applyCreated(generation, createdPayload());
      return Promise.resolve(jsonResponse(responses[request++ % 10]));
    }));

    await expect(
      resyncTenantNotifications(generation, "resync-start", store),
    ).resolves.toBe(true);

    expect(fetch).toHaveBeenCalledTimes(20);
    expect(store.getSnapshot().items).toEqual(recent);
    expect(store.getSnapshot()).toMatchObject({
      unreadCount: 2_000,
      lastRealtimeCursor: "stream-cursor-1",
    });
  });

  it("retries an advancing unread authority before publishing the window", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    const items = Array.from({ length: 500 }, (_, index) => restItem(500 - index));
    const changedAt = "2026-08-14T10:05:00.000Z";
    const recent = [
      { ...items[0], readAt: changedAt, recipientStateVersion: 1 },
      ...items.slice(1),
    ];
    const initial = inboxPages(items, 2_000);
    mockFetch([
      initial[0],
      { ...initial[1], unreadCount: 1_999, unreadRevision: 2, unreadChangedAt: changedAt },
      ...inboxPages(recent, 1_999, 2, changedAt),
    ]);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    await expect(resyncTenantNotifications(generation, null, store)).resolves.toBe(true);

    expect(fetch).toHaveBeenCalledTimes(12);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().items).toEqual(recent);
    expect(store.getSnapshot().unreadCount).toBe(1_999);
    expect(store.getUnreadOrderingRevision()).toBe(2);
    unsubscribe();
  });

  it("rejects conflicting unread authority at the same revision across pages", async () => {
    const store = new TenantNotificationRuntimeStore();
    store.bindGeneration(generation);
    const before = store.getSnapshot();
    mockFetch([
      page([restItem(2)], 2_000, "page-2", true),
      page([restItem(1)], 1_999, "page-3", true),
    ]);

    await expect(resyncTenantNotifications(generation, null, store)).rejects.toThrow(
      "Notification unread authority changed during resync.",
    );
    expect(store.getSnapshot()).toBe(before);
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
    // An obsolete response is ignored before validation or another page read.
    resolveResponse?.(jsonResponse({ invalid: true }));

    await expect(pending).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
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

function inboxPages(
  items: readonly TenantNotification[],
  unreadCount: number,
  unreadRevision = 1,
  unreadChangedAt = "2026-08-14T10:00:00.000Z",
) {
  return Array.from({ length: 10 }, (_, index) => ({
    ...page(items.slice(index * 50, (index + 1) * 50), unreadCount, `page-${index + 2}`, true),
    unreadRevision,
    unreadChangedAt,
  }));
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
