import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  publishAdminAuthEvent,
  readLatestAdminAuthEvent,
  type AdminAuthEventTiming,
} from "./sessionCoordinator";

const STORAGE_KEY = "admin_auth_session_event";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const VALID_TIMING: AdminAuthEventTiming = {
  expiresIn: 600,
  sessionExpiresIn: 28_800,
  authorizationVersion: 7,
  profileVersion: 3,
};
const VALID_SAVED_AT = 1_786_467_136_564;

describe("admin auth session coordination events", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal("window", {
      localStorage: storage,
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("publishes a safe timing snapshot using savedAt as issuedAt", () => {
    const event = publishAdminAuthEvent(
      "session-updated",
      "session-1",
      false,
      { ...VALID_TIMING, savedAt: VALID_SAVED_AT },
    );

    expect(event).toMatchObject({
      realm: "admin",
      kind: "session-updated",
      sessionId: "session-1",
      issuedAt: VALID_SAVED_AT,
      timing: {
        expiresIn: 600,
        sessionExpiresIn: 28_800,
        authorizationVersion: 7,
        profileVersion: 3,
      },
    });
    expect(event.timing).not.toHaveProperty("savedAt");
    expect(readLatestAdminAuthEvent()).toEqual(event);
  });

  it("uses the publication time when fresh timing has no savedAt", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_786_467_200_000);

    const event = publishAdminAuthEvent(
      "session-updated",
      "session-1",
      false,
      VALID_TIMING,
    );

    expect(event.issuedAt).toBe(1_786_467_200_000);
    expect(event.timing).toEqual(VALID_TIMING);
  });

  it("preserves legacy session-updated events without timing", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_786_467_200_000);

    const event = publishAdminAuthEvent("session-updated", "session-1", false);

    expect(event.issuedAt).toBe(1_786_467_200_000);
    expect(event).not.toHaveProperty("timing");
    expect(readLatestAdminAuthEvent()).toEqual(event);
  });

  it("accepts legacy stored session-ended events without timing", () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(baseStoredEvent({ kind: "session-ended" })),
    );

    expect(readLatestAdminAuthEvent()).toMatchObject({
      kind: "session-ended",
      issuedAt: VALID_SAVED_AT,
    });
  });

  it("rejects partial timing snapshots", () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        baseStoredEvent({
          timing: {
            expiresIn: 600,
            sessionExpiresIn: 28_800,
            authorizationVersion: 7,
          },
        }),
      ),
    );

    expect(readLatestAdminAuthEvent()).toBeNull();
  });

  it.each([
    ["issuedAt", { issuedAt: 0 }],
    ["fractional issuedAt", { issuedAt: 1.5 }],
    ["expiresIn", { timing: { ...eventTiming(), expiresIn: 0 } }],
    [
      "sessionExpiresIn",
      { timing: { ...eventTiming(), sessionExpiresIn: -1 } },
    ],
    [
      "authorizationVersion",
      { timing: { ...eventTiming(), authorizationVersion: 1.5 } },
    ],
    ["profileVersion", { timing: { ...eventTiming(), profileVersion: null } }],
  ])("rejects an invalid positive integer %s", (_label, patch) => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(baseStoredEvent(patch as Record<string, unknown>)),
    );

    expect(readLatestAdminAuthEvent()).toBeNull();
  });

  it("rejects timing on a stored session-ended event", () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        baseStoredEvent({ kind: "session-ended", timing: eventTiming() }),
      ),
    );

    expect(readLatestAdminAuthEvent()).toBeNull();
  });

  it("refuses to publish invalid or session-ended timing", () => {
    expect(() =>
      publishAdminAuthEvent(
        "session-updated",
        "session-1",
        false,
        { ...VALID_TIMING, savedAt: 0 },
      ),
    ).toThrow("Admin auth event timing is invalid.");

    expect(() =>
      publishAdminAuthEvent(
        "session-ended",
        "session-1",
        false,
        VALID_TIMING,
      ),
    ).toThrow("Session-ended auth events cannot include timing.");
  });
});

function eventTiming() {
  return {
    expiresIn: VALID_TIMING.expiresIn,
    sessionExpiresIn: VALID_TIMING.sessionExpiresIn,
    authorizationVersion: VALID_TIMING.authorizationVersion,
    profileVersion: VALID_TIMING.profileVersion,
  };
}

function baseStoredEvent(patch: Record<string, unknown> = {}) {
  return {
    realm: "admin",
    kind: "session-updated",
    eventId: "event-1",
    sourceId: "source-1",
    issuedAt: VALID_SAVED_AT,
    sessionId: "session-1",
    ...patch,
  };
}
