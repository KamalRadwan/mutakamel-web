// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useCustomFieldsPage } from "./useCustomFieldsPage";

const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), success: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (original) => {
  const actual = await original<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get: state.get, post: state.post } };
});
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: {
  permissions: ["crm.custom_fields.manage"], accessibleBranches: [], teamMemberships: [],
} }) }));
vi.mock("@/design-system", () => ({ useToast: () => ({ success: state.success }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const existing = {
  id: "0191e9a8-7f51-7b32-8d72-19f9217a41b3", ownerType: "LEAD", fieldKey: "existing",
  nameAr: "الحقل", nameEn: "Field", type: "TEXT", options: [], isActive: true, isSearchable: false, sortOrder: 1,
};
const input = { ownerType: "LEAD", fieldKey: "new_field", nameAr: "جديد", nameEn: "New", type: "TEXT", isSearchable: false } as const;

it("keeps catalogue mutations fenced after an unknown create and failed read, across modal reopening", async () => {
  state.get.mockResolvedValueOnce({ data: [existing] });
  state.post.mockRejectedValue(new TypeError("Lost response"));
  const { result } = renderHook(() => useCustomFieldsPage());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  act(() => result.current.openCreate());
  expect(result.current.isCreateOpen).toBe(true);
  state.get.mockRejectedValueOnce(new TypeError("Read unavailable"));
  await act(async () => { await result.current.create(input); });
  expect(result.current.needsReload).toBe(true);
  expect(result.current.error?.status).toBe(0);
  expect(result.current.canCreate).toBe(false);
  expect(result.current.createError).toBe(en.crmCustomFields.ambiguousCreateStale);
  const field = result.current.definitions[0];
  act(() => {
    result.current.closeCreate();
    result.current.openCreate();
    result.current.editor.select(field);
    result.current.requirements.select(field);
  });
  expect(result.current.isCreateOpen).toBe(false);
  expect(result.current.editor.selected).toBeNull();
  expect(result.current.requirements.field).toBeNull();
  await act(async () => { await result.current.create(input); });
  expect(state.post).toHaveBeenCalledOnce();
  expect(state.success).not.toHaveBeenCalled();

  state.get.mockResolvedValueOnce({ data: [existing] });
  await act(async () => { await result.current.reload(); });
  expect(result.current.needsReload).toBe(false);
  expect(result.current.canCreate).toBe(true);
  expect(result.current.createError).toBe(en.crmCustomFields.ambiguousCreateRefreshed);
  act(() => result.current.openCreate());
  expect(result.current.isCreateOpen).toBe(true);
  expect(state.post).toHaveBeenCalledOnce();
});
