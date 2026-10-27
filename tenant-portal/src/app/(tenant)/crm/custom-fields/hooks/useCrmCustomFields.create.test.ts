// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useCrmCustomFields } from "./useCrmCustomFields";
import { useCustomFieldForm } from "./useCustomFieldForm";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get, post } };
});
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: ["crm.custom_fields.manage"] } }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("picklist creation", () => {
  it.each(["SELECT", "MULTI_SELECT"] as const)("POSTs %s options and renders the confirmed definition", async (type) => {
    const option = { key: "web", nameAr: "الموقع", nameEn: "Website", sortOrder: 1, isActive: true };
    get.mockResolvedValue({ data: [] });
    post.mockResolvedValue({ data: {
      id: "0191e9a8-7f51-7b32-8d72-19f9217a41b3", ownerType: "LEAD", fieldKey: "channel",
      nameAr: "القناة", nameEn: "Channel", type, options: [option], isActive: true, isSearchable: false, sortOrder: 1,
    } });
    const { result } = renderHook(() => ({ catalogue: useCrmCustomFields(), form: useCustomFieldForm() }));
    await waitFor(() => expect(result.current.catalogue.isLoading).toBe(false));
    act(() => {
      result.current.catalogue.openCreate();
      result.current.form.setNameAr("القناة"); result.current.form.setNameEn("Channel");
      result.current.form.setFieldKey("channel"); result.current.form.setType(type);
      result.current.form.addOption();
    });
    act(() => result.current.form.updateOption(result.current.form.options[0].rowId, option));
    await act(async () => result.current.form.submitCreate(result.current.catalogue.handleCreate, result.current.catalogue.closeCreate));
    expect(post).toHaveBeenCalledWith("/api/tenant/crm/v1/custom-fields", {
      ownerType: "LEAD", fieldKey: "channel", nameAr: "القناة", nameEn: "Channel", type, isSearchable: false, options: [option],
    }, expect.objectContaining({ nonReplayable: true, skipAutoIdempotency: true }));
    expect(result.current.catalogue.items[0]).toMatchObject({ type, options: [option], optionsCount: 1 });
    expect(result.current.catalogue.isCreateOpen).toBe(false);
  });
});
