// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { ar } from "@/i18n/dictionaries/ar";
import { useCrmSettings } from "./useCrmSettings";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: ar, lang: "ar" }) }));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: ["crm.settings.read"] } }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CRM settings read errors", () => {
  it.each([403, 500])("preserves status %s and clears it after recovery", async (status) => {
    const get = vi.spyOn(axiosClient, "get").mockRejectedValueOnce(
      new TenantApiClientError("Read failed", {
        status, statusText: "Failure", headers: new Headers(),
        data: { code: "FORBIDDEN" },
      }),
    );
    const { result } = renderHook(() => useCrmSettings());
    await waitFor(() => expect(result.current.queryError?.status).toBe(status));
    expect(result.current.settings).toBeNull();
    expect(result.current.error).toBe(status === 403 ? ar.crmShared.errorForbidden : ar.crmShared.errorGeneric);
    expect(result.current.queryError).not.toHaveProperty("message");
    get.mockResolvedValueOnce({ status: 200, statusText: "OK", headers: new Headers(), data: {
      id: "01900100-0000-7000-8000-000000000001",
      requireQualifiedStageForConversion: false,
      defaultLeadStageId: null,
      defaultPipelineId: "01900100-0000-7000-8000-000000000002",
      outboundEmailContentRetentionDays: 730,
      outboundEmailRetentionPolicyRevision: 1,
    } });
    await act(async () => { await result.current.fetchSettings(); });
    expect(result.current.queryError).toBeNull();
    expect(result.current.settings).not.toBeNull();
  });
});
