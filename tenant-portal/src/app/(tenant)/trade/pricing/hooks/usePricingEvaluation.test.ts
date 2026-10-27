// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { usePricingEvaluation, type EvaluateFormValues } from "./usePricingEvaluation";

const ID = "0192f3a0-0000-7000-8000-000000000001";
const OTHER = "0192f3a0-0000-7000-8000-000000000002";
const { post, scope, toast } = vi.hoisted(() => ({
  post: vi.fn(),
  scope: {
    headers: { "x-mutakamel-company-id": "company", "x-mutakamel-branch-id": "branch" },
    isResolved: true,
    permissions: ["trade.pricing.read"],
    isTenantOwner: false,
  },
  toast: { outcomeFromApi: vi.fn(() => false) },
}));
vi.mock("../../trade-api", () => ({ tradePost: post }));
vi.mock("@/design-system", () => ({ useToast: () => toast }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../trade-advanced-scope", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../trade-advanced-scope")>(),
  useTradeBranchSelection: () => ({ branchId: ID, branchIds: [ID], selectBranch: vi.fn() }),
  useTradeScope: () => scope,
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
    act(() => result.current.pinCurrentResult());
    expect(result.current.pinnedEvaluations).toEqual([pinned]);
    expect(pinned.inputs.quantity).toBe("10");

    post.mockResolvedValue(response(OTHER));
    await act(async () => { await result.current.evaluate(); });
    expect(post.mock.calls[1]![1].quantity).toBe("100");
    expect(result.current.result?.decisionId).toBe(OTHER);
    expect(result.current.evaluatedInputs?.quantity).toBe("100");
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
});
