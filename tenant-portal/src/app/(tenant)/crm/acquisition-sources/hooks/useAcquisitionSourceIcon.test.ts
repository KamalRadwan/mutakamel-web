// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useAcquisitionSourceIcon } from "./useAcquisitionSourceIcon";

const { post, get, success, warning, key } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), success: vi.fn(), warning: vi.fn(), key: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { post, get },
}));
vi.mock("@/lib/uuid", () => ({ generateUUIDv7: key }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(), useToast: () => ({ success, warning }),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const source = {
  id: "01902001-3000-7000-8000-000000000001", nameAr: "الموقع", nameEn: "Website", isActive: true,
  sortOrder: 1, createdAt: "2026-08-25T10:00:00.000Z", updatedAt: "2026-08-25T10:00:00.000Z", iconUrl: null,
};
const file = new File(["png content"], "logo.png", { type: "image/png" });
const failure = (status: number, code?: string) => new TenantApiClientError("backend prose", {
  status, statusText: "Failure", headers: new Headers(), data: { code, message: "backend prose" },
});
function setup() {
  key.mockReturnValue("01902001-3000-7000-8000-000000000099");
  const uploaded = vi.fn();
  const hook = renderHook(() => useAcquisitionSourceIcon(true, uploaded));
  act(() => hook.result.current.select(source));
  return { ...hook, uploaded };
}

describe("source icon uploads", () => {
  it("rejects invalid extension and oversize before upload", async () => {
    const { result } = setup();
    await act(async () => { await result.current.upload(new File(["x"], "logo.jpeg", { type: "image/png" })); });
    expect(result.current.error).toBe(en.crmAcquisitionSources.iconExtensionMismatch);
    const tooLarge = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" });
    await act(async () => { await result.current.upload(tooLarge); });
    expect(result.current.error).toBe(en.crmAcquisitionSources.iconTooLarge);
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    [400, "CRM_ACQUISITION_SOURCE_ICON_EMPTY", "iconEmpty"],
    [415, "CRM_ACQUISITION_SOURCE_ICON_CONTENT_INVALID", "iconContentInvalid"],
    [415, "CRM_ACQUISITION_SOURCE_ICON_EXTENSION_UNSUPPORTED", "iconExtensionMismatch"],
  ] as const)("preserves specific server failure %s %s", async (status, code, label) => {
    post.mockRejectedValue(failure(status, code));
    const { result, uploaded } = setup();
    await act(async () => { await result.current.upload(file); });
    expect(result.current.error).toBe(en.crmAcquisitionSources[label]);
    expect(result.current.selected).toEqual(source);
    expect(uploaded).not.toHaveBeenCalled();
  });

  it("fences double upload, validates the response and confirms success only once", async () => {
    let resolve!: (value: { data: typeof source }) => void;
    post.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const { result, uploaded } = setup();
    let first!: Promise<boolean>;
    act(() => { first = result.current.upload(file); });
    await act(async () => { expect(await result.current.upload(file)).toBe(false); });
    expect(post).toHaveBeenCalledOnce();
    await act(async () => { resolve({ data: source }); await first; });
    expect(uploaded).toHaveBeenCalledWith(source);
    expect(success).toHaveBeenCalledWith(en.crmAcquisitionSources.iconSaved);
  });

  it("retains the same file and key after an unknown response, refusing a replacement", async () => {
    post.mockRejectedValueOnce(failure(0)).mockResolvedValueOnce({ data: source });
    const { result, uploaded } = setup();
    await act(async () => { await result.current.upload(file); });
    expect(result.current.isUncertain).toBe(true);
    expect(result.current.error).toBe(en.crmAcquisitionSources.iconUncertain);
    await act(async () => { await result.current.upload(new File(["other"], "other.png", { type: "image/png" })); });
    expect(post).toHaveBeenCalledOnce();
    await act(async () => { await result.current.upload(file); });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][2].headers).toEqual(post.mock.calls[1][2].headers);
    expect(key).toHaveBeenCalledOnce();
    expect(uploaded).toHaveBeenCalledOnce();
    expect(result.current.selected).toBeNull();
  });

  it("does not apply a response for a different source", async () => {
    post.mockResolvedValue({ data: { ...source, id: "01902001-3000-7000-8000-000000000002" } });
    const { result, uploaded } = setup();
    await act(async () => { await result.current.upload(file); });
    expect(uploaded).not.toHaveBeenCalled();
    expect(result.current.isUncertain).toBe(true);
    expect(result.current.reconcileOnly).toBe(true);
    await act(async () => { await result.current.upload(file); });
    expect(post).toHaveBeenCalledOnce();
    expect(success).not.toHaveBeenCalled();
  });

  it("reconciles an unreadable upload with a read instead of replaying its invalid receipt", async () => {
    post.mockResolvedValue({ data: { data: source } });
    get.mockResolvedValue({ data: source });
    const { result, uploaded } = setup();
    await act(async () => { await result.current.upload(file); });
    expect(result.current.error).toBe(en.crmAcquisitionSources.iconUnreadable);
    await act(async () => { await result.current.reconcile(); });
    expect(get).toHaveBeenCalledWith(`/api/tenant/crm/v1/acquisition-sources/${source.id}`, expect.objectContaining({ cache: "no-store" }));
    expect(post).toHaveBeenCalledOnce();
    expect(uploaded).toHaveBeenCalledWith(source);
    expect(success).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith(en.crmAcquisitionSources.iconReviewed);
  });
});
