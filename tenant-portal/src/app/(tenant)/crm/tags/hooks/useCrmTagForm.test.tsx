// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";

const { api, saved, reloadNeeded } = vi.hoisted(() => ({
  api: { post: vi.fn(), patch: vi.fn() }, saved: vi.fn(), reloadNeeded: vi.fn(),
}));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: api,
  TenantApiClientError: class extends Error {
    constructor(message: string, public response: { status: number; data: Record<string, unknown> }) { super(message); }
  },
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));

import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useCrmTagForm, type UseCrmTagFormOptions } from "./useCrmTagForm";

const TAG = {
  id: "01900100-0000-7000-8000-000000000001", name: "VIP",
  backgroundColor: "#DBEAFE", textColor: "#1E40AF",
  createdAt: "2026-11-03T10:00:00Z", updatedAt: "2026-11-03T10:00:00Z",
};
function form(overrides: Partial<UseCrmTagFormOptions> = {}) {
  return renderHook(() => useCrmTagForm({
    target: { mode: "create" }, existingTags: [], canWrite: true,
    onSaved: saved, onReloadNeeded: reloadNeeded, ...overrides,
  }));
}
beforeEach(() => { vi.clearAllMocks(); api.post.mockResolvedValue({ data: TAG }); api.patch.mockResolvedValue({ data: TAG }); });
afterEach(cleanup);

describe("Tags form contract and pending fence", () => {
  it("accepts exactly 60 Unicode code points, including astral characters", async () => {
    const { result } = form();
    const name = "😀".repeat(60);
    api.post.mockResolvedValue({ data: { ...TAG, name } });
    act(() => result.current.handleNameChange(` ${name} `));
    expect(result.current.charCount).toBe(60);
    act(() => result.current.submit());
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith("/api/tenant/crm/v1/tags", { name },
      expect.objectContaining({ nonReplayable: true, skipAutoIdempotency: true }));
  });

  it("rejects 61 code points and case/whitespace-equivalent duplicates before sending", () => {
    const { result } = form({ existingTags: [TAG] });
    act(() => result.current.handleNameChange("😀".repeat(61)));
    act(() => result.current.submit());
    expect(result.current.nameError).toBe("Use at most 60 characters.");
    act(() => result.current.handleNameChange("  vip  "));
    act(() => result.current.submit());
    expect(result.current.nameError).toBe(en.crmTags.errors.nameTaken);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("records a server name conflict inline and keeps entered fields", async () => {
    api.post.mockRejectedValue(new TenantApiClientError("conflict", {
      status: 409, statusText: "Conflict", headers: new Headers(), data: { errorCode: "CRM_TAG_NAME_TAKEN" },
    }));
    const { result } = form();
    act(() => result.current.handleNameChange("Strategic account"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.nameError).toBe(en.crmTags.errors.nameTaken));
    expect(result.current.name).toBe("Strategic account");
    expect(saved).not.toHaveBeenCalled();
  });

  it("sends color channels together and clears them together on edit", async () => {
    const { result } = form({ target: { mode: "edit", tag: TAG }, existingTags: [TAG] });
    act(() => result.current.handleColorChange(null));
    act(() => result.current.submit());
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(api.patch).toHaveBeenCalledWith(`/api/tenant/crm/v1/tags/${TAG.id}`,
      { backgroundColor: null, textColor: null }, expect.any(Object));
  });

  it("blocks a visible invalid color draft synchronously until corrected", async () => {
    const { result } = form();
    act(() => result.current.handleNameChange("Strategic account"));
    act(() => {
      result.current.handleColorValidityChange(false);
      result.current.submit();
    });
    expect(api.post).not.toHaveBeenCalled();
    expect(result.current.submitDisabled).toBe(true);
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.handleColorValidityChange(true));
    act(() => result.current.submit());
    await waitFor(() => expect(saved).toHaveBeenCalled());
  });

  it("sends only one request before pending state commits and refuses field changes while pending", async () => {
    let finish!: (data: unknown) => void;
    api.post.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result } = form();
    act(() => result.current.handleNameChange("Strategic account"));
    act(() => {
      result.current.submit(); result.current.submit();
      result.current.handleNameChange("Changed during save");
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(result.current.name).toBe("Strategic account");
    expect(result.current.isPending()).toBe(true);
    expect(saved).not.toHaveBeenCalled();
    await act(async () => finish({ data: TAG }));
    expect(result.current.isPending()).toBe(false);
  });

  it("requires reconciliation for an unknown save outcome and never emits success", async () => {
    api.post.mockRejectedValue(new Error("lost response"));
    const { result } = form();
    act(() => result.current.handleNameChange("Strategic account"));
    act(() => result.current.submit());
    await waitFor(() => expect(reloadNeeded).toHaveBeenCalledWith(en.crmTags.errors.uncertain));
    expect(saved).not.toHaveBeenCalled();
  });

  it("does not create at 500 or submit unchanged edits or read-only forms", () => {
    const capacity = form({ existingTags: Array.from({ length: 500 }, () => TAG) });
    act(() => capacity.result.current.handleNameChange("New tag"));
    act(() => capacity.result.current.submit());
    expect(capacity.result.current.serverError).toBe(en.crmTags.errors.limitExceeded);
    const edit = form({ target: { mode: "edit", tag: TAG } });
    act(() => edit.result.current.submit());
    expect(edit.result.current.submitDisabled).toBe(true);
    const reader = form({ canWrite: false });
    act(() => reader.result.current.handleNameChange("New tag"));
    act(() => reader.result.current.submit());
    expect(api.post).not.toHaveBeenCalled();
    expect(api.patch).not.toHaveBeenCalled();
  });
});
