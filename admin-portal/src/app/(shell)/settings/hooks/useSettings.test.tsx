// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, i18nMock, getMock, putMock, toastMock } = vi.hoisted(() => ({
  i18nMock: { lang: "en" as "en" | "ar" },
  authMock: {
    user: null as { isSuperAdmin: boolean; permissions: string[] } | null,
    isLoading: false,
  },
  getMock: vi.fn(),
  putMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => i18nMock }));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, put: putMock },
  getApiRequestOutcome: (error: { requestOutcome?: string }) =>
    error?.requestOutcome,
}));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toastMock }));

import {
  localSettingsError,
  orderSettingsWrites,
  useSettings,
  validateTopUpRange,
} from "./useSettings";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";

const TIMESTAMP = "2026-08-12T08:00:00.000Z";

function setting(key: string, value: string | number | boolean) {
  return {
    key,
    value,
    description: key,
    descriptionI18n: { en: key, ar: key },
    isDefault: true,
    readOnly: false,
  };
}

function envelope<T>(data: T) {
  return {
    data: {
      success: true,
      data,
      correlationId: "corr-settings",
      timestamp: TIMESTAMP,
    },
  };
}

describe("useSettings", () => {
  beforeEach(() => {
    i18nMock.lang = "en";
    authMock.user = {
      isSuperAdmin: false,
      permissions: [
        "admin.settings.read",
        "admin.settings.update",
        "admin.settings.critical",
      ],
    };
    authMock.isLoading = false;
    getMock.mockReset();
    putMock.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  describe.each(["en", "ar"] as const)("%s save errors", (lang) => {
    it.each([
      [422, "SETTING_VALUE_INVALID", "SETTING_VALUE_INVALID"],
      [409, "SETTING_READ_ONLY", "SETTING_READ_ONLY"],
      [422, "SETTING_TOPUP_RANGE_INVALID", "SETTING_TOPUP_RANGE_INVALID"],
      [403, "GW.AUTHZ.FORBIDDEN", "FORBIDDEN"],
      [429, "GW.RATE_LIMIT.EXCEEDED", "TOO_MANY_REQUESTS"],
      [409, "GW.IDEM.IN_FLIGHT", "GW.IDEM.IN_FLIGHT"],
      [500, "UNRECOGNIZED_SETTINGS_FAILURE", null],
    ] as const)("localizes HTTP %s %s in field and toast", async (
      httpStatus,
      errorCode,
      messageKey,
    ) => {
      i18nMock.lang = lang;
      getMock.mockResolvedValue(envelope([setting("billing.min_topup_usd", 10)]));
      putMock.mockRejectedValue({
        response: {
          status: httpStatus,
          data: errorCode.startsWith("GW.")
            ? {
                code: errorCode,
                title: "Raw gateway detail",
                correlationId: "corr-save",
              }
            : {
                success: false,
                errorCode,
                message: "Raw backend detail",
                correlationId: "corr-save",
              },
        },
      });
      const { result } = renderHook(() => useSettings("billing."));
      await waitFor(() => expect(result.current.loadState).toBe("READY"));
      act(() => result.current.updateSetting("billing.min_topup_usd", 12));
      await act(async () => {
        await expect(result.current.saveAllSettings()).rejects.toThrow(
          "SETTINGS_SAVE_FAILED",
        );
      });

      const copy = (lang === "ar" ? ar : en).settings;
      const message = messageKey
        ? copy.validation.serverErrors[messageKey]
        : copy.validation.saveFailedGeneric("corr-save");
      expect(result.current.settings[0].error).toBe(message);
      expect(message).not.toContain(errorCode);
      expect(message).not.toContain("Raw");
      expect(toastMock.error).toHaveBeenCalledWith(
        copy.save.failedTitle,
        `billing.min_topup_usd: ${message}`,
      );
      if (!messageKey) expect(message).toContain("corr-save");
      expect(result.current.hasUnsavedChanges).toBe(true);
    });
  });

  it("fails closed before list and save calls without the exact permissions", async () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.settings.update"],
    };
    const { result } = renderHook(() => useSettings("billing."));
    await waitFor(() => expect(result.current.loadState).toBe("FORBIDDEN"));
    expect(getMock).not.toHaveBeenCalled();
    expect(() => result.current.updateSetting("billing.min_topup_usd", 2)).toThrow(
      "SETTINGS_CRITICAL_PERMISSION_REQUIRED",
    );
    await expect(result.current.saveAllSettings()).rejects.toThrow(
      "SETTINGS_CRITICAL_PERMISSION_REQUIRED",
    );
    expect(putMock).not.toHaveBeenCalled();
  });

  it("requires update plus critical and rejects an invalid top-up edit without committing it", async () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.settings.read", "admin.settings.update"],
    };
    getMock.mockResolvedValue(
      envelope([
        setting("billing.min_topup_usd", 10),
        setting("billing.max_topup_usd", 20),
      ]),
    );
    const { result, rerender } = renderHook(() => useSettings("billing."));
    await waitFor(() => expect(result.current.loadState).toBe("READY"));
    expect(result.current.canUpdateCritical).toBe(false);
    expect(result.current.settings.every((item) => item.readOnly)).toBe(true);

    authMock.user = {
      isSuperAdmin: false,
      permissions: [
        "admin.settings.read",
        "admin.settings.update",
        "admin.settings.critical",
      ],
    };
    rerender();
    await waitFor(() => expect(result.current.canUpdateCritical).toBe(true));
    expect(() =>
      result.current.updateSetting("billing.min_topup_usd", 21),
    ).toThrow("Minimum cannot be greater than the maximum (20).");
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.settings[0].value).toBe(10);
  });

  it("rejects out-of-range and fractional notification retention before a write", async () => {
    getMock.mockResolvedValue(
      envelope([setting("notifications.retention_days", 180)]),
    );
    const { result } = renderHook(() => useSettings("notifications."));
    await waitFor(() => expect(result.current.loadState).toBe("READY"));

    for (const value of [0, 3651, 1.5]) {
      expect(() =>
        result.current.updateSetting("notifications.retention_days", value),
      ).toThrow();
    }
    expect(result.current.settings[0].value).toBe(180);
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(putMock).not.toHaveBeenCalled();

    for (const value of [1, 3650]) {
      act(() => result.current.updateSetting("notifications.retention_days", value));
      expect(result.current.settings[0].value).toBe(value);
    }
  });

  it("uses the exact direct GET by key for an explicit authoritative reload", async () => {
    getMock
      .mockResolvedValueOnce(envelope([setting("billing.min_topup_usd", 10)]))
      .mockResolvedValueOnce(envelope(setting("billing.min_topup_usd", 12)));
    const { result } = renderHook(() => useSettings("billing."));
    await waitFor(() => expect(result.current.loadState).toBe("READY"));
    await act(async () => {
      await result.current.reloadSetting("billing.min_topup_usd");
    });
    expect(getMock.mock.calls[1][0]).toBe(
      "/api/admin/core/v1/system-settings/billing.min_topup_usd",
    );
    expect(result.current.settings[0].value).toBe(12);
  });

  it("retains one caller-owned UUIDv7 for an ambiguous exact-value retry", async () => {
    getMock.mockResolvedValue(
      envelope([setting("billing.min_topup_usd", 10)]),
    );
    putMock
      .mockRejectedValueOnce({
        isNormalized: true,
        httpStatus: 503,
        errorCode: "CORE_UNAVAILABLE",
        message: "temporary outage",
        correlationId: "corr-ambiguous",
      })
      .mockResolvedValueOnce(envelope(setting("billing.min_topup_usd", 12)));
    const { result } = renderHook(() => useSettings("billing."));
    await waitFor(() => expect(result.current.loadState).toBe("READY"));

    act(() => result.current.updateSetting("billing.min_topup_usd", 12));
    await act(async () => {
      await expect(result.current.saveAllSettings()).rejects.toThrow(
        "SETTINGS_SAVE_FAILED",
      );
    });
    expect(() =>
      result.current.updateSetting("billing.min_topup_usd", 13),
    ).toThrow("PENDING_SETTING_WRITE_MUST_BE_RECONCILED");

    const firstConfig = putMock.mock.calls[0][2];
    expect(firstConfig).toMatchObject({
      skipAutoIdempotency: true,
      replayAfterRefresh: true,
      cache: "no-store",
    });
    expect(firstConfig.headers["x-idempotency-key"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.current.settings[0].ambiguous).toBe(true);
    expect(result.current.settings[0].idempotencyKey).toBe(
      firstConfig.headers["x-idempotency-key"],
    );
    expect(result.current.settings[0].correlationId).toBe("corr-ambiguous");

    await act(async () => {
      await result.current.saveAllSettings();
    });
    expect(putMock.mock.calls[1][2].headers["x-idempotency-key"]).toBe(
      firstConfig.headers["x-idempotency-key"],
    );
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.settings[0].ambiguous).toBeFalsy();
    expect(result.current.settings[0].idempotencyKey).toBeUndefined();
    expect(result.current.settings[0].correlationId).toBeUndefined();
  });

  it("renders unavailable state rather than an empty list and supports retry", async () => {
    getMock
      .mockRejectedValueOnce({
        isNormalized: true,
        httpStatus: 503,
        errorCode: "CORE_UNAVAILABLE",
        message: "raw upstream detail",
        correlationId: "corr-down",
      })
      .mockResolvedValueOnce(envelope([setting("billing.min_topup_usd", 10)]));
    const { result } = renderHook(() => useSettings("billing."));
    await waitFor(() => expect(result.current.loadState).toBe("UNAVAILABLE"));
    expect(result.current.settings).toEqual([]);
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.loadState).toBe("READY");
    expect(result.current.settings).toHaveLength(1);
  });
});

