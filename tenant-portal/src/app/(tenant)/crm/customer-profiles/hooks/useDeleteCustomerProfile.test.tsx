// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { useDeleteCustomerProfile } from "./useDeleteCustomerProfile";

const locale = vi.hoisted(() => ({ arabic: false }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: locale.arabic ? ar : en }),
}));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { delete: vi.fn() },
}));

afterEach(() => {
  locale.arabic = false;
  vi.clearAllMocks();
});

describe("useDeleteCustomerProfile error feedback", () => {
  it.each([false, true])("translates an active-opportunity conflict (Arabic: %s)", async (arabic) => {
    locale.arabic = arabic;
    vi.mocked(axiosClient.delete).mockRejectedValue(new TenantApiClientError(
      "Internal deletion detail",
      {
        status: 409,
        statusText: "Conflict",
        headers: new Headers(),
        data: {
          errorCode: "CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES",
          message: "Internal deletion detail",
        },
      },
    ));
    const { result, rerender } = renderHook(() => useDeleteCustomerProfile());
    await act(async () => {
      expect(await result.current.deleteProfile("customer-id")).toBe(false);
    });
    expect(result.current.error).toBe(
      (arabic ? ar : en).crmShared.refusals.CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES,
    );
    expect(result.current.isDeleting).toBe(false);

    locale.arabic = !arabic;
    rerender();
    expect(result.current.error).toBe(
      (arabic ? en : ar).crmShared.refusals.CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES,
    );
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
