// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { en } from "@/i18n/dictionaries/en";
import { usePricingEvaluation, type EvaluateFormValues } from "./usePricingEvaluation";

const ID = "0192f3a0-0000-7000-8000-000000000001";
const OTHER = "0192f3a0-0000-7000-8000-000000000002";
const { post, scope, branchState, useTradeScopeSpy, toast } = vi.hoisted(() => ({
  post: vi.fn(),
  scope: {
    headers: { "x-mutakamel-company-id": "company", "x-mutakamel-branch-id": "branch" } as Record<string, string>,
    isResolved: true,
    permissions: ["trade.pricing.read"],
    isTenantOwner: false,
  },
  branchState: {
    branchId: "0192f3a0-0000-7000-8000-000000000001" as string | null,
    branchIds: ["0192f3a0-0000-7000-8000-000000000001"] as string[],
    channelId: null as string | null,
  },
  useTradeScopeSpy: vi.fn(),
  toast: { outcomeFromApi: vi.fn(() => false) },
}));
vi.mock("../../trade-api", () => ({ tradePost: post }));
vi.mock("@/design-system", () => ({ useToast: () => toast }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../useTradeScope", () => ({ useTradeScope: () => ({
  context: { companyId: "company", branchId: branchState.branchId, channelId: branchState.channelId },
  branchIds: branchState.branchIds, selectBranch: vi.fn(),
}) }));
vi.mock("../../trade-advanced-scope", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../trade-advanced-scope")>(),
  useTradeBranchSelection: () => ({
    branchId: branchState.branchId ?? (branchState.branchIds.length === 1 ? branchState.branchIds[0] : null),
    branchIds: branchState.branchIds,
    selectBranch: vi.fn(),
  }),
  useTradeScope: (target: string, branchId: string | null) => {
    useTradeScopeSpy(target, branchId);
    return scope;
  },
}));

const INPUTS: EvaluateFormValues = {
  purpose: "SALES", itemId: ID, uomId: OTHER, quantity: "10",
  currencyCode: "SAR", partyId: "", priceBookId: "",
};
function response(decisionId = ID) {
  return { data: {
    decisionId, outcome: "ALLOW", unitPrice: "8.50", baselineUnitPrice: "10.00",
    currencyCode: "SAR", priceBookId: ID, priceBookVersionId: OTHER,
    minimumAllowedPrice: null, matchedPromotions: [],
  } };
}
function deferred() {
  let resolve!: (value: ReturnType<typeof response>) => void;
  const promise = new Promise<ReturnType<typeof response>>((yes) => { resolve = yes; });
  return { promise, resolve };
}
function setup() {
  const hook = renderHook(() => usePricingEvaluation());
  act(() => hook.result.current.setValue(INPUTS));
  return hook;
}

beforeEach(() => {
  post.mockReset().mockResolvedValue(response());
  toast.outcomeFromApi.mockClear();
  useTradeScopeSpy.mockClear();
  branchState.branchId = ID;
  branchState.branchIds = [ID];
  branchState.channelId = null;
  scope.headers = { "x-mutakamel-company-id": ID, "x-mutakamel-branch-id": OTHER };
  scope.isResolved = true;
  scope.permissions = ["trade.pricing.read"];
});
afterEach(cleanup);