describe.each(["en", "ar"] as const)("%s settings error messages", (lang) => {
  const copy = (lang === "ar" ? ar : en).settings.validation;

  it.each(Object.entries(copy.serverErrors))(
    "maps %s without exposing the code",
    (code, message) => {
      expect(localSettingsError(lang, code)).toBe(message);
      expect(message).not.toContain(code);
    },
  );

  it("uses a generic fallback without a code, with an optional support reference", () => {
    expect(localSettingsError(lang, "UNKNOWN_CODE")).toBe(copy.saveFailedGeneric());
    expect(localSettingsError(lang, "UNKNOWN_CODE", 500, "corr-unknown")).toBe(
      copy.saveFailedGeneric("corr-unknown"),
    );
    expect(localSettingsError(lang, "toString")).toBe(copy.saveFailedGeneric());
  });

  it("preserves the local recovery messages", () => {
    expect(localSettingsError(lang, "PENDING_SETTING_WRITE_MUST_BE_RECONCILED")).toBe(
      copy.unresolvedWrite,
    );
    expect(localSettingsError(lang, "DEPENDENT_TOP_UP_WRITE_SKIPPED")).toBe(
      copy.dependentTopUpSkipped,
    );
  });
});

describe("top-up save-boundary invariants", () => {
  it("revalidates min <= max and orders dual writes without an invalid intermediate range", () => {
    expect(() =>
      validateTopUpRange(
        {
          "billing.min_topup_usd": 300,
          "billing.max_topup_usd": 200,
        },
        "en",
      ),
    ).toThrow("Minimum cannot be greater than the maximum (200).");
    expect(
      orderSettingsWrites(
        ["billing.min_topup_usd", "billing.max_topup_usd"],
        {
          "billing.min_topup_usd": 100,
          "billing.max_topup_usd": 200,
        },
        {
          "billing.min_topup_usd": 300,
          "billing.max_topup_usd": 400,
        },
      ),
    ).toEqual(["billing.max_topup_usd", "billing.min_topup_usd"]);
    expect(
      orderSettingsWrites(
        ["billing.max_topup_usd", "billing.min_topup_usd"],
        {
          "billing.min_topup_usd": 100,
          "billing.max_topup_usd": 200,
        },
        {
          "billing.min_topup_usd": 10,
          "billing.max_topup_usd": 20,
        },
      ),
    ).toEqual(["billing.min_topup_usd", "billing.max_topup_usd"]);
  });
});
