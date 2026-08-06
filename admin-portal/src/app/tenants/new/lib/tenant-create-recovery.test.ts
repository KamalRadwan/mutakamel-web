// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeSessionStorage } from "@/lib/safeStorage";
import {
  TENANT_CREATE_RECOVERY_STORAGE_KEY,
  clearPendingTenantCreateStatusAttempt,
  isTenantCreateDraftCurrent,
  persistPendingTenantCreateStatusAttempt,
  readPendingTenantCreateStatusAttempt,
  readTenantCreateStatus,
} from "./tenant-create-recovery";

const idempotencyKey = "019f0000-0000-7000-8000-000000000010";
const tenantId = "019f0000-0000-7000-8000-000000000011";
const attempt = {
  version: 1 as const,
  idempotencyKey,
  tenantName: "acme-eg",
  savedAt: "2030-01-01T00:00:00.000Z",
};

describe("tenant create status recovery", () => {
  beforeEach(() => sessionStorage.clear());

  it("persists only the public tenant name and command status identity", () => {
    persistPendingTenantCreateStatusAttempt(attempt);
    expect(readPendingTenantCreateStatusAttempt()).toEqual(attempt);
    const stored = sessionStorage.getItem(TENANT_CREATE_RECOVERY_STORAGE_KEY) ?? "";
    expect(stored).not.toMatch(/company|owner|quote|database|storage|email/i);

    clearPendingTenantCreateStatusAttempt();
    expect(readPendingTenantCreateStatusAttempt()).toBeNull();
  });

  it("rejects PII-expanded or malformed recovery evidence", () => {
    expect(
      readPendingTenantCreateStatusAttempt(
        JSON.stringify({ ...attempt, ownerEmail: "owner@example.com" }),
      ),
    ).toBeNull();
    expect(
      readPendingTenantCreateStatusAttempt(
        JSON.stringify({ ...attempt, idempotencyKey: "not-v7" }),
      ),
    ).toBeNull();
  });

  it("projects only exact-name authoritative status and checks live draft ownership", () => {
    const payload = [
      { id: tenantId, name: "acme-eg", status: "PROVISIONING", ownerEmail: "hidden" },
    ];
    expect(readTenantCreateStatus(payload, "acme-eg")).toEqual({
      id: tenantId,
      name: "acme-eg",
      status: "PROVISIONING",
    });
    expect(readTenantCreateStatus(payload, "other")).toBeNull();
    expect(isTenantCreateDraftCurrent("draft-a", "draft-a")).toBe(true);
    expect(isTenantCreateDraftCurrent("draft-a", "draft-b")).toBe(false);
  });

  it("fails closed before create when the recovery marker cannot be stored", () => {
    const setItem = vi
      .spyOn(safeSessionStorage, "setItem")
      .mockImplementation(() => undefined);

    expect(() => persistPendingTenantCreateStatusAttempt(attempt)).toThrow(
      "TENANT_CREATE_RECOVERY_STORAGE_UNAVAILABLE",
    );
    setItem.mockRestore();
  });
});