describe("pricing simulator evaluation snapshots", () => {
  it("pins the evaluated quantity and scope, then requires reevaluation for quantity 100", async () => {
    const { result } = setup();
    await act(async () => { await result.current.evaluate(); });
    act(() => result.current.pinCurrentResult());
    const pinned = result.current.pinnedEvaluations[0]!;
    expect(pinned.inputs.quantity).toBe("10");
    expect(pinned.scopeHeaders).toEqual(scope.headers);
    expect(Object.isFrozen(pinned.inputs)).toBe(true);
    expect(Object.isFrozen(pinned.scopeHeaders)).toBe(true);

    act(() => result.current.setValue({ quantity: "100" }));
    expect(result.current.result).toBeNull();
    expect(result.current.evaluatedInputs).toBeNull();
    expect(result.current.hasStaleEdits).toBe(true);
    act(() => result.current.pinCurrentResult());
    expect(result.current.pinnedEvaluations).toEqual([pinned]);
    expect(pinned.inputs.quantity).toBe("10");

    post.mockResolvedValue(response(OTHER));
    await act(async () => { await result.current.evaluate(); });
    expect(post.mock.calls[1]![1].quantity).toBe("100");
    expect(result.current.result?.decisionId).toBe(OTHER);
    expect(result.current.evaluatedInputs?.quantity).toBe("100");
    expect(result.current.hasStaleEdits).toBe(false);
    act(() => result.current.pinCurrentResult());
    expect(result.current.pinnedEvaluations.map((item) => item.inputs.quantity)).toEqual(["100", "10"]);
  });

  it.each<[string, Partial<EvaluateFormValues>]>([
    ["purpose", { purpose: "PURCHASE" }],
    ["item", { itemId: OTHER }],
    ["UOM", { uomId: ID }],
    ["quantity", { quantity: "100" }],
    ["currency", { currencyCode: "USD" }],
    ["party", { partyId: OTHER }],
    ["price book", { priceBookId: OTHER }],
  ])("hides and prevents pinning a decision after changing %s", async (_, patch) => {
    const { result } = setup();
    await act(async () => { await result.current.evaluate(); });
    expect(result.current.result).not.toBeNull();
    act(() => result.current.setValue(patch));
    expect(result.current.result).toBeNull();
    act(() => result.current.pinCurrentResult());
    expect(result.current.pinnedEvaluations).toEqual([]);
  });

  it.each(["retail", "wholesale", "vip"] as const)("invalidates for the %s preset", async (preset) => {
    const { result } = setup();
    await act(async () => { await result.current.evaluate(); });
    act(() => result.current.applyPreset(preset));
    expect(result.current.result).toBeNull();
    act(() => result.current.pinCurrentResult());
    expect(result.current.pinnedEvaluations).toEqual([]);
  });

  it.each(["x-mutakamel-company-id", "x-mutakamel-branch-id"] as const)(
    "invalidates when %s changes and preserves pinned scope",
    async (header) => {
      const { result, rerender } = setup();
      await act(async () => { await result.current.evaluate(); });
      act(() => result.current.pinCurrentResult());
      const originalHeaders = { ...scope.headers };
      scope.headers = { ...scope.headers, [header]: "0192f3a0-0000-7000-8000-000000000003" };
      rerender();
      expect(result.current.result).toBeNull();
      act(() => result.current.pinCurrentResult());
      expect(result.current.pinnedEvaluations).toHaveLength(1);
      expect(result.current.pinnedEvaluations[0]?.scopeHeaders).toEqual(originalHeaders);
    },
  );

  it("cannot associate an in-flight decision with edited inputs", async () => {
    const pending = deferred();
    post.mockReturnValueOnce(pending.promise);
    const { result } = setup();
    let request!: Promise<void>;
    act(() => { request = result.current.evaluate(); });
    act(() => result.current.setValue({ quantity: "100" }));
    await act(async () => { pending.resolve(response()); await request; });
    expect(result.current.isEvaluating).toBe(false);
    expect(result.current.result).toBeNull();
    act(() => result.current.pinCurrentResult());
    expect(result.current.pinnedEvaluations).toEqual([]);
    expect(post.mock.calls[0]![1].quantity).toBe("10");
  });

  it("reset prevents a late response from restoring the old decision", async () => {
    const pending = deferred();
    post.mockReturnValueOnce(pending.promise);
    const { result } = setup();
    let request!: Promise<void>;
    act(() => { request = result.current.evaluate(); });
    act(() => result.current.reset());
    await act(async () => { pending.resolve(response()); await request; });
    act(() => result.current.setValue(INPUTS));
    expect(result.current.result).toBeNull();
    expect(result.current.evaluatedInputs).toBeNull();
    expect(result.current.hasStaleEdits).toBe(false);
  });

  it("cannot associate an in-flight decision with a different scope", async () => {
    const pending = deferred();
    post.mockReturnValueOnce(pending.promise);
    const { result, rerender } = setup();
    let request!: Promise<void>;
    act(() => { request = result.current.evaluate(); });
    scope.headers = { ...scope.headers, "x-mutakamel-branch-id": ID };
    rerender();
    await act(async () => { pending.resolve(response()); await request; });
    expect(result.current.result).toBeNull();
    act(() => result.current.pinCurrentResult());
    expect(result.current.pinnedEvaluations).toEqual([]);
    expect(post.mock.calls[0]![2].headers["x-mutakamel-branch-id"]).toBe(OTHER);
  });

  it("snapshots the normalized inputs actually sent to Trade", async () => {
    const { result } = setup();
    act(() => result.current.setValue({
      currencyCode: " sar ", quantity: " 10 ", partyId: " ", priceBookId: " ",
    }));
    await act(async () => { await result.current.evaluate(); });
    expect(result.current.evaluatedInputs).toMatchObject({ currencyCode: "SAR", quantity: "10" });
    expect(result.current.evaluatedInputs).toMatchObject({ partyId: "", priceBookId: "" });
    act(() => result.current.pinCurrentResult());
    expect(result.current.pinnedEvaluations[0]?.inputs).toEqual(result.current.evaluatedInputs);
  });

  it("requests COMPANY scope when All branches is selected and BRANCH scope when a branch is selected", () => {
    branchState.branchId = null;
    scope.headers = { "x-mutakamel-company-id": ID };
    const { rerender } = renderHook(() => usePricingEvaluation());
    expect(useTradeScopeSpy).toHaveBeenLastCalledWith("COMPANY", null);

    branchState.branchId = ID;
    rerender();
    expect(useTradeScopeSpy).toHaveBeenLastCalledWith("BRANCH", ID);
  });

  it("maps TRADE.PRICE.NO_ELIGIBLE_PRICE to noPrice without setting queryError", async () => {
    post.mockRejectedValueOnce(new TenantApiClientError("No eligible price", {
      status: 404, statusText: "Not Found", headers: new Headers(),
      data: { errorCode: "TRADE.PRICE.NO_ELIGIBLE_PRICE", message: "No eligible price" },
    }));
    const { result } = setup();
    await act(async () => { await result.current.evaluate(); });
    expect(result.current.noPrice).toBe(true);
    expect(result.current.queryError).toBeNull();
    expect(toast.outcomeFromApi).not.toHaveBeenCalled();
  });

  it("rejects zero fixed-decimal quantity without calling tradePost", async () => {
    const { result } = setup();
    act(() => result.current.setValue({ quantity: "0.00000000" }));
    await act(async () => { await result.current.evaluate(); });
    expect(post).not.toHaveBeenCalled();
    expect(result.current.formError).toBe(en.tradePricing.formQuantityInvalid);
  });
  it("never evaluates a hidden channel override that differs from the visible scope", async () => {
    const { result, rerender } = setup();
    act(() => result.current.setValue({ channelId: OTHER }));
    await act(async () => { await result.current.evaluate(); });
    expect(post).not.toHaveBeenCalled();
    expect(result.current.formError).toBe(en.tradePricing.evalChannelScopeMismatch);
    branchState.channelId = OTHER;
    scope.headers = { ...scope.headers, "x-mutakamel-channel-id": OTHER };
    rerender();
    await act(async () => { await result.current.evaluate(); });
    expect(post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ channelId: OTHER }), expect.objectContaining({ headers: expect.objectContaining({ "x-mutakamel-channel-id": OTHER }) }));
  });

  it("sends no branch header for All branches even with one accessible branch", async () => {
    branchState.branchId = null;
    scope.headers = { "x-mutakamel-company-id": ID };
    const { result } = setup();
    await act(async () => { await result.current.evaluate(); });
    expect(useTradeScopeSpy).toHaveBeenLastCalledWith("COMPANY", null);
    expect(post.mock.calls[0]![2].headers).not.toHaveProperty("x-mutakamel-branch-id");
  });

  it("does not request evaluation without resolved permitted scope", async () => {
    scope.isResolved = false;
    const { result } = setup();
    await act(async () => { await result.current.evaluate(); });
    expect(post).not.toHaveBeenCalled();
  });

});
