// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  listMock,
  historyMock,
  effectiveMock,
  upsertMock,
  removeMock,
  uuidMock,
} = vi.hoisted(() => ({
  authMock: {
    user: {
      id: "019f1000-0000-7000-8000-000000000099",
      isSuperAdmin: false,
      permissions: [
        "admin.logging.read",
        "admin.logging.update",
        "admin.logging.critical",
      ],
    } as { id: string; isSuperAdmin: boolean; permissions: string[] } | null,
    isLoading: false,
  },
  listMock: vi.fn(),
  historyMock: vi.fn(),
  effectiveMock: vi.fn(),
  upsertMock: vi.fn(),
  removeMock: vi.fn(),
  uuidMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: uuidMock }));
vi.mock("./api", () => ({
  loggingApi: {
    list: listMock,
    history: historyMock,
    effective: effectiveMock,
    upsert: upsertMock,
    remove: removeMock,
  },
}));

import { readLoggingOverride } from "./readers";
import {
  CORRELATION_ID,
  HISTORY_ROW,
  IDEMPOTENCY_KEY,
  OVERRIDE_ROW,
  TENANT_ID,
  envelope,
} from "./test-fixtures";
import { isoToLocalDateTime } from "./validation";
import { useLoggingConsole } from "./useLoggingConsole";

const OVERRIDE_RESULT = {
  data: [readLoggingOverride(envelope(OVERRIDE_ROW)).data],
  correlationId: CORRELATION_ID,
  timestamp: "2026-08-12T12:31:00.000Z",
};
const HISTORY_RESULT = {
  data: [HISTORY_ROW],
  correlationId: CORRELATION_ID,
  timestamp: "2026-08-12T12:31:00.000Z",
};

