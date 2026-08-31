// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, getMock, patchMock, uuidMock } = vi.hoisted(() => ({
  authMock: {
    user: null as { isSuperAdmin: boolean; permissions: string[] } | null,
    isLoading: false,
  },
  getMock: vi.fn(),
  patchMock: vi.fn(),
  uuidMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, patch: patchMock },
}));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: uuidMock }));

import { useStorageRuntimeSettings } from "./useStorageRuntimeSettings";

const TIMESTAMP = "2026-08-25T03:00:00.000Z";
const COMMAND_ID = "019f0000-0000-7000-8000-000000000001";
const ENDPOINT = "/api/admin/core/v1/system-settings/storage-runtime";

function envelope(
  data: {
    enabled: boolean;
    configured: boolean;
    brokerConfigured: boolean;
    updatedAt: string | null;
  } = {
    enabled: false,
    configured: true,
    brokerConfigured: true,
    updatedAt: TIMESTAMP,
  },
) {
  return {
    data: {
      success: true,
      data,
      correlationId: "corr-storage-runtime",
      timestamp: TIMESTAMP,
    },
  };
}

describe("useStorageRuntimeSettings", () => {
  beforeEach(() => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: [
        "admin.settings.read",
        "admin.settings.update",
        "admin.settings.critical",
      ],
    };
    authMock.isLoading = false;
    getMock.mockReset().mockResolvedValue(envelope());
    patchMock.mockReset();
    uuidMock.mockReset().mockReturnValue(COMMAND_ID);
  });

  it("does not read without admin.settings.read", async () => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    const { result } = renderHook(() => useStorageRuntimeSettings());

    await waitFor(() => expect(result.current.loadState).toBe("FORBIDDEN"));
    expect(result.current.snapshot).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("enforces ALL update and critical permissions in the hook", async () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.settings.read", "admin.settings.update"],
    };
    const { result } = renderHook(() => useStorageRuntimeSettings());
    await waitFor(() => expect(result.current.loadState).toBe("READY"));

    expect(result.current.canUpdateCritical).toBe(false);
    await act(async () => {
      expect(await result.current.setEnabled(true)).toBe(false);
    });
    expect(patchMock).not.toHaveBeenCalled();
  });

  it("blocks enablement until the server reports a configured key", async () => {
    getMock.mockResolvedValue(
      envelope({
        enabled: false,
        configured: false,
        brokerConfigured: true,
        updatedAt: null,
      }),
    );
    const { result } = renderHook(() => useStorageRuntimeSettings());
    await waitFor(() => expect(result.current.loadState).toBe("READY"));

    await act(async () => {
      expect(await result.current.setEnabled(true)).toBe(false);
    });
    expect(result.current.mutation.localCode).toBe(
      "CORE.STORAGE_RUNTIME.NOT_CONFIGURED",
    );
    expect(patchMock).not.toHaveBeenCalled();
  });

  it("blocks enablement while Core reports broker authentication drift", async () => {
    getMock.mockResolvedValue(
      envelope({
        enabled: false,
        configured: true,
        brokerConfigured: false,
        updatedAt: TIMESTAMP,
      }),
    );
    const { result } = renderHook(() => useStorageRuntimeSettings());
    await waitFor(() => expect(result.current.loadState).toBe("READY"));

    await act(async () => {
      expect(await result.current.setEnabled(true)).toBe(false);
    });
    expect(result.current.mutation.localCode).toBe(
      "CORE.STORAGE.RUNTIME_AUTH_NOT_CONFIGURED",
    );
    expect(patchMock).not.toHaveBeenCalled();
  });

  it("generates or rotates only on the exact critical DTO with a UUIDv7 intent", async () => {
    patchMock.mockResolvedValue(
      envelope({
        enabled: false,
        configured: true,
        brokerConfigured: true,
        updatedAt: TIMESTAMP,
      }),
    );
    const { result } = renderHook(() => useStorageRuntimeSettings());
    await waitFor(() => expect(result.current.loadState).toBe("READY"));

    await act(async () => {
      expect(await result.current.rotateKey()).toBe(true);
    });
    expect(patchMock).toHaveBeenCalledWith(
      ENDPOINT,
      { rotateKey: true },
      { headers: { "x-idempotency-key": COMMAND_ID } },
    );
  });

  it("reuses the same idempotency key only for an ambiguous retry", async () => {
    patchMock
      .mockRejectedValueOnce({
        isNormalized: true,
        httpStatus: 503,
        errorCode: "CORE_UNAVAILABLE",
        message: "Unavailable",
      })
      .mockResolvedValueOnce(envelope());
    const { result } = renderHook(() => useStorageRuntimeSettings());
    await waitFor(() => expect(result.current.loadState).toBe("READY"));

    await act(async () => {
      expect(await result.current.setEnabled(true)).toBe(false);
    });
    await act(async () => {
      expect(await result.current.setEnabled(true)).toBe(true);
    });

    expect(patchMock).toHaveBeenCalledTimes(2);
    expect(patchMock.mock.calls[0].slice(0, 2)).toEqual([
      ENDPOINT,
      { enabled: true },
    ]);
    expect(patchMock.mock.calls[0][2]).toEqual(
      patchMock.mock.calls[1][2],
    );
    expect(uuidMock).toHaveBeenCalledTimes(1);
  });
});
