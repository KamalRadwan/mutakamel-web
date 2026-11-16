// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { parseCrmCustomField } from "../custom-field-contract";
import { useCustomFieldEdit } from "./useCustomFieldEdit";

const { patch } = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, patch } };
});
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const field = parseCrmCustomField({
  id: "0191e9a8-7f51-7b32-8d72-19f9217a41b3", ownerType: "LEAD", fieldKey: "channel",
  nameAr: "القناة", nameEn: "Channel", type: "TEXT", options: [], isActive: true,
  isSearchable: false, sortOrder: 1, requirements: [{ operation: "CREATE", isRequired: true }],
});
const input = { nameAr: " القناة ", nameEn: " Acquisition channel ", isActive: false, isSearchable: true };
const failure = (status: number, code = "SAVE_FAILED") => new TenantApiClientError("Rejected", {
  status, statusText: "Error", headers: new Headers(), data: { code },
});

describe("custom-field edit transport", () => {
  it.each(["success", "failure"])("does not apply a stale edit %s after the workspace unmounts", async (outcome) => {
    let finish!: (value: { data: typeof field }) => void;
    let fail!: (error: Error) => void;
    patch.mockReturnValue(new Promise<{ data: typeof field }>((resolve, reject) => { finish = resolve; fail = reject; }));
    const onSaved = vi.fn();
    const reload = vi.fn().mockResolvedValue(true);
    const { result, unmount } = renderHook(() => useCustomFieldEdit(true, onSaved, reload));
    act(() => result.current.select(field));
    let saving!: Promise<boolean>;
    act(() => { saving = result.current.save(input); });
    unmount();
    await act(async () => {
      if (outcome === "success") finish({ data: field });
      else fail(failure(503));
      expect(await saving).toBe(false);
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("returns an unconfirmed edit result when unmounted during its reconciliation", async () => {
    let finish!: (value: boolean) => void;
    const reload = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const onSaved = vi.fn();
    patch.mockRejectedValue(failure(503));
    const { result, unmount } = renderHook(() => useCustomFieldEdit(true, onSaved, reload));
    act(() => result.current.select(field));
    let saving!: Promise<boolean>;
    await act(async () => { saving = result.current.save(input); });
    expect(reload).toHaveBeenCalledOnce();
    unmount();
    await act(async () => { finish(true); expect(await saving).toBe(false); });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("PATCHes names, active and searchable flags and retains requirements missing from PATCH", async () => {
    const onSaved = vi.fn();
    patch.mockResolvedValue({ data: { ...field, ...input, nameAr: "القناة", nameEn: "Acquisition channel", requirements: undefined } });
    const { result } = renderHook(() => useCustomFieldEdit(true, onSaved, vi.fn().mockResolvedValue(true)));
    act(() => result.current.select(field));
    await act(async () => { await result.current.save(input); });
    expect(patch).toHaveBeenCalledWith(`/api/tenant/crm/v1/custom-fields/${field.id}`,
      { ...input, nameAr: "القناة", nameEn: "Acquisition channel" },
      expect.objectContaining({ nonReplayable: true, skipAutoIdempotency: true }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ isActive: false, requirements: field.requirements }));
    expect(result.current.selected).toBeNull();
  });

  it("requires manage permission at opening and saving", async () => {
    const { result, rerender } = renderHook(({ allowed }) => useCustomFieldEdit(allowed, vi.fn(), vi.fn()), { initialProps: { allowed: false } });
    act(() => result.current.select(field));
    expect(result.current.selected).toBeNull();
    rerender({ allowed: true });
    act(() => result.current.select(field));
    rerender({ allowed: false });
    await act(async () => { await result.current.save(input); });
    expect(patch).not.toHaveBeenCalled();
    expect(result.current.error).toBe(en.crmCustomFields.editForbidden);
  });

  it("keeps a conflict draft open and explains options in use", async () => {
    patch.mockRejectedValue(failure(409, "CUSTOM_FIELD_OPTION_IN_USE"));
    const { result } = renderHook(() => useCustomFieldEdit(true, vi.fn(), vi.fn()));
    act(() => result.current.select(field));
    await act(async () => { await result.current.save(input); });
    expect(result.current.selected?.id).toBe(field.id);
    expect(result.current.error).toBe(en.crmCustomFields.optionInUse);
    expect(result.current.optionConflict).toBe(true);
    act(() => result.current.clearOptionConflict());
    expect(result.current.error).toBeNull();
    expect(result.current.optionConflict).toBe(false);
    expect(result.current.selected?.id).toBe(field.id);
  });

  it.each([true, false])("refreshes an uncertain save without replay (refresh=%s)", async (refreshed) => {
    const reload = vi.fn().mockResolvedValue(refreshed);
    patch.mockRejectedValue(failure(503));
    const { result } = renderHook(() => useCustomFieldEdit(true, vi.fn(), reload));
    act(() => result.current.select(field));
    await act(async () => { await result.current.save(input); });
    expect(patch).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(result.current.selected).toBeNull();
    expect(result.current.error).toBe(refreshed ? en.crmCustomFields.editUncertain : en.crmCustomFields.editUncertainStale);
  });
});