describe("useLoggingConsole", () => {
  beforeEach(() => {
    authMock.user = {
      id: "019f1000-0000-7000-8000-000000000099",
      isSuperAdmin: false,
      permissions: [
        "admin.logging.read",
        "admin.logging.update",
        "admin.logging.critical",
      ],
    };
    authMock.isLoading = false;
    listMock.mockReset().mockResolvedValue(OVERRIDE_RESULT);
    historyMock.mockReset().mockResolvedValue(HISTORY_RESULT);
    effectiveMock.mockReset().mockResolvedValue({
      data: { level: "debug", source: "TENANT_APP" },
      correlationId: CORRELATION_ID,
      timestamp: "2026-08-12T12:31:00.000Z",
    });
    upsertMock.mockReset().mockResolvedValue({
      data: OVERRIDE_RESULT.data[0],
      correlationId: CORRELATION_ID,
      timestamp: "2026-08-12T12:31:00.000Z",
    });
    removeMock.mockReset().mockResolvedValue(CORRELATION_ID);
    uuidMock.mockReset().mockReturnValue(IDEMPOTENCY_KEY);
  });

  it("preloads the exact bounded directory and history reads", async () => {
    const { result } = renderHook(() => useLoggingConsole());
    await waitFor(() => expect(result.current.directory.state).toBe("READY"));
    await waitFor(() => expect(result.current.history.state).toBe("READY"));

    expect(listMock).toHaveBeenCalledWith(
      { page: 1, limit: 50, includeExpired: false },
      expect.any(AbortSignal),
    );
    expect(historyMock).toHaveBeenCalledWith(
      { limit: 50 },
      expect.any(AbortSignal),
    );
    expect(result.current.effective.state).toBe("EMPTY");
  });

  it("does not fetch or expose data without admin.logging.read", () => {
    authMock.user = {
      id: "019f1000-0000-7000-8000-000000000099",
      isSuperAdmin: false,
      permissions: [],
    };
    const { result } = renderHook(() => useLoggingConsole());

    expect(result.current.directory.state).toBe("FORBIDDEN");
    expect(result.current.directory.data).toBeNull();
    expect(result.current.history.data).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
    expect(historyMock).not.toHaveBeenCalled();
  });

  it("applies exact directory filters and resolves effective policy", async () => {
    const { result } = renderHook(() => useLoggingConsole());
    await waitFor(() => expect(result.current.directory.state).toBe("READY"));
    listMock.mockClear();

    act(() => {
      result.current.setDirectoryDraftField("scope", "TENANT_APP");
      result.current.setDirectoryDraftField("appName", "crm-app");
      result.current.setDirectoryDraftField("tenantId", TENANT_ID);
      result.current.setDirectoryDraftField("includeExpired", true);
    });
    act(() => expect(result.current.applyDirectoryFilters()).toBe(true));
    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(
        {
          page: 1,
          limit: 50,
          scope: "TENANT_APP",
          appName: "crm-app",
          tenantId: TENANT_ID,
          includeExpired: true,
        },
        expect.any(AbortSignal),
      ),
    );

    act(() => {
      result.current.setEffectiveDraftField("appName", "crm-app");
      result.current.setEffectiveDraftField("tenantId", TENANT_ID);
    });
    await act(async () => {
      expect(await result.current.resolveEffective()).toBe(true);
    });
    expect(effectiveMock).toHaveBeenCalledWith({
      appName: "crm-app",
      tenantId: TENANT_ID,
    });
    expect(result.current.effective.data).toEqual({
      level: "debug",
      source: "TENANT_APP",
    });
  });

  it("reuses one UUIDv7 when retrying an ambiguous PUT intent", async () => {
    upsertMock
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce({
        data: OVERRIDE_RESULT.data[0],
        correlationId: CORRELATION_ID,
        timestamp: "2026-08-12T12:31:00.000Z",
      });
    const { result } = renderHook(() => useLoggingConsole());
    await waitFor(() => expect(result.current.directory.state).toBe("READY"));
    const expiry = isoToLocalDateTime(
      new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
    );
    act(() => {
      result.current.setOverrideDraftField("scope", "TENANT_APP");
      result.current.setOverrideDraftField("appName", "crm-app");
      result.current.setOverrideDraftField("tenantId", TENANT_ID);
      result.current.setOverrideDraftField("reason", "Investigate CRM latency");
      result.current.setOverrideDraftField("expiresAtLocal", expiry);
    });
    act(() => expect(result.current.requestUpsert()).toBe(true));
    act(() => result.current.confirmMutation());
    await waitFor(() => expect(result.current.mutationState).toBe("STALE"));

    act(() => result.current.retryExactMutation());
    await waitFor(() => expect(result.current.mutationState).toBe("SUCCESS"));
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock.mock.calls[0][1]).toBe(IDEMPOTENCY_KEY);
    expect(upsertMock.mock.calls[1][1]).toBe(IDEMPOTENCY_KEY);
    expect(uuidMock).toHaveBeenCalledOnce();
  });

  it("reaches the confirmed DELETE route with a stable explicit key", async () => {
    const { result } = renderHook(() => useLoggingConsole());
    await waitFor(() => expect(result.current.directory.state).toBe("READY"));
    const row = result.current.directory.data![0];

    act(() => expect(result.current.requestDelete(row)).toBe(true));
    expect(result.current.mutationState).toBe("CONFIRMING_DELETE");
    act(() => result.current.confirmMutation());
    await waitFor(() => expect(result.current.mutationState).toBe("SUCCESS"));

    expect(removeMock).toHaveBeenCalledWith(row.id, IDEMPOTENCY_KEY);
    expect(result.current.mutationCorrelationId).toBe(CORRELATION_ID);
  });

  it("preserves last-known directory rows in an explicit stale state", async () => {
    const { result } = renderHook(() => useLoggingConsole());
    await waitFor(() => expect(result.current.directory.state).toBe("READY"));
    listMock.mockRejectedValue(new TypeError("offline"));

    act(() => result.current.refreshDirectory());
    await waitFor(() => expect(result.current.directory.state).toBe("STALE"));
    expect(result.current.directory.data?.[0].id).toBe(OVERRIDE_ROW.id);
  });
});
