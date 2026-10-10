import { describe, expect, it } from "vitest";
import { OPERATION_ID, tenantDestroyFixture } from "../__tests__/fixtures";
import { TENANT_DESTROY_PHASES } from "../types";
import {
  canAbandonTenantDestroy,
  isTenantDestroyAdvancing,
  tenantDestroyHoldsTenant,
  tenantDestroyPollFingerprint,
} from "./destroy";

describe("tenant destruction lifecycle model", () => {
  it.each([
    ["STOPPING_PROVISIONING", true, true, true],
    ["DROPPING_DATABASE", true, false, true],
    ["FINALIZING", true, false, true],
    ["SUCCEEDED", false, false, true],
    ["BLOCKED", false, true, true],
    ["ABANDONED", false, false, false],
  ] as const)(
    "%s: polled=%s, abandonable=%s, holds the tenant=%s",
    (phase, advancing, abandonable, holds) => {
      expect(isTenantDestroyAdvancing(phase)).toBe(advancing);
      expect(canAbandonTenantDestroy({ phase })).toBe(abandonable);
      expect(tenantDestroyHoldsTenant({ phase })).toBe(holds);
    },
  );

  it("covers every phase Core can answer", () => {
    expect([...TENANT_DESTROY_PHASES].sort()).toEqual(
      [
        "ABANDONED",
        "BLOCKED",
        "DROPPING_DATABASE",
        "FINALIZING",
        "STOPPING_PROVISIONING",
        "SUCCEEDED",
      ].sort(),
    );
  });

  it("offers nothing and holds nothing when no request exists", () => {
    expect(canAbandonTenantDestroy(null)).toBe(false);
    expect(tenantDestroyHoldsTenant(null)).toBe(false);
  });

  it("fingerprints only what Worker or Core changed", () => {
    const waiting = tenantDestroyFixture("STOPPING_PROVISIONING");
    expect(tenantDestroyPollFingerprint({ ...waiting })).toBe(
      tenantDestroyPollFingerprint(waiting),
    );
    for (const changed of [
      { attempts: waiting.attempts + 1 },
      { nextAttemptAt: "2026-08-11T19:40:00.000Z" },
      { lastErrorCode: "TENANT_DESTROY_OPEN_PROVISIONING_OPERATION" },
      { blockingOperationId: null },
      { phase: "DROPPING_DATABASE" as const, blockingOperationId: null },
    ]) {
      expect(tenantDestroyPollFingerprint({ ...waiting, ...changed })).not.toBe(
        tenantDestroyPollFingerprint(waiting),
      );
    }
    expect(tenantDestroyPollFingerprint(null)).not.toBe(
      tenantDestroyPollFingerprint(
        tenantDestroyFixture("BLOCKED", { blockingOperationId: OPERATION_ID }),
      ),
    );
  });
});
