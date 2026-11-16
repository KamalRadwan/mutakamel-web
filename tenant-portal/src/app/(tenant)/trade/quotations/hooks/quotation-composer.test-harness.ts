import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { peekLanguageSnapshot } from "@/i18n/dictionary-store";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { validateTradeLine } from "../../documents/trade-line-validation";
import type { TradeLineDraft, TradeLineDraftSnapshot } from "../../documents/hooks/useTradeLineDraft";
import { CUSTOMER_OPTION, DETAIL_WITH_REVISION, HEADERS, WORKSPACE_CURRENCIES } from "./quotation-composer.test-fixtures";
import { buildQuotationPricingRequest, type QuotationDiscountDraft } from "../quotation-discount-draft";

const { auth, tradeGetMock, tradePostMock, loadCurrenciesMock, lineDraftState, toast, router } = vi.hoisted(() => ({
  auth: {
    user: { id: "actor-a", isTenantOwner: true } as { id: string; isTenantOwner?: boolean } | null,
    realtimeAuthGeneration: "tenant:session-a:actor-a" as string | null,
    readReadyProfileCommit: vi.fn(),
  },
  tradeGetMock: vi.fn(), tradePostMock: vi.fn(),
  loadCurrenciesMock: vi.fn(),
  router: { push: vi.fn() },
  lineDraftState: { lines: [] as TradeLineDraft[], invalidLineIndex: null as number | null,
    items: [] as TradeLineDraftSnapshot["items"], uomsByItem: {} as TradeLineDraftSnapshot["uomsByItem"],
    reset: vi.fn(), restore: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), errorFromApi: vi.fn(),
    outcomeFromApi: vi.fn(() => false) },
}));
export { auth, tradeGetMock, tradePostMock, loadCurrenciesMock, lineDraftState };

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("@/app/(tenant)/core/contracts/currency-options", () => ({ loadActiveCurrencyOptions: loadCurrenciesMock }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => router,
}));
vi.mock("../../trade-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../trade-api")>()),
  tradeGet: tradeGetMock, tradePost: tradePostMock,
}));
vi.mock("../../documents/hooks/useTradeLineDraft", () => ({ useTradeLineDraft: () => ({
  lines: lineDraftState.lines, items: lineDraftState.items,
  itemsById: Object.fromEntries(lineDraftState.items.map((item) => [item.id, item])),
  uomsByItem: lineDraftState.uomsByItem, lookupError: null, isLoadingItems: false, runningTotal: null,
  invalidLineIndex: lineDraftState.invalidLineIndex, lineErrors: lineDraftState.lines.map(validateTradeLine),
  purpose: "SALES", searchItems: vi.fn(), addLine: vi.fn(), removeLine: vi.fn(), setItem: vi.fn(),
  setUom: vi.fn(), setQuantity: vi.fn(), commitQuantity: vi.fn(), appendItems: vi.fn(),
  ensureItemUoms: vi.fn(async () => []), retryLookups: vi.fn(),
  reset: lineDraftState.reset, restore: lineDraftState.restore,
}) }));
vi.mock("@/design-system", () => ({ useToast: () => toast }));
vi.mock("./useQuotationPricing", () => ({ useQuotationPricing: (options: {
  draft: QuotationDiscountDraft; lines: TradeLineDraft[]; partyId: string | null; currencyCode: string;
}) => {
  const request = buildQuotationPricingRequest(options.draft, options.lines, options.partyId, options.currencyCode);
  return { ready: request !== null, request, preview: { calculation: { fingerprint: "a".repeat(64) } } };
} }));
vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: englishDictionary(), lang: "en", dir: "ltr" }),
}));

function englishDictionary() {
  const snapshot = peekLanguageSnapshot("en");
  if (!snapshot) throw new Error("tests/i18n.ts must preload the English dictionary");
  return snapshot.dictionary;
}

import { useQuotationComposer, type QuotationComposerOptions } from "./useQuotationComposer";

export function resetHarness() {
  auth.user = { id: "actor-a", isTenantOwner: true };
  auth.realtimeAuthGeneration = "tenant:session-a:actor-a";
  auth.readReadyProfileCommit.mockReset().mockImplementation(() => auth.user && ({
    user: auth.user, sessionRevision: JSON.stringify(["session-a", 1, 1]), sequence: 1,
  }));
  tradeGetMock.mockReset(); tradePostMock.mockReset();
  loadCurrenciesMock.mockReset(); loadCurrenciesMock.mockResolvedValue(WORKSPACE_CURRENCIES);
  lineDraftState.reset.mockReset(); lineDraftState.restore.mockReset();
  lineDraftState.invalidLineIndex = null;
  lineDraftState.items = []; lineDraftState.uomsByItem = {};
  lineDraftState.lines = [{ clientLineId: "01890000-0000-7000-8000-000000000099",
    itemId: "", uomId: "", quantity: "1", unitPrice: null, isPricing: false, priceError: null }];
  sessionStorage.clear();
  tradeGetMock.mockImplementation(async (path: string) => reply(path.includes("customer-options")
    ? { items: [CUSTOMER_OPTION] } : path.includes("contact-options")
      ? { partyType: "ORGANIZATION", items: [] } : DETAIL_WITH_REVISION));
}

export function renderComposer(overrides: Partial<QuotationComposerOptions> = {}) {
  return renderHook(() => useQuotationComposer({ headers: HEADERS, isEnabled: true,
    canCreate: true, canUpdate: true, canSend: true, ...overrides }));
}

export async function settle() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

export function reply(data: unknown, replayed = false) {
  return { data, headers: new Headers(replayed ? { "Idempotency-Replayed": "true" } : {}) };
}
export function apiError(status: number, code = "TRADE.PRICING.NO_PRICE_FOUND") {
  return new TenantApiClientError("Request refused", { status, statusText: "Refused",
    headers: new Headers(), data: { code } });
}
