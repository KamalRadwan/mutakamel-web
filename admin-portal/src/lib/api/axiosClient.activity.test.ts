import { afterEach, describe, expect, it, vi } from "vitest";
import { customFetch } from "./axiosClient";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("admin activity checkpoint liveness", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lets an aborted caller leave a shared checkpoint and bounds a hung checkpoint", async () => {
    vi.useFakeTimers();
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    sessionStorage.setItem(
      "admin_session_meta",
      JSON.stringify({
        savedAt: Date.now(),
        expiresIn: 600,
        sessionExpiresIn: 1_800,
        tokenType: "Bearer",
        sessionId: "019f0000-0000-7000-8000-000000000001",
        remember: false,
        authorizationVersion: 1,
        profileVersion: 1,
        authEventId: "activity-event",
      }),
    );
    const listeners = new Map<string, (event: Event) => void>();
    vi.stubGlobal("window", {
      location: { pathname: "/backup", href: "" },
      dispatchEvent: vi.fn(),
      sessionStorage,
      localStorage,
      addEventListener: (
        name: string,
        listener: EventListenerOrEventListenerObject,
      ) => {
        if (typeof listener === "function") {
          listeners.set(name, listener as (event: Event) => void);
        }
      },
    });
    vi.stubGlobal("sessionStorage", sessionStorage);
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("document", {
      cookie: "__Host-mutakamel-admin-csrf=csrf-proof",
      visibilityState: "visible",
    });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(4),
    });

    const urls: string[] = [];
    const activitySignals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
      urls.push(url);
      if (url === "/api/admin/core/v1/auth/activity") {
        if (init.signal) activitySignals.push(init.signal);
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        });
      }
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }));

    await customFetch("/api/admin/worker/v1/backups/runs");
    urls.length = 0;
    listeners.get("pointerdown")?.({ isTrusted: true } as Event);

    const controller = new AbortController();
    const abortedRequest = customFetch(
      "/api/admin/worker/v1/backups/runs",
      { signal: controller.signal },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(urls).toEqual(["/api/admin/core/v1/auth/activity"]);
    controller.abort();
    await expect(abortedRequest).rejects.toMatchObject({ name: "AbortError" });
    expect(activitySignals[0]?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(activitySignals[0]?.aborted).toBe(true);
    expect(urls).toEqual(["/api/admin/core/v1/auth/activity"]);

    urls.length = 0;
    listeners.get("pointerdown")?.({ isTrusted: true } as Event);
    const timedRequest = customFetch("/api/admin/worker/v1/backups/runs");
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(timedRequest).resolves.toMatchObject({ status: 200 });
    expect(activitySignals[1]?.aborted).toBe(true);
    expect(urls).toEqual([
      "/api/admin/core/v1/auth/activity",
      "/api/admin/worker/v1/backups/runs",
    ]);
  });
});
