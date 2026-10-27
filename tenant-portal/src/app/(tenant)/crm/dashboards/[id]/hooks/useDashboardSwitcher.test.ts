// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { DASHBOARDS_PATH, DASHBOARDS_CATALOG_PATH, dashboardFromTemplatePath } from "../../dashboard-contract";
import { useDashboardSwitcher } from "./useDashboardSwitcher";

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: { get, put },
}));

const ID = "01900300-0000-7000-8000-000000000001";
const catalog = {
  grid: { columns: 12, maxWidgets: 20 }, visualizations: [], metrics: [], dimensions: [],
  templates: [
    { key: "CRM_DEFAULT", nameEn: "Catalogue default", nameAr: "اللوحة من الكتالوج" },
    { key: "SALES_PIPELINE", nameEn: "Catalogue sales", nameAr: "المبيعات من الكتالوج" },
  ],
};
const dashboard = {
  id: ID, ownerUserId: ID, name: "Renamed by user", revision: 1,
  updatedAt: "2026-10-18T00:00:00Z", accessLevel: "OWNER", sourceTemplateKey: "CRM_DEFAULT",
};
const serverError = () => new TenantApiClientError("Server error", {
  status: 500, statusText: "Internal Server Error", headers: new Headers(), data: {},
});

beforeEach(() => {
  get.mockImplementation(async (path: string) => ({ data: path === DASHBOARDS_PATH ? { items: [dashboard], nextCursor: null } : catalog }));
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("dashboard switcher templates", () => {
  it('loads subsequent pages on demand and delays missing-template choices until the list is complete', async () => {
    const nextId = '01900300-0000-7000-8000-000000000002';
    get.mockImplementation(async (path: string) => ({ data: path === DASHBOARDS_PATH
      ? { items: [dashboard], nextCursor: ID }
      : path.includes('?cursor=') ? { items: [{ ...dashboard, id: nextId, sourceTemplateKey: 'SALES_PIPELINE' }], nextCursor: null }
      : catalog }));
    const { result } = renderHook(() => useDashboardSwitcher(true));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.unprovisionedTemplates).toEqual([]);
    expect(get.mock.calls.some(([path]) => String(path).includes('?cursor='))).toBe(false);
    await act(async () => { await result.current.loadMore(); });
    expect(get).toHaveBeenCalledWith(`${DASHBOARDS_PATH}?cursor=${ID}`, expect.any(Object));
    expect(result.current.items.map((item) => item.id)).toEqual([ID, nextId]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.unprovisionedTemplates).toEqual([]);
    await act(async () => { await result.current.reload(); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);
  });
  it("uses catalogue labels and source keys even after a dashboard is renamed", async () => {
    const { result } = renderHook(() => useDashboardSwitcher(true));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(get).toHaveBeenCalledWith(DASHBOARDS_CATALOG_PATH, expect.any(Object));
    expect(result.current.unprovisionedTemplates).toEqual([
      expect.objectContaining({ key: "SALES_PIPELINE", nameEn: "Catalogue sales", nameAr: "المبيعات من الكتالوج" }),
    ]);
  });

  it("does not mistake a matching custom name or a shared template for an owned instance", async () => {
    get.mockImplementation(async (path: string) => ({ data: path === DASHBOARDS_PATH ? { items: [
      { ...dashboard, name: "Catalogue sales", sourceTemplateKey: null },
      { ...dashboard, id: "01900300-0000-7000-8000-000000000002", accessLevel: "VIEW" },
    ], nextCursor: null } : catalog }));
    const { result } = renderHook(() => useDashboardSwitcher(true));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.unprovisionedTemplates.map(({ key }) => key)).toEqual(["CRM_DEFAULT", "SALES_PIPELINE"]);
  });

  it("removes template options and blocks writes when create permission is revoked", async () => {
    const { result, rerender } = renderHook(({ canCreate }) => useDashboardSwitcher(canCreate), {
      initialProps: { canCreate: true },
    });
    await waitFor(() => expect(result.current.unprovisionedTemplates).toHaveLength(1));
    rerender({ canCreate: false });
    expect(result.current.unprovisionedTemplates).toEqual([]);
    await act(async () => { expect(await result.current.ensureTemplateDashboard("SALES_PIPELINE")).toBeNull(); });
    expect(put).not.toHaveBeenCalled();
  });

  it("returns failure for a forced template 500 so the workspace can show its toast", async () => {
    put.mockRejectedValue(serverError());
    const { result } = renderHook(() => useDashboardSwitcher(true));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { expect(await result.current.ensureTemplateDashboard("SALES_PIPELINE")).toBeNull(); });
    expect(put).toHaveBeenCalledWith(dashboardFromTemplatePath("SALES_PIPELINE"), {}, expect.any(Object));
  });

  it.each([DASHBOARDS_PATH, DASHBOARDS_CATALOG_PATH])("exposes %s failure without erasing loaded dashboards", async (failedPath) => {
    const { result } = renderHook(() => useDashboardSwitcher(true));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    get.mockImplementation(async (path: string) => {
      if (path === failedPath) throw serverError();
      return { data: path === DASHBOARDS_PATH ? { items: [dashboard], nextCursor: null } : catalog };
    });
    await act(async () => { await result.current.reload(); });
    expect(result.current.error?.status).toBe(500);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.unprovisionedTemplates).toEqual([]);
    get.mockImplementation(async (path: string) => ({ data: path === DASHBOARDS_PATH ? { items: [dashboard], nextCursor: null } : catalog }));
    await act(async () => { await result.current.reload(); });
    expect(result.current.error).toBeNull();
    expect(result.current.unprovisionedTemplates).toHaveLength(1);
  });
});
