// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { parseAcquisitionSourceResponse } from "../acquisition-source-contract";
import { useAcquisitionSourceEdit } from "./useAcquisitionSourceEdit";

const state = vi.hoisted(() => ({ lang: "en" as "ar" | "en" }));
const { patch } = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, patch } };
});
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { ar, en }[state.lang] }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); state.lang = "en"; });

const source = parseAcquisitionSourceResponse({
  id: "01902001-3000-7000-8000-000000000001", nameAr: "الموقع", nameEn: "Website", isActive: true,
  sortOrder: 1, createdAt: "2026-08-25T10:00:00.000Z", updatedAt: "2026-08-25T10:00:00.000Z", iconUrl: null,
});

describe("acquisition-source edit", () => {
  it.each(["ar", "en"] as const)("renders a localized conflict in %s without backend prose", async (lang) => {
    state.lang = lang;
    patch.mockRejectedValue(new TenantApiClientError("Internal backend prose", {
      status: 409, statusText: "Conflict", headers: new Headers(),
      data: { message: "Internal backend prose" },
    }));
    const reload = vi.fn();
    function Editor() {
      const edit = useAcquisitionSourceEdit(true, vi.fn(), reload);
      return createElement("div", null,
        createElement("button", { onClick: () => edit.select(source) }, "Select"),
        createElement("button", { onClick: () => void edit.save() }, "Save"),
        edit.error && createElement("p", { role: "alert" }, edit.error),
      );
    }
    render(createElement(Editor));
    fireEvent.click(screen.getByText("Select"));
    fireEvent.click(screen.getByText("Save"));
    expect((await screen.findByRole("alert")).textContent).toBe({ ar, en }[lang].crmShared.errorConflict);
    expect(screen.queryByText("Internal backend prose")).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("renames and deactivates through the canonical non-replayable PATCH", async () => {
    const onSaved = vi.fn();
    const changed = { ...source, nameEn: "Web", isActive: false };
    patch.mockResolvedValue({ data: changed });
    const { result } = renderHook(() => useAcquisitionSourceEdit(true, onSaved, vi.fn()));
    act(() => result.current.select(source));
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.setDraft({ nameAr: " الموقع ", nameEn: " Web ", isActive: false }));
    expect(result.current.isDirty).toBe(true);
    await act(async () => result.current.save());
    expect(patch).toHaveBeenCalledWith(`/api/tenant/crm/v1/acquisition-sources/${source.id}`,
      { nameAr: "الموقع", nameEn: "Web", isActive: false },
      expect.objectContaining({ nonReplayable: true, skipAutoIdempotency: true }));
    expect(onSaved).toHaveBeenCalledWith(changed);
    expect(result.current.selected).toBeNull();
  });

  it("requires manage permission and validates names before sending", async () => {
    const { result, rerender } = renderHook(({ allowed }) => useAcquisitionSourceEdit(allowed, vi.fn(), vi.fn()), { initialProps: { allowed: false } });
    act(() => result.current.select(source));
    expect(result.current.selected).toBeNull();
    rerender({ allowed: true });
    act(() => result.current.select(source));
    act(() => result.current.setDraft({ nameAr: " ", nameEn: "x".repeat(121), isActive: false }));
    await act(async () => result.current.save());
    expect(patch).not.toHaveBeenCalled();
    expect(result.current.namesError).toBe(en.crmAcquisitionSources.invalidNames);
    rerender({ allowed: false });
    await act(async () => result.current.save());
    expect(patch).not.toHaveBeenCalled();
    expect(result.current.error).toBe(en.crmAcquisitionSources.iconForbidden);
  });

  it("refreshes a malformed response instead of applying or replaying it", async () => {
    const onSaved = vi.fn();
    const reload = vi.fn().mockResolvedValue(true);
    patch.mockResolvedValue({ data: { data: source } });
    const { result } = renderHook(() => useAcquisitionSourceEdit(true, onSaved, reload));
    act(() => result.current.select(source));
    await act(async () => result.current.save());
    expect(patch).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
    expect(result.current.selected).toBeNull();
    expect(result.current.error).toBe(en.crmAcquisitionSources.editUncertain);
  });
});
