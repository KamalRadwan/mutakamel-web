// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { LEAD_STAGES_PATH } from "../../lead-stages/lead-stage-contract";
import { useCrmSettingsNames } from "./useCrmSettingsNames";

const state = vi.hoisted(() => ({ lang: "en" as "ar" | "en", permissions: [] as string[] }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { en, ar }[state.lang], lang: state.lang }),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: state.permissions } }),
}));

const stageId = "01900100-0000-7000-8000-000000000001";
const pipelineId = "01900100-0000-7000-8000-000000000002";
const stage = {
  id: stageId, nameAr: "جديد", nameEn: "New", flag: "NEW",
  category: "IN_PROGRESS", sortOrder: 1, isDefault: true, isActive: true,
};
const pipeline = {
  id: pipelineId, code: "SALES", nameAr: "المبيعات", nameEn: "Sales",
  isDefault: true, isActive: true, accessMode: "ALL", stages: [],
  createdAt: "2026-10-18T00:00:00.000Z", updatedAt: "2026-10-18T00:00:00.000Z",
};
function response(data: unknown) {
  return { data, status: 200, statusText: "OK", headers: new Headers() };
}

beforeEach(() => {
  state.lang = "en";
  state.permissions = ["crm.lead_stages.read", "crm.pipelines.read"];
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("settings reference labels", () => {
  it("resolves names and follows the selected language", async () => {
    vi.spyOn(axiosClient, "get")
      .mockResolvedValueOnce(response([stage]))
      .mockResolvedValueOnce(response([pipeline]));
    const { result, rerender } = renderHook(() => useCrmSettingsNames(stageId, pipelineId));
    await waitFor(() => expect(result.current).toEqual({ stageName: "New", pipelineName: "Sales" }));
    expect(axiosClient.get).toHaveBeenCalledWith(LEAD_STAGES_PATH, {
      signal: expect.any(AbortSignal), cache: "no-store", maxResponseBytes: 256 * 1024,
    });
    state.lang = "ar";
    rerender();
    expect(result.current).toEqual({ stageName: "جديد", pipelineName: "المبيعات" });
  });

  it("does not fetch inaccessible catalogues or fall back to UUIDs", async () => {
    state.permissions = [];
    const get = vi.spyOn(axiosClient, "get");
    const { result } = renderHook(() => useCrmSettingsNames(stageId, pipelineId));
    await waitFor(() => expect(result.current).toEqual({
      stageName: en.crmSettings.nameUnavailable, pipelineName: en.crmSettings.nameUnavailable,
    }));
    expect(get).not.toHaveBeenCalled();
  });

  it("keeps settings usable when catalogue responses fail validation", async () => {
    vi.spyOn(axiosClient, "get").mockResolvedValue(response([{ id: stageId }]));
    const { result } = renderHook(() => useCrmSettingsNames(null, pipelineId));
    await waitFor(() => expect(axiosClient.get).toHaveBeenCalledOnce());
    expect(result.current).toEqual({ stageName: en.crmSettings.notSet, pipelineName: en.crmSettings.nameUnavailable });
  });
});
