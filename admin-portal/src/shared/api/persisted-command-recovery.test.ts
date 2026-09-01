// @vitest-environment jsdom

import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeSessionStorage } from "@/lib/safeStorage";

const { generateUUIDv7Mock } = vi.hoisted(() => ({
  generateUUIDv7Mock: vi.fn(),
}));

vi.mock("@/lib/utils/uuid", () => ({
  generateUUIDv7: generateUUIDv7Mock,
}));

import {
  PendingCommandIntentMismatchError,
  clearPersistedCommandAttempt,
  preparePersistedCommandAttempt,
  readPersistedCommandAttempt,
  sha256CanonicalJson,
} from "./persisted-command-recovery";

const storageKey = "test.pending-command";
const route = "/api/admin/worker/v1/backups/runs";
const idempotencyKey = "019f0000-0000-7000-8000-000000000001";
const serverId = "019f0000-0000-7000-8000-000000000002";

describe("persisted command recovery", () => {
  beforeEach(() => {
    sessionStorage.clear();
    generateUUIDv7Mock.mockReset().mockReturnValue(idempotencyKey);
    vi.stubGlobal("crypto", webcrypto);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("preserves canonical recovery hashes and exact retries without SubtleCrypto", async () => {
    vi.stubGlobal("crypto", {});
    const intent = { z: "متكامل ✅", a: [{ d: 4, c: 3 }], omitted: undefined };
    const expected = createHash("sha256")
      .update('{"a":[{"c":3,"d":4}],"z":"متكامل ✅"}', "utf8")
      .digest("hex");
    await expect(sha256CanonicalJson(intent)).resolves.toBe(expected);

    const command = { storageKey, route, intent, resource: { kind: "DATABASE_SERVER", id: serverId } };
    const first = await preparePersistedCommandAttempt(command);
    const replay = await preparePersistedCommandAttempt({ ...command, intent: { a: [{ c: 3, d: 4 }], z: intent.z } });
    expect(first.intentSha256).toBe(expected);
    expect(replay).toEqual(first);
    await expect(preparePersistedCommandAttempt({ ...command, intent: { ...intent, z: "changed" } }))
      .rejects.toBeInstanceOf(PendingCommandIntentMismatchError);
  });

  it("persists only a digest, key, route, and safe resource identity", async () => {
    const intent = {
      action: "start-backup-run",
      databaseServerId: serverId,
      reason: "do not persist this audit reason",
      tenantConcurrency: 2,
    };
    const first = await preparePersistedCommandAttempt({
      storageKey,
      route,
      intent,
      resource: { kind: "DATABASE_SERVER", id: serverId },
    });
    const replay = await preparePersistedCommandAttempt({
      storageKey,
      route,
      intent: { ...intent },
      resource: { kind: "DATABASE_SERVER", id: serverId },
    });

    expect(replay.idempotencyKey).toBe(first.idempotencyKey);
    expect(sessionStorage.getItem(storageKey)).not.toContain(intent.reason);
    expect(readPersistedCommandAttempt(storageKey, route)).toEqual(first);
  });

  it("blocks a changed intent without replacing unresolved evidence", async () => {
    const original = { action: "start-backup-run", databaseServerId: serverId, reason: "one" };
    await preparePersistedCommandAttempt({
      storageKey,
      route,
      intent: original,
      resource: { kind: "DATABASE_SERVER", id: serverId },
    });
    const retained = sessionStorage.getItem(storageKey);

    await expect(
      preparePersistedCommandAttempt({
        storageKey,
        route,
        intent: { ...original, reason: "two" },
        resource: { kind: "DATABASE_SERVER", id: serverId },
      }),
    ).rejects.toBeInstanceOf(PendingCommandIntentMismatchError);
    expect(sessionStorage.getItem(storageKey)).toBe(retained);

    clearPersistedCommandAttempt(storageKey);
    expect(readPersistedCommandAttempt(storageKey, route)).toBeNull();
  });

  it("canonicalizes object key order and rejects expanded stored records", async () => {
    await expect(sha256CanonicalJson({ b: 2, a: { d: 4, c: 3 } })).resolves.toBe(
      await sha256CanonicalJson({ a: { c: 3, d: 4 }, b: 2 }),
    );

    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        route,
        idempotencyKey,
        intentSha256: "a".repeat(64),
        resource: { kind: "DATABASE_SERVER", id: serverId },
        savedAt: new Date().toISOString(),
        reason: "must not be accepted",
      }),
    );
    expect(readPersistedCommandAttempt(storageKey, route)).toBeNull();
  });

  it("fails closed before a command can be sent when session storage is unavailable", async () => {
    const setItem = vi
      .spyOn(safeSessionStorage, "setItem")
      .mockImplementation(() => undefined);

    await expect(
      preparePersistedCommandAttempt({
        storageKey,
        route,
        intent: { action: "start-backup-run", databaseServerId: serverId },
        resource: { kind: "DATABASE_SERVER", id: serverId },
      }),
    ).rejects.toThrow("COMMAND_RECOVERY_STORAGE_UNAVAILABLE");
    setItem.mockRestore();
  });
});
