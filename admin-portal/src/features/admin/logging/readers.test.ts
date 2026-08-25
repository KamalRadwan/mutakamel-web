import { describe, expect, it } from "vitest";
import {
  readEffectiveLoggingLevel,
  readLoggingHistory,
  readLoggingOverride,
  readLoggingOverrides,
  readRuntimeLogEvent,
} from "./readers";
import {
  CORRELATION_ID,
  HISTORY_ROW,
  OVERRIDE_ID,
  OVERRIDE_ROW,
  TENANT_ID,
  envelope,
} from "./test-fixtures";

describe("logging contract readers", () => {
  it("reads exact override entities in the canonical Core envelope", () => {
    expect(readLoggingOverrides(envelope([OVERRIDE_ROW]))).toEqual({
      data: [expect.objectContaining({
        id: OVERRIDE_ID,
        scope: "TENANT_APP",
        appName: "crm-app",
        tenantId: TENANT_ID,
        level: "debug",
      })],
      correlationId: CORRELATION_ID,
      timestamp: "2026-08-12T12:31:00.000Z",
    });
    expect(readLoggingOverride(envelope(OVERRIDE_ROW)).data.id).toBe(OVERRIDE_ID);
  });

  it("reads append-only history and effective precedence responses", () => {
    expect(readLoggingHistory(envelope([HISTORY_ROW])).data[0]).toMatchObject({
      action: "UPDATE",
      previousLevel: "warn",
      level: "debug",
    });
    expect(
      readEffectiveLoggingLevel(envelope({ level: "warn", source: "FALLBACK" })),
    ).toMatchObject({ data: { level: "warn", source: "FALLBACK" } });
  });

  it("accepts a legacy no-expiry global row only with the exact target shape", () => {
    const row = {
      ...OVERRIDE_ROW,
      scope: "GLOBAL",
      appName: null,
      tenantId: null,
      expiresAt: null,
      createdBy: null,
      updatedBy: null,
    };
    expect(readLoggingOverride(envelope(row)).data.expiresAt).toBeNull();
  });

  it.each([
    ["legacy unwrapped body", { data: [OVERRIDE_ROW] }],
    ["UUIDv4 entity", envelope([{ ...OVERRIDE_ROW, id: "00000000-0000-4000-8000-000000000000" }])],
    ["invalid scope target", envelope([{ ...OVERRIDE_ROW, scope: "GLOBAL" }])],
    ["unknown level", envelope([{ ...OVERRIDE_ROW, level: "verbose" }])],
    ["noncanonical time", envelope([{ ...OVERRIDE_ROW, updatedAt: "2026-08-12T12:30:00Z" }])],
  ])("fails closed on %s", (_label, payload) => {
    expect(() => readLoggingOverrides(payload)).toThrow(
      "INVALID_LOGGING_RESPONSE",
    );
  });

  it("projects live events without retaining context or user identity", () => {
    const result = readRuntimeLogEvent(
      {
        timestamp: "2026-08-12T12:30:00.000Z",
        level: "error",
        serviceName: "trade-app",
        message: "  redacted backend message  ",
        correlationId: "corr-1",
        tenantId: TENANT_ID,
        userId: "019f1000-0000-7000-8000-000000000099",
        context: { authorization: "must-never-render" },
      },
      7,
    );

    expect(result).toEqual({
      sequence: 7,
      timestamp: "2026-08-12T12:30:00.000Z",
      level: "error",
      serviceName: "trade-app",
      message: "  redacted backend message  ",
      correlationId: "corr-1",
      tenantId: TENANT_ID,
    });
    expect(result).not.toHaveProperty("context");
    expect(result).not.toHaveProperty("userId");
  });

  it("rejects oversized or structurally invalid live events", () => {
    expect(() =>
      readRuntimeLogEvent(
        {
          timestamp: "2026-08-12T12:30:00.000Z",
          level: "info",
          serviceName: "core-app",
          message: "x".repeat(4_001),
        },
        1,
      ),
    ).toThrow("INVALID_LIVE_LOG_EVENT");
  });
});
