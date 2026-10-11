import { describe, expect, it } from "vitest";
import {
  OPERATION_ID,
  haltedTenantDestroyFixture,
  tenantDestroyFixture,
} from "../__tests__/fixtures";
import { TENANT_DESTROY_PHASES } from "../types";
import {
  canAbandonTenantDestroy,
  canResumeTenantDestroy,
  isTenantDestroyAdvancing,
  tenantDestroyHaltedPhase,
  tenantDestroyHoldsTenant,
  tenantDestroyPollFingerprint,
} from "./destroy";

describe("tenant destruction lifecycle model", () => {
  it.each([
    ["STOPPING_PROVISIONING", null, true, true, false, true],
    ["DROPPING_DATABASE", null, true, false, false, true],
    ["FINALIZING", null, true, false, false, true],
    ["SUCCEEDED", null, false, false, false, true],
    // Blocked before the drop: abandoned, never resumed (Core answers a new
    // request with this one unchanged).
    ["BLOCKED", "STOPPING_PROVISIONING", false, true, false, true],
    // Halted after the drop was authorized: resumed, never abandoned.
    ["BLOCKED", "DROPPING_DATABASE", false, false, true, true],
    ["BLOCKED", "FINALIZING", false, false, true, true],
    ["ABANDONED", null, false, false, false, false],
    ["ABANDONED", "STOPPING_PROVISIONING", false, false, false, false],
  ] as const)(
    "%s stopped in %s: polled=%s, abandonable=%s, resumable=%s, holds the tenant=%s",
    (phase, blockedPhase, advancing, abandonable, resumable, holds) => {
      const operation = { phase, blockedPhase };
      expect(isTenantDestroyAdvancing(phase)).toBe(advancing);
      expect(canAbandonTenantDestroy(operation)).toBe(abandonable);
      expect(canResumeTenantDestroy(operation)).toBe(resumable);
      expect(tenantDestroyHaltedPhase(operation)).toBe(
        resumable ? blockedPhase : null,
      );
      expect(tenantDestroyHoldsTenant(operation)).toBe(holds);
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
    expect(canResumeTenantDestroy(null)).toBe(false);
    expect(tenantDestroyHaltedPhase(null)).toBeNull();
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
    // Where a request halted is part of what was observed.
    expect(
      tenantDestroyPollFingerprint(haltedTenantDestroyFixture("FINALIZING")),
    ).not.toBe(
      tenantDestroyPollFingerprint(haltedTenantDestroyFixture("DROPPING_DATABASE")),
    );
  });
});
