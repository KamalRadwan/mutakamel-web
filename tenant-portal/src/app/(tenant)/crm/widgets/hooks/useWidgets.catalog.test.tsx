// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWidgets } from "./useWidgets";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: ["crm.widgets.read", "crm.widgets.create"] } }),
}));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get, post } };
});

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("widget-only catalogue loading", () => {
  it("loads metadata and saves a widget without dashboard read or preview requests", async () => {
    get.mockImplementation(async (path: string) => {
      if (path === "/api/tenant/crm/v1/widgets") return { data: { items: [], nextCursor: null } };
      if (path === "/api/tenant/crm/v1/widgets/catalog") return {
        data: {
          grid: {},
          visualizations: [{ key: "METRIC_CARD", shapes: ["SCALAR"], minSeries: 1, maxSeries: 1 }],
          metrics: [{ key: "crm.leads.created.count", unit: "COUNT", shape: "SCALAR", dimensions: ["none"] }],
          dimensions: [{ key: "none", grains: [] }],
          templates: [],
        },
      };
      throw new Error(`Unexpected route: ${path}`);
    });
    post.mockResolvedValue({ data: { id: "018f0000-0000-7000-8000-000000000101" }, headers: new Headers() });
    const { result } = renderHook(() => useWidgets());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.catalog).not.toBeNull();
    expect(result.current.catalog?.visualizations[0]?.key).toBe("METRIC_CARD");
    expect(result.current.catalog?.metrics[0]?.key).toBe("crm.leads.created.count");
    expect(result.current.catalogFailed).toBe(false);
    expect(result.current.canCreate).toBe(true);
    expect(result.current.canPreview).toBe(false);
    const input = {
      name: "Lead count",
      visualizationType: "METRIC_CARD" as const,
      querySpec: { series: [{ metricKey: "crm.leads.created.count" }], dimension: { key: "none" } },
    };
    await act(async () => {
      await result.current.runPreview(input);
      expect((await result.current.create(input)).ok).toBe(true);
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/api/tenant/crm/v1/widgets", expect.objectContaining(input), expect.any(Object));
    expect(get.mock.calls.every(([path]) => !String(path).includes("/dashboards/"))).toBe(true);
  });
});
