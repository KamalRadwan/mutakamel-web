// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useInventoryMovements } from "./useInventoryMovements";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  branchId: null as string | null,
  canRead: false,
  scope: { isResolved: false, headers: {} as Record<string, string>, permissions: [], isTenantOwner: false },
  toast: { success: vi.fn(), outcomeFromApi: vi.fn(() => false) },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", () => ({ useToast: () => mocks.toast }));
vi.mock("../../../trade-advanced-scope", () => ({
  useTradeBranchSelection: () => ({ branchIds: [], branchId: mocks.branchId, selectBranch: vi.fn() }),
  hasTradePermission: () => mocks.canRead,
  useTradeScope: (target: string) => target === "BRANCH"
    ? mocks.scope
    : { ...mocks.scope, headers: { "x-mutakamel-company-id": "company" } },
}));
vi.mock("../../../trade-api", () => ({
  tradePost: mocks.post,
  tradeGet: mocks.get,
  tradeIfMatch: (version: number) => `"${version}"`,
  isTradeReplay: () => false,
}));

const id = "01902001-3000-7000-8000-000000000001";
const nodeId = "01902001-3000-7000-8000-000000000002";
const reservation = {
  id, fulfillmentNodeId: nodeId, version: 4, status: "ACTIVE",
  quantity: "10", releasedQuantity: "0", consumedQuantity: "0",
};
const response = (data: unknown) => ({ headers: new Headers(), data });
const rejection = (status: number) => new TenantApiClientError("Write rejected", {
  status, statusText: "", headers: new Headers(), data: {},
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.post.mockReset();
  mocks.get.mockReset();
  mocks.branchId = null;
  mocks.canRead = false;
  mocks.scope = { isResolved: false, headers: {}, permissions: [], isTenantOwner: false };
});
afterEach(cleanup);

