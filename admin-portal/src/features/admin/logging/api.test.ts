import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, putMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, put: putMock, delete: deleteMock },
}));

import {
  liveLoggingUrl,
  loggingApi,
  LOGGING_BASE_URL,
  serializeEffectiveQuery,
  serializeHistoryQuery,
  serializeLiveQuery,
  serializeOverrideQuery,
} from "./api";
import {
  CORRELATION_ID,
  HISTORY_ROW,
  IDEMPOTENCY_KEY,
  OVERRIDE_ID,
  OVERRIDE_ROW,
  TENANT_ID,
  envelope,
} from "./test-fixtures";

describe("logging API", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
  });

  it("calls the exact directory route with every Core query field", async () => {
    getMock.mockResolvedValue({ data: envelope([OVERRIDE_ROW]) });
    const controller = new AbortController();
    await loggingApi.list(
      {
        page: 2,
        limit: 100,
        scope: "TENANT_APP",
        appName: "crm-app",
        tenantId: TENANT_ID,
        includeExpired: true,
      },
      controller.signal,
    );
    expect(getMock).toHaveBeenCalledWith(
      `${LOGGING_BASE_URL}?page=2&limit=100&scope=TENANT_APP&appName=crm-app&tenantId=${TENANT_ID}&includeExpired=true`,
      { cache: "no-store", signal: controller.signal },
    );
  });

  it("calls the exact history and effective routes", async () => {
    getMock
      .mockResolvedValueOnce({ data: envelope([HISTORY_ROW]) })
      .mockResolvedValueOnce({
        data: envelope({ level: "debug", source: "TENANT_APP" }),
      });
    await loggingApi.history({
      overrideId: OVERRIDE_ID,
      action: "UPDATE",
      scope: "TENANT_APP",
      appName: "crm-app",
      tenantId: TENANT_ID,
      limit: 200,
    });
    await loggingApi.effective({ appName: "crm-app", tenantId: TENANT_ID });
    expect(getMock).toHaveBeenNthCalledWith(
      1,
      `${LOGGING_BASE_URL}/history?limit=200&overrideId=${OVERRIDE_ID}&action=UPDATE&scope=TENANT_APP&appName=crm-app&tenantId=${TENANT_ID}`,
      { cache: "no-store" },
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `${LOGGING_BASE_URL}/effective?appName=crm-app&tenantId=${TENANT_ID}`,
      { cache: "no-store" },
    );
  });

  it("uses explicit stable UUIDv7 keys for PUT and DELETE", async () => {
    putMock.mockResolvedValue({ data: envelope(OVERRIDE_ROW) });
    deleteMock.mockResolvedValue({
      headers: new Headers({ "x-correlation-id": CORRELATION_ID }),
    });
    const command = {
      scope: "TENANT_APP" as const,
      appName: "crm-app" as const,
      tenantId: TENANT_ID,
      level: "debug" as const,
      reason: "Investigate CRM latency",
      expiresAt: "2026-08-12T15:00:00.000Z",
    };
    await loggingApi.upsert(command, IDEMPOTENCY_KEY);
    expect(await loggingApi.remove(OVERRIDE_ID, IDEMPOTENCY_KEY)).toBe(
      CORRELATION_ID,
    );
    expect(putMock).toHaveBeenCalledWith(LOGGING_BASE_URL, command, {
      headers: { "x-idempotency-key": IDEMPOTENCY_KEY },
    });
    expect(deleteMock).toHaveBeenCalledWith(
      `${LOGGING_BASE_URL}/${OVERRIDE_ID}`,
      { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } },
    );
  });

  it("builds the real authorized SSE URL without auth material in its query", () => {
    expect(
      liveLoggingUrl({
        appName: "worker-app",
        tenantId: TENANT_ID,
        minLevel: "warn",
      }),
    ).toBe(
      `${LOGGING_BASE_URL}/live?appName=worker-app&tenantId=${TENANT_ID}&minLevel=warn`,
    );
  });

  it.each([
    () => serializeOverrideQuery({ page: 0, limit: 50 }),
    () => serializeOverrideQuery({ page: 1, limit: 101 }),
    () => serializeHistoryQuery({ limit: 201 }),
    () => serializeEffectiveQuery({ appName: "trade-app" as never }),
    () => serializeLiveQuery({ tenantId: "00000000-0000-4000-8000-000000000000" }),
  ])("rejects out-of-contract runtime query input", (serialize) => {
    expect(serialize).toThrow(TypeError);
  });

  it("fails closed on a malformed Core envelope", async () => {
    getMock.mockResolvedValue({ data: { data: [OVERRIDE_ROW] } });
    await expect(loggingApi.list({ page: 1, limit: 50 })).rejects.toThrow(
      "INVALID_LOGGING_RESPONSE",
    );
  });
});
