import { describe, expect, it } from "vitest";
import {
  buildEffectiveQuery,
  buildHistoryQuery,
  buildLiveQuery,
  buildOverrideCommand,
  deleteIntentFingerprint,
  isoToLocalDateTime,
  overrideIntentFingerprint,
  shouldRetainIntent,
} from "./validation";
import { TENANT_ID } from "./test-fixtures";

const NOW = Date.parse("2026-08-12T12:00:00.000Z");

describe("logging command validation", () => {
  it.each([
    ["GLOBAL", "", "", {}],
    ["APP", "core-app", "", { appName: "core-app" }],
    ["TENANT", "", TENANT_ID, { tenantId: TENANT_ID }],
    [
      "TENANT_APP",
      "crm-app",
      TENANT_ID,
      { appName: "crm-app", tenantId: TENANT_ID },
    ],
  ] as const)("builds exact %s scope DTO", (scope, appName, tenantId, target) => {
    const result = buildOverrideCommand(
      {
        scope,
        appName,
        tenantId,
        level: "debug",
        reason: "  investigate  ",
        expiresAtLocal: isoToLocalDateTime("2026-08-12T15:00:00.000Z"),
      },
      NOW,
    );
    expect(result.command).toEqual({
      scope,
      level: "debug",
      reason: "investigate",
      expiresAt: "2026-08-12T15:00:00.000Z",
      ...target,
    });
  });

  it("rejects trace, wrong target shape, empty reason, UUIDv4, past and >24h expiry", () => {
    const base = {
      scope: "TENANT_APP" as const,
      appName: "" as const,
      tenantId: "00000000-0000-4000-8000-000000000000",
      level: "trace" as never,
      reason: " ",
      expiresAtLocal: isoToLocalDateTime("2026-08-14T15:00:00.000Z"),
    };
    expect(buildOverrideCommand(base, NOW)).toMatchObject({
      command: null,
      errors: {
        appName: "APP_REQUIRED",
        tenantId: "TENANT_UUID_V7_REQUIRED",
        level: "INVALID_OVERRIDE_LEVEL",
        reason: "INVALID_REASON",
        expiresAt: "INVALID_EXPIRY",
      },
    });
  });

  it("builds exact history, effective and live filters", () => {
    expect(
      buildHistoryQuery(
        {
          overrideId: TENANT_ID,
          action: "DELETE",
          scope: "TENANT",
          appName: "",
          tenantId: TENANT_ID,
        },
        200,
      ).query,
    ).toEqual({
      overrideId: TENANT_ID,
      action: "DELETE",
      scope: "TENANT",
      tenantId: TENANT_ID,
      limit: 200,
    });
    expect(buildEffectiveQuery({ appName: "worker-app", tenantId: TENANT_ID }).query).toEqual({ appName: "worker-app", tenantId: TENANT_ID });
    expect(buildLiveQuery({ appName: "", tenantId: "", minLevel: "trace" }).query).toEqual({ minLevel: "trace" });
  });

  it("fingerprints exact intent and retains only ambiguous UUIDv7-key outcomes", () => {
    const command = {
      scope: "GLOBAL" as const,
      level: "warn" as const,
      reason: "temporary",
      expiresAt: "2026-08-12T13:00:00.000Z",
    };
    expect(overrideIntentFingerprint(command)).toContain('"PUT"');
    expect(deleteIntentFingerprint(TENANT_ID)).toContain('"DELETE"');
    expect(shouldRetainIntent({ httpStatus: 503, errorCode: "UPSTREAM_UNAVAILABLE" })).toBe(true);
    expect(shouldRetainIntent({ httpStatus: 409, errorCode: "GW.IDEM.IN_FLIGHT" })).toBe(true);
    expect(shouldRetainIntent({ httpStatus: 422, errorCode: "VALIDATION_FAILED" })).toBe(false);
  });
});