describe("movement node picker scope", () => {
  const node = {
    id: nodeId, code: "WH", name: "Warehouse", nodeType: "WAREHOUSE",
    status: "ACTIVE", timezone: "UTC", version: 1, updatedAt: "2026-10-24T12:00:00.000Z",
  };
  function selectBranch(branch: string) {
    mocks.branchId = branch;
    mocks.canRead = true;
    mocks.scope = {
      ...mocks.scope, isResolved: true,
      headers: { "x-mutakamel-company-id": id, "x-mutakamel-branch-id": branch },
    };
  }

  it("loads validated nodes with the selected branch headers", async () => {
    selectBranch(id);
    mocks.get.mockResolvedValue(response([node]));
    const { result } = renderHook(useInventoryMovements);
    await act(async () => {});
    expect(mocks.get).toHaveBeenCalledWith("/api/tenant/trade/v1/inventory/nodes", expect.objectContaining({
      headers: { "x-mutakamel-company-id": id, "x-mutakamel-branch-id": id },
    }));
    expect(result.current.knownNodes).toEqual([node]);
  });

  it("clears old nodes on branch change and ignores a late response", async () => {
    selectBranch(id);
    mocks.get.mockResolvedValueOnce(response([node]));
    const { result, rerender } = renderHook(useInventoryMovements);
    await act(async () => {});
    expect(result.current.knownNodes).toEqual([node]);
    let finish!: (value: ReturnType<typeof response>) => void;
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    selectBranch(nodeId);
    rerender();
    expect(result.current.knownNodes).toEqual([]);
    const oldSignal = mocks.get.mock.calls[1][1].signal as AbortSignal;
    mocks.get.mockResolvedValueOnce(response([]));
    selectBranch(id);
    rerender();
    await act(async () => { finish(response([node])); });
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.knownNodes).toEqual([]);
    expect(result.current.formError).toBeNull();
  });

  it("shows a load error and clears it when another branch loads", async () => {
    selectBranch(id);
    mocks.get.mockRejectedValueOnce(new Error("network unavailable"));
    const { result, rerender } = renderHook(useInventoryMovements);
    await act(async () => {});
    expect(result.current.knownNodes).toEqual([]);
    expect(result.current.formError).toBe(en.tradeCommon.actionFailed);
    mocks.get.mockResolvedValueOnce(response([node]));
    selectBranch(nodeId);
    rerender();
    await act(async () => {});
    expect(result.current.formError).toBeNull();
    expect(result.current.knownNodes).toEqual([node]);
  });

  it("does not request nodes without a resolved branch or read permission", () => {
    const { rerender } = renderHook(useInventoryMovements);
    expect(mocks.get).not.toHaveBeenCalled();
    selectBranch(id);
    mocks.canRead = false;
    rerender();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("surfaces invalid node responses instead of exposing unvalidated nodes", async () => {
    selectBranch(id);
    mocks.get.mockResolvedValueOnce(response([{ id: nodeId }]));
    const { result } = renderHook(useInventoryMovements);
    await act(async () => {});
    expect(result.current.knownNodes).toEqual([]);
    expect(result.current.formError).toBe(en.tradeCommon.actionFailed);
  });
});

describe("movement recovery identity", () => {
  const values = {
    nodeId, sourceDocumentId: id, sourceDocumentVersion: "1",
    businessEffectiveAt: "2026-10-24T12:00:00.000Z",
    lines: [{ sourceLineId: id, sourceLineVersion: "1", itemId: id,
      uomId: id, itemProfileVersion: "1", quantity: "2" }],
  };

  it.each([400, 401, 403, 404, 409, 412, 413, 422, 429, 499])(
    "allows a corrected body with fresh identity after HTTP %s", async (status) => {
      mocks.post.mockRejectedValueOnce(rejection(status)).mockResolvedValue(response({ id, lines: [] }));
      const { result } = renderHook(useInventoryMovements);
      await act(async () => { expect(await result.current.submitReceipt(values)).toBe(false); });
      const first = mocks.post.mock.calls[0];
      await act(async () => {
        expect(await result.current.submitReceipt({ ...values, sourceDocumentVersion: "2" })).toBe(true);
      });
      expect(mocks.post).toHaveBeenCalledTimes(2);
      const next = mocks.post.mock.calls[1];
      expect(next[1]).toMatchObject({ sourceDocumentVersion: 2 });
      expect(next[1].operationKey).not.toBe(first[1].operationKey);
      expect(next[2].headers["x-idempotency-key"]).not.toBe(first[2].headers["x-idempotency-key"]);
    },
  );

  it.each(["postReceipt", "postDelivery"] as const)("allows a corrected If-Match after %s is rejected", async (post) => {
    mocks.post.mockRejectedValueOnce(rejection(412)).mockResolvedValue(response({ version: 3 }));
    const { result } = renderHook(useInventoryMovements);
    await act(async () => { expect(await result.current[post](id, 1)).toBe(false); });
    await act(async () => { expect(await result.current[post](id, 2)).toBe(true); });
    expect(mocks.post.mock.calls[0][2].headers["If-Match"]).toBe('"1"');
    expect(mocks.post.mock.calls[1][2].headers["If-Match"]).toBe('"2"');
    expect(mocks.post.mock.calls[1][2].headers["x-idempotency-key"])
      .not.toBe(mocks.post.mock.calls[0][2].headers["x-idempotency-key"]);
  });

  it("clears a lost-response fence when the unchanged retry receives a definitive rejection", async () => {
    mocks.post.mockRejectedValueOnce(new Error("response lost"))
      .mockRejectedValueOnce(rejection(409)).mockResolvedValue(response({ id, lines: [] }));
    const { result } = renderHook(useInventoryMovements);
    await act(async () => { expect(await result.current.submitReceipt(values)).toBe(false); });
    await act(async () => { expect(await result.current.submitReceipt(values)).toBe(false); });
    expect(mocks.post.mock.calls[1]).toEqual(mocks.post.mock.calls[0]);
    await act(async () => {
      expect(await result.current.submitReceipt({ ...values, sourceDocumentVersion: "2" })).toBe(true);
    });
    expect(mocks.post.mock.calls[2][2].headers["x-idempotency-key"])
      .not.toBe(mocks.post.mock.calls[0][2].headers["x-idempotency-key"]);
  });

  it.each([0, 500, 502, 503, 504])("retains the recovery identity after status %s", async (status) => {
    mocks.post.mockRejectedValueOnce(rejection(status)).mockResolvedValue(response({ id, lines: [] }));
    const { result } = renderHook(useInventoryMovements);
    await act(async () => { expect(await result.current.submitReceipt(values)).toBe(false); });
    await act(async () => {
      expect(await result.current.submitReceipt({ ...values, sourceDocumentVersion: "2" })).toBe(false);
    });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(result.current.formError).toBe(en.tradeInventory.unresolvedWrite);
    await act(async () => { expect(await result.current.submitReceipt(values)).toBe(true); });
    expect(mocks.post.mock.calls[1]).toEqual(mocks.post.mock.calls[0]);
  });

  it("retains the recovery identity when the accepted movement cannot be parsed", async () => {
    mocks.post.mockResolvedValueOnce(response({ id })).mockResolvedValue(response({ id, lines: [] }));
    const { result } = renderHook(useInventoryMovements);
    await act(async () => { expect(await result.current.submitReceipt(values)).toBe(false); });
    expect(result.current.sessionLedger).toEqual([]);
    expect(mocks.toast.success).not.toHaveBeenCalled();
    await act(async () => {
      expect(await result.current.submitReceipt({ ...values, sourceDocumentVersion: "2" })).toBe(false);
    });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(result.current.formError).toBe(en.tradeInventory.unresolvedWrite);
    await act(async () => { expect(await result.current.submitReceipt(values)).toBe(true); });
    expect(mocks.post.mock.calls[1]).toEqual(mocks.post.mock.calls[0]);
  });

  it.each(["submitReceipt", "submitDelivery"] as const)("recovers %s after a lost response", async (submit) => {
    mocks.post.mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValue(response({ id, version: 1, lines: [{ id: nodeId, quantity: "2", tracking: {} }] }));
    const { result } = renderHook(useInventoryMovements);
    await act(async () => { expect(await result.current[submit](values)).toBe(false); });
    const first = mocks.post.mock.calls[0];
    expect(first[2].headers["x-idempotency-key"]).toBeTruthy();
    await act(async () => {
      expect(await result.current[submit]({ ...values, sourceDocumentVersion: "2" })).toBe(false);
    });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(result.current.formError).toBe(en.tradeInventory.unresolvedWrite);
    await act(async () => { expect(await result.current[submit](values)).toBe(true); });
    expect(mocks.post.mock.calls[1]).toEqual(first);
    expect(result.current.sessionLedger).toHaveLength(1);
    expect(result.current.sessionLedger[0].id).toBe(id);
    await act(async () => { expect(await result.current[submit](values)).toBe(true); });
    expect(mocks.post.mock.calls[2][1].operationKey).not.toBe(first[1].operationKey);
    expect(mocks.post.mock.calls[2][2].headers["x-idempotency-key"])
      .not.toBe(first[2].headers["x-idempotency-key"]);
  });
});

describe("reservation session ledger", () => {
  it("sends a release subset without altering it on the way to the API", async () => {
    mocks.post.mockResolvedValue(response({ ...reservation, status: "PARTIALLY_RELEASED", releasedQuantity: "2" }));
    const { result } = renderHook(useInventoryMovements);
    await act(async () => {
      expect(await result.current.releaseReservation(id, 4, "2", "", "SN002\nSN003")).toBe(true);
    });
    expect(mocks.post.mock.calls[0][1]).toEqual({ quantity: "2", serialKeys: ["SN002", "SN003"] });
  });

  it("shows 7 remaining after releasing 3 of 10, then the server's full-release status", async () => {
    mocks.post.mockResolvedValueOnce(response(reservation))
      .mockResolvedValueOnce(response({ ...reservation, version: 9, status: "PARTIALLY_RELEASED", releasedQuantity: "3" }))
      .mockResolvedValueOnce(response({ ...reservation, version: 12, status: "RELEASED", releasedQuantity: "10" }));
    const { result } = renderHook(useInventoryMovements);
    await act(async () => {
      expect(await result.current.submitReservation({
        nodeId, itemId: id, uomId: id, quantity: "10",
        sourceDocumentId: id, sourceLineId: id,
        sourceDocumentVersion: "1", sourceLineVersion: "1",
      })).toBe(true);
    });
    await act(async () => { expect(await result.current.releaseReservation(id, 4, "3", "")).toBe(true); });
    expect(result.current.sessionLedger).toHaveLength(1);
    expect(result.current.sessionLedger[0]).toMatchObject({
      status: "PARTIALLY_RELEASED", version: 9,
      reservation: { releasedQuantity: "3", remainingQuantity: "7.00000000" },
    });
    await act(async () => { expect(await result.current.releaseReservation(id, 9, "", "")).toBe(true); });
    expect(result.current.sessionLedger[0]).toMatchObject({
      status: "RELEASED", version: 12,
      reservation: { releasedQuantity: "10", remainingQuantity: "0.00000000" },
    });
  });

  it("records a manually entered reservation with the server's mixed terminal status", async () => {
    mocks.post.mockResolvedValue(response({
      ...reservation, version: 7, status: "CLOSED", releasedQuantity: "8", consumedQuantity: "2",
    }));
    const { result } = renderHook(useInventoryMovements);
    await act(async () => { expect(await result.current.releaseReservation(id, 6, "", "")).toBe(true); });
    expect(result.current.sessionLedger[0]).toMatchObject({
      id, nodeId, status: "CLOSED", version: 7,
      reservation: { releasedQuantity: "8", consumedQuantity: "2", remainingQuantity: "0.00000000" },
    });
  });

  it("does not announce success or invent a released entry for an invalid response", async () => {
    mocks.post.mockResolvedValue(response({ id }));
    const { result } = renderHook(useInventoryMovements);
    await act(async () => { expect(await result.current.releaseReservation(id, 1, "3", "")).toBe(false); });
    expect(result.current.sessionLedger).toEqual([]);
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(result.current.formError).not.toBeNull();
  });
});

describe("partial movement reversal", () => {
  it.each([
    ["submitReceipt", "reverseReceipt"], ["submitDelivery", "reverseDelivery"],
  ] as const)("preserves returned status and selected serials for %s", async (create, reverse) => {
    const line = { id: nodeId, quantity: "3", tracking: { serialKeys: ["SN001", "SN002", "SN003"] } };
    mocks.post.mockResolvedValueOnce(response({ id, version: 1, lines: [line] }))
      .mockResolvedValueOnce(response({ id, version: 3, status: "PARTIALLY_REVERSED" }));
    const { result } = renderHook(useInventoryMovements);
    await act(async () => {
      expect(await result.current[create]({
        nodeId, sourceDocumentId: id, sourceDocumentVersion: "1", businessEffectiveAt: "2026-10-26T12:00:00Z",
        lines: [{ sourceLineId: id, sourceLineVersion: "1", uomId: id, quantity: "3", serialKeys: "SN001\nSN002\nSN003" }],
      })).toBe(true);
    });
    expect(result.current.sessionLedger[0].lines).toEqual([{ id: nodeId, quantity: "3", serialKeys: ["SN001", "SN002", "SN003"] }]);
    await act(async () => {
      expect(await result.current[reverse](id, 2, "DATA_ENTRY_CORRECTION", "2026-10-26T12:00:00Z", [
        { lineId: nodeId, quantity: "2", serialKeys: "SN002\nSN003" },
      ])).toBe(true);
    });
    expect(mocks.post.mock.calls[1][1]).toMatchObject({ lines: [{ lineId: nodeId, quantity: "2", serialKeys: ["SN002", "SN003"] }] });
    expect(result.current.sessionLedger[0]).toMatchObject({ status: "PARTIALLY_REVERSED", version: 3 });
  });
});
