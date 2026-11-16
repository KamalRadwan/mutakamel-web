// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { usePlacementVersion } from "./usePlacementVersion";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), success: vi.fn(), warning: vi.fn(), generation: 0 }));
const dashboardId = "01900300-0000-7000-8000-000000000021";
const placementId = "01900300-0000-7000-8000-000000000022";
const widgetId = "01900300-0000-7000-8000-000000000023";
const path = `/api/tenant/crm/v1/dashboards/${dashboardId}/placements/${placementId}/version-policy`;
const history = `/api/tenant/crm/v1/widgets/${widgetId}/versions`;
const current = { dashboardId, placementId, widgetId, dashboardRevision: 2, widgetRevision: 4, governanceRevision: 3,
  activeVersionNumber: 3, selectedVersionNumber: 2, pinnedVersionNumber: 2, versionPolicy: "PINNED",
  placement: { x: 4, y: 0, width: 4, height: 2 } };
const proposed = { versionPolicy: "FOLLOW_ACTIVE", pinnedVersionNumber: null, selectedVersionNumber: 3,
  placement: { x: 0, y: 5, width: 6, height: 6 }, visualizationType: "FLOWCHART", layoutChanged: true, changed: true };
const precondition = { versionPolicy: "FOLLOW_ACTIVE", pinnedVersionNumber: null,
  expectedDashboardRevision: 2, expectedWidgetRevision: 4, expectedGovernanceRevision: 3 };
const response = (data: unknown) => ({ status: 200, data });
const apiError = (status: number, code: string) => new TenantApiClientError(code, { status, statusText: code, data: { code }, headers: new Headers() });

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({
  realtimeAuthGeneration: mocks.generation, user: { id: dashboardId, permissions: [], isTenantOwner: true },
}) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: true }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/design-system", () => ({ useToast: () => ({ success: mocks.success, warning: mocks.warning }) }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...(await original<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: { get: mocks.get, post: mocks.post, patch: mocks.patch },
}));

beforeEach(() => {
  mocks.generation++;
  mocks.get.mockResolvedValue(response(current));
  mocks.post.mockResolvedValue(response({ current, proposed }));
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function mount(enabled = true, canReadHistory = true) {
  const reload = vi.fn().mockResolvedValue(true);
  const { result } = renderHook(() => usePlacementVersion(dashboardId, enabled, canReadHistory, reload));
  const open = () => act(async () => { result.current.open(placementId, widgetId, "Converted leads", null); });
  const reviewFollow = async () => {
    act(() => result.current.select("follow"));
    await act(async () => result.current.review());
  };
  return { result, reload, open, reviewFollow };
}

describe("dashboard placement version review", () => {
  it("requires the exact reviewed geometry and refreshes after a validated, single PATCH", async () => {
    mocks.patch.mockResolvedValue(response({ ...current, ...proposed, dashboardRevision: 3 }));
    const { result, reload, open, reviewFollow } = mount();
    await open();
    expect(result.current.options).toEqual([3, 2]);
    expect(mocks.get).toHaveBeenCalledWith(path, expect.any(Object));
    await reviewFollow();
    expect(mocks.post).toHaveBeenCalledWith(`${path}/impact`, precondition, expect.objectContaining({ skipAutoIdempotency: true }));
    expect(result.current.active?.impact).toEqual(proposed);
    await act(async () => { await Promise.all([result.current.confirm(), result.current.confirm()]); });
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(mocks.patch).toHaveBeenCalledWith(path, { ...precondition, expectedSelectedVersionNumber: 3,
      expectedPlacement: proposed.placement }, expect.objectContaining({ nonReplayable: true, skipAutoIdempotency: true }));
    expect(reload).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(result.current.active).toBeNull();
  });

  it("loads earlier publications only on request and keeps pin choices after denied history", async () => {
    mocks.get.mockResolvedValueOnce(response(current)).mockRejectedValueOnce(apiError(403, "CRM_PERMISSION_DENIED"));
    const { result, open } = mount();
    await open();
    expect(mocks.get).toHaveBeenCalledTimes(1);
    await act(async () => result.current.loadHistory());
    expect(mocks.get).toHaveBeenLastCalledWith(history, expect.any(Object));
    expect(result.current.active?.historyError?.status).toBe(403);
    expect(result.current.options).toEqual([3, 2]);
  });

  it("binds paginated history to the reviewed widget head and invalidates impact on selection", async () => {
    const entry = (versionNumber: number) => ({ versionNumber, name: "Converted leads",
      provenance: "USER_PUBLISH", publishedAt: "2026-11-10T08:00:00Z" });
    const head = { widgetId, widgetRevision: 4, activeVersionNumber: 3 };
    mocks.get.mockResolvedValueOnce(response(current))
      .mockResolvedValueOnce(response({ ...head, items: [entry(3), entry(2)], nextBeforeVersion: 2 }))
      .mockResolvedValueOnce(response({ ...head, items: [entry(1)], nextBeforeVersion: null }));
    const { result, open, reviewFollow } = mount();
    await open();
    await reviewFollow();
    await act(async () => result.current.loadHistory());
    await act(async () => result.current.loadHistory());
    expect(mocks.get).toHaveBeenLastCalledWith(`${history}?beforeVersion=2`, expect.any(Object));
    expect(result.current.options).toEqual([3, 2, 1]);
    act(() => result.current.select("1"));
    expect(result.current.active?.choice).toEqual({ versionPolicy: "PINNED", pinnedVersionNumber: 1 });
    expect(result.current.active?.impact).toBeUndefined();
    await act(async () => result.current.confirm());
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("rejects a proposal for another selection and a different placement receipt", async () => {
    mocks.post.mockResolvedValueOnce(response({ current, proposed: { ...proposed, selectedVersionNumber: 2 } }));
    mocks.patch.mockResolvedValueOnce(response({ ...current, ...proposed, dashboardRevision: 3, placementId: widgetId }));
    const { result, open, reviewFollow, reload } = mount();
    await open();
    await reviewFollow();
    expect(result.current.active?.impact).toBeUndefined();
    await reviewFollow();
    await act(async () => result.current.confirm());
    expect(result.current.active?.uncertain).toBe(true);
    expect(result.current.allowed).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    await act(async () => result.current.confirm());
    expect(mocks.patch).toHaveBeenCalledTimes(1);
  });

  it("discards a stale review and reloads the actual binding before another change", async () => {
    mocks.patch.mockRejectedValueOnce(apiError(409, "CRM_DASHBOARD_PLACEMENT_VERSION_STALE"));
    const { result, open, reviewFollow } = mount();
    await open();
    await reviewFollow();
    await act(async () => result.current.confirm());
    expect(result.current.active?.error?.status).toBe(409);
    expect(result.current.active?.impact).toBeUndefined();
    mocks.get.mockResolvedValueOnce(response({ ...current, dashboardRevision: 3 }));
    await act(async () => result.current.retry());
    expect(result.current.active?.current?.dashboardRevision).toBe(3);
    expect(result.current.active?.choice?.pinnedVersionNumber).toBe(2);
  });

  it("never reads a placement when dashboard edit authority is absent", async () => {
    const { result, open } = mount(false);
    await open();
    expect(result.current.active).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
