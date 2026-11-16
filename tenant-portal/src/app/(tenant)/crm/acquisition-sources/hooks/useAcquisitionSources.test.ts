// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useAcquisitionSources } from "./useAcquisitionSources";
import { useAcquisitionSourcesWorkspace } from "./useAcquisitionSourcesWorkspace";
import { TooltipProvider } from "@/design-system";
import { AcquisitionSourceActions } from "../components/AcquisitionSourceActions";

const { get, patch, success, warning, auth } = vi.hoisted(() => ({
  get: vi.fn(), patch: vi.fn(), success: vi.fn(), warning: vi.fn(), auth: { canManage: true },
}));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { get, patch },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { permissions: auth.canManage ? ["crm.acquisition_sources.manage"] : [] } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(), useToast: () => ({ success, warning }),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); auth.canManage = true; });
const sources = [1, 2, 3].map((order) => ({
  id: `01902001-3000-7000-8000-00000000000${order}`, nameAr: `مصدر ${order}`, nameEn: `Source ${order}`,
  isActive: order !== 2, sortOrder: order, createdAt: "2026-08-25T10:00:00.000Z", updatedAt: "2026-08-25T10:00:00.000Z", iconUrl: null,
}));
async function setup() {
  get.mockResolvedValue({ data: sources });
  const hook = renderHook(() => useAcquisitionSources());
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe("source catalogue ordering", () => {
  it("opens the uploader from a labeled row button without opening More actions", async () => {
    get.mockResolvedValue({ data: sources });
    const { result } = renderHook(() => useAcquisitionSourcesWorkspace());
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    render(createElement(TooltipProvider, null, createElement(AcquisitionSourceActions, { source: sources[0], workspace: result.current })));
    const iconButton = screen.getByRole("button", { name: `${en.crmAcquisitionSources.iconTitle}: ${sources[0].nameEn}` });
    expect(iconButton.textContent).toContain(en.crmAcquisitionSources.iconTitle);
    fireEvent.click(iconButton);
    expect(result.current.icon.selected).toEqual(sources[0]);
    expect(result.current.editor.selected).toBeNull();
  });

  it("switches clean Edit to the icon drawer without dropping dirty names or status", async () => {
    get.mockResolvedValue({ data: sources });
    const { result } = renderHook(() => useAcquisitionSourcesWorkspace());
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    act(() => result.current.editor.select(sources[0]));
    act(() => result.current.editor.setDraft({ nameAr: sources[0].nameAr, nameEn: "New name", isActive: false }));
    act(() => result.current.openIconFromEditor());
    expect(result.current.editor.selected).toEqual(sources[0]);
    expect(result.current.editor.draft.nameEn).toBe("New name");
    expect(result.current.editor.draft.isActive).toBe(false);
    expect(result.current.icon.selected).toBeNull();
    act(() => result.current.editor.setDraft({ nameAr: sources[0].nameAr, nameEn: sources[0].nameEn, isActive: sources[0].isActive }));
    act(() => result.current.openIconFromEditor());
    expect(result.current.editor.selected).toBeNull();
    expect(result.current.icon.selected).toEqual(sources[0]);
    expect(patch).not.toHaveBeenCalled();
  });

  it("blocks the Edit to icon switch after manage access is revoked", async () => {
    get.mockResolvedValue({ data: sources });
    const { result, rerender } = renderHook(() => useAcquisitionSourcesWorkspace());
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    act(() => result.current.editor.select(sources[0]));
    auth.canManage = false;
    rerender();
    act(() => result.current.openIconFromEditor());
    expect(result.current.icon.selected).toBeNull();
    expect(patch).not.toHaveBeenCalled();
  });

  it("reads the tenant catalogue without branch or invented pagination", async () => {
    const { result } = await setup();
    expect(get).toHaveBeenCalledWith("/api/tenant/crm/v1/acquisition-sources", expect.objectContaining({ cache: "no-store" }));
    expect(result.current.items).toEqual(sources);
    expect(get.mock.calls[0][1]).not.toHaveProperty("params");
  });

  it("sends the full catalogue, including inactive sources, and fences repeated moves", async () => {
    let resolve!: (value: { data: typeof sources }) => void;
    patch.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const { result } = await setup();
    let first!: Promise<boolean>;
    act(() => { first = result.current.handleReorder([sources[0].id, sources[2].id, sources[1].id]); });
    expect(result.current.items.map((source) => source.id)).toEqual([sources[0].id, sources[2].id, sources[1].id]);
    await act(async () => { await result.current.handleReorder([sources[0].id, sources[2].id, sources[1].id]); });
    expect(patch).toHaveBeenCalledOnce();
    expect(patch).toHaveBeenCalledWith("/api/tenant/crm/v1/acquisition-sources/reorder", {
      orderedIds: [sources[0].id, sources[2].id, sources[1].id],
    }, expect.objectContaining({ cache: "no-store" }));
    await act(async () => { resolve({ data: [sources[0], { ...sources[2], sortOrder: 2 }, { ...sources[1], sortOrder: 3 }] }); await first; });
    expect(success).toHaveBeenCalledWith(en.crmAcquisitionSources.orderSaved);
  });

  it("does not reorder a searched subset or without manage permission", async () => {
    const { result, rerender } = await setup();
    act(() => result.current.setSearchQuery("Source 2"));
    expect(result.current.items).toHaveLength(1);
    await act(async () => { await result.current.handleReorder([sources[1].id, sources[0].id, sources[2].id]); });
    expect(patch).not.toHaveBeenCalled();
    act(() => result.current.setSearchQuery(""));
    auth.canManage = false;
    rerender();
    await act(async () => { await result.current.handleReorder([sources[1].id, sources[0].id, sources[2].id]); });
    expect(patch).not.toHaveBeenCalled();
  });

  it("rolls back a stale full-set refusal and reloads the catalogue", async () => {
    patch.mockRejectedValue(new TenantApiClientError("private backend message", {
      status: 422, statusText: "Invalid", headers: new Headers(), data: { code: "CRM_ACQUISITION_SOURCE_REORDER_INVALID" },
    }));
    const { result } = await setup();
    await act(async () => { await result.current.handleReorder([sources[1].id, sources[0].id, sources[2].id]); });
    expect(result.current.items).toEqual(sources);
    expect(result.current.mutationError).toBe(en.crmAcquisitionSources.reorderFailed);
    expect(get).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledOnce();
    expect(success).not.toHaveBeenCalled();
  });

  it("does not write invalid sets, unchanged order, or while a create form is open", async () => {
    const { result } = await setup();
    await act(async () => { await result.current.handleReorder(sources.map(({ id }) => id)); });
    await act(async () => { await result.current.handleReorder([sources[0].id]); });
    await act(async () => { await result.current.handleReorder([sources[0].id, sources[0].id, sources[2].id]); });
    act(() => result.current.openCreate());
    await act(async () => { await result.current.handleReorder([sources[1].id, sources[0].id, sources[2].id]); });
    expect(patch).not.toHaveBeenCalled();
  });

  it("locks writes after an unknown result until a validated catalogue read succeeds", async () => {
    const { result } = await setup();
    patch.mockRejectedValue(new Error("response lost"));
    get.mockRejectedValue(new Error("offline"));
    await act(async () => { await result.current.handleReorder([sources[1].id, sources[0].id, sources[2].id]); });
    expect(result.current.needsReload).toBe(true);
    expect(result.current.mutationError).toBe(en.crmAcquisitionSources.reorderUncertain);
    await act(async () => { await result.current.handleReorder([sources[1].id, sources[0].id, sources[2].id]); });
    expect(patch).toHaveBeenCalledOnce();
    get.mockResolvedValue({ data: sources });
    await act(async () => { await result.current.reload(); });
    expect(result.current.needsReload).toBe(false);
    expect(result.current.queryError).toBeNull();
  });

  it("reconciles a successful response that does not prove the requested order", async () => {
    const { result } = await setup();
    patch.mockResolvedValue({ data: sources });
    await act(async () => { await result.current.handleReorder([sources[1].id, sources[0].id, sources[2].id]); });
    expect(result.current.items).toEqual(sources);
    expect(get).toHaveBeenCalledTimes(2);
    expect(success).not.toHaveBeenCalled();
  });

  it("ignores a late reorder completion after unmount", async () => {
    let resolve!: (value: { data: typeof sources }) => void;
    patch.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const { result, unmount } = await setup();
    let request!: Promise<boolean>;
    act(() => { request = result.current.handleReorder([sources[1].id, sources[0].id, sources[2].id]); });
    unmount();
    await act(async () => { resolve({ data: [{ ...sources[1], sortOrder: 1 }, { ...sources[0], sortOrder: 2 }, sources[2]] }); await request; });
    expect(success).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledOnce();
  });

  it("shows the reconciled source position after a committed write loses its response", async () => {
    get.mockResolvedValueOnce({ data: sources }).mockResolvedValueOnce({ data: [sources[0], { ...sources[2], sortOrder: 2 }, { ...sources[1], sortOrder: 3 }] });
    patch.mockRejectedValue(new Error("response lost after commit"));
    const { result } = renderHook(() => useAcquisitionSourcesWorkspace());
    await waitFor(() => expect(result.current.state.isLoading).toBe(false));
    act(() => result.current.openMove(sources[2]));
    await act(async () => { expect(await result.current.moveSelected(2)).toBe(false); });
    expect(result.current.selectedForMove?.sortOrder).toBe(2);
    expect(result.current.state.needsReload).toBe(false);
    expect(result.current.state.mutationError).toBe(en.crmAcquisitionSources.reorderUncertain);
    expect(success).not.toHaveBeenCalled();
  });

  it("keeps management disabled after a server permission denial even if catalogue reading succeeds", async () => {
    const { result } = await setup();
    patch.mockRejectedValue(new TenantApiClientError("permission revoked", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: { code: "CRM_PERMISSION_DENIED" },
    }));
    await act(async () => { await result.current.handleReorder([sources[1].id, sources[0].id, sources[2].id]); });
    expect(result.current.canManage).toBe(false);
    expect(result.current.queryError).toBeNull();
    await act(async () => { await result.current.handleReorder([sources[1].id, sources[0].id, sources[2].id]); });
    expect(patch).toHaveBeenCalledOnce();
  });
});
