// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useTransferWidgetList } from "./useTransferWidgetList";
import { useWidgetOwnershipTransfer } from "./useWidgetOwnershipTransfer";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), success: vi.fn(), warning: vi.fn(), generation: 0, writable: true }));
const id = (last: number) => `01900300-0000-7000-8000-${String(last).padStart(12, "0")}`;
const widgetId = id(90);
const ownerId = id(80);
const target = { id: id(60), name: "Ahmed Fouad" };
const root = "/api/tenant/crm/v1/widgets";
const path = `${root}/${widgetId}/ownership-transfer`;
const widget = { id: widgetId, ownerUserId: ownerId, ownerName: "Nada Mahmoud", name: "Lead conversion",
  widgetRevision: 4, governanceRevision: 2, activeVersionNumber: 3, draftRevision: 2, archived: false };
const counts = { affectedPlacementCount: 3, retainedShareCount: 1, dashboardOwnerAccessLostCount: 1,
  dashboardOwnerAccessRestoredCount: 0, dashboardReadersMayNeedShareCount: 1 };
const impact = { impactId: id(70), expiresAt: "2026-11-10T09:30:00.000Z", widget, target, ...counts };
const receipt = { widgetId, ownerUserId: target.id, previousOwnerUserId: ownerId, widgetRevision: 5, governanceRevision: 3, ...counts };
const precondition = { targetUserId: target.id, expectedWidgetRevision: 4, expectedGovernanceRevision: 2 };
const response = (data: unknown) => ({ status: 200, data });
const apiError = (status: number, code: string) => new TenantApiClientError(code, { status, statusText: code, data: { code }, headers: new Headers() });

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({
  realtimeAuthGeneration: mocks.generation, user: { id: id(95), permissions: ["crm.widgets.transfer_ownership"] },
}) }));
vi.mock("@/hooks/useAccessMode", () => ({ useAccessMode: () => ({ canMutate: mocks.writable }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/design-system", () => ({ useToast: () => ({ success: mocks.success, warning: mocks.warning }) }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...(await original<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: { get: mocks.get, post: mocks.post, patch: mocks.patch },
}));

beforeEach(() => {
  mocks.generation++;
  mocks.writable = true;
  mocks.get.mockImplementation(async (url: string) => url.includes("/targets")
    ? response({ items: [target], nextCursor: null }) : response(widget));
  mocks.post.mockResolvedValue(response(impact));
  mocks.patch.mockResolvedValue(response(receipt));
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function mount() {
  const refresh = vi.fn().mockResolvedValue(true);
  const hook = renderHook(() => useWidgetOwnershipTransfer(refresh));
  const { result } = hook;
  const open = () => act(async () => result.current.open(widgetId, document.createElement("button")));
  const review = async () => {
    await open();
    await act(async () => result.current.searchTargets("Fouad"));
    act(() => result.current.select(target.id));
    await act(async () => result.current.inspect());
  };
  const acknowledge = () => act(() => {
    result.current.setReason("  Library reassignment  ");
    result.current.acknowledge(true);
  });
  return { ...hook, refresh, open, review, acknowledge };
}

describe("B49 ownership workspace", () => {
  it("uses only transfer routes and verifies one exact acknowledged command", async () => {
    const { result, review, acknowledge, refresh } = mount();
    await review();
    expect(mocks.get.mock.calls.map(([url]) => url)).toEqual([path, `${path}/targets?search=Fouad`]);
    expect(mocks.post).toHaveBeenCalledWith(`${path}/impact`, precondition, expect.objectContaining({ skipAutoIdempotency: true }));
    expect(result.current.canConfirm).toBe(false);
    await act(async () => result.current.confirm());
    expect(mocks.patch).not.toHaveBeenCalled();
    acknowledge();
    await act(async () => { await Promise.all([result.current.confirm(), result.current.confirm()]); });
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    expect(mocks.patch).toHaveBeenCalledWith(path, { ...precondition, impactId: impact.impactId, reason: "Library reassignment",
      acknowledged: true }, expect.objectContaining({ nonReplayable: true, skipAutoIdempotency: true }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(result.current.active).toBeNull();
  });

  it("requires a new review after conflict without losing the typed reason", async () => {
    mocks.patch.mockRejectedValueOnce(apiError(409, "CRM_WIDGET_TRANSFER_IMPACT_STALE"));
    const { result, review, acknowledge } = mount();
    await review();
    acknowledge();
    await act(async () => result.current.confirm());
    expect(result.current.active?.impact).toBeUndefined();
    expect(result.current.canEdit).toBe(false);
    mocks.get.mockResolvedValueOnce(response({ ...widget, widgetRevision: 5 }));
    await act(async () => result.current.reload());
    expect(result.current.active?.widget?.widgetRevision).toBe(5);
    expect(result.current.active?.reason.trim()).toBe("Library reassignment");
    expect(result.current.active?.target).toBeUndefined();
    expect(result.current.canConfirm).toBe(false);
  });

  it("persists the affected widget across remount and requires a fresh exact read after a mismatched receipt", async () => {
    mocks.patch.mockResolvedValueOnce(response({ ...receipt, ownerUserId: id(61) }));
    const first = mount();
    await first.review();
    first.acknowledge();
    await act(async () => first.result.current.confirm());
    expect(first.result.current.recoveryId).toBe(widgetId);
    expect(mocks.success).not.toHaveBeenCalled();
    first.unmount();

    const second = mount();
    expect(second.result.current.allowed).toBe(false);
    expect(second.result.current.recoveryId).toBe(widgetId);
    act(() => second.result.current.reviewRecovery());
    expect(second.result.current.allowed).toBe(false);
    mocks.get.mockResolvedValueOnce(response({ ...widget, ownerUserId: target.id, ownerName: target.name, widgetRevision: 5 }));
    await act(async () => second.result.current.checkCurrent());
    expect(mocks.get).toHaveBeenLastCalledWith(path, expect.anything());
    expect(second.result.current.recovery?.widget?.ownerName).toBe(target.name);
    expect(second.result.current.allowed).toBe(false);
    act(() => second.result.current.reviewRecovery());
    expect(second.result.current.allowed).toBe(true);
    expect(mocks.patch).toHaveBeenCalledTimes(1);
  });

  it("drops obsolete owner-search replies and rejects a mismatched impact target", async () => {
    let resolveFirst!: (value: unknown) => void;
    const { result, open } = mount();
    await open();
    mocks.get.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    act(() => result.current.searchTargets("old"));
    await act(async () => result.current.searchTargets("new"));
    await act(async () => resolveFirst(response({ items: [{ id: id(50), name: "Old result" }], nextCursor: null })));
    expect(result.current.targetPage?.items).toEqual([target]);
    act(() => result.current.select(target.id));
    mocks.post.mockResolvedValueOnce(response({ ...impact, target: { ...target, id: id(59) } }));
    await act(async () => result.current.inspect());
    expect(result.current.active?.impact).toBeUndefined();
    expect(result.current.canConfirm).toBe(false);
  });

  it("keeps the workspace read-only when tenant writes are disabled", async () => {
    mocks.writable = false;
    const { result, open } = mount();
    await open();
    expect(result.current.readOnly).toBe(true);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("loads and searches paged widget metadata while dropping unexpected payload fields", async () => {
    const next = { ...widget, id: id(89), name: "Regional pipeline" };
    mocks.get.mockResolvedValueOnce(response({ items: [{ ...widget, querySpec: { unexpected: true } }], nextCursor: widgetId }))
      .mockResolvedValueOnce(response({ items: [next], nextCursor: null }))
      .mockResolvedValueOnce(response({ items: [next], nextCursor: null }));
    const { result } = renderHook(() => useTransferWidgetList());
    await waitFor(() => expect(result.current.visible?.items).toEqual([widget]));
    await act(async () => result.current.more());
    expect(mocks.get).toHaveBeenLastCalledWith(`${root}/ownership-transfers?cursor=${widgetId}`, expect.anything());
    expect(result.current.visible?.items).toEqual([widget, next]);
    act(() => result.current.setInput("Regional & pipeline"));
    await act(async () => result.current.search());
    expect(mocks.get).toHaveBeenLastCalledWith(`${root}/ownership-transfers?search=Regional+%26+pipeline`, expect.anything());
    expect(result.current.visible?.items).toEqual([next]);
  });
});
