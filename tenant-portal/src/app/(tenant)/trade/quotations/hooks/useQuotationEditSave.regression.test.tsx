// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { peekLanguageSnapshot } from "@/i18n/dictionary-store";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { isUUIDv7 } from "@/lib/uuid";
import { CHANNEL_SCOPE_HEADER } from "../../trade-api";
import {
  buildUpdateQuotationHeader,
  type Quotation,
  type QuotationDetail,
} from "../quotation-contract";
import {
  buildSanitizedQuotationTerms,
  hydrateQuotationTerms,
} from "../quotation-workspace-hydration";
import type { QuotationRevisionInput } from "./useQuotationSave";

const { auth, tradeGetMock, tradePatchMock, tradePostMock, toast } = vi.hoisted(() => ({
  auth: {
    user: { id: "01890000-0000-7000-8000-000000000090", isTenantOwner: true } as { id: string; isTenantOwner?: boolean } | null,
    realtimeAuthGeneration: "tenant:session-a:01890000-0000-7000-8000-000000000090" as string | null,
  },
  tradeGetMock: vi.fn(),
  tradePatchMock: vi.fn(),
  tradePostMock: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    errorFromApi: vi.fn(),
    outcomeFromApi: vi.fn(() => false),
  },
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("../../trade-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../trade-api")>()),
  tradeGet: tradeGetMock,
  tradePatch: tradePatchMock,
  tradePost: tradePostMock,
}));
vi.mock("@/design-system", () => ({ useToast: () => toast }));
vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => {
    const snapshot = peekLanguageSnapshot("en");
    if (!snapshot) throw new Error("tests/i18n.ts must preload English");
    return { t: snapshot.dictionary, lang: "en", dir: "ltr" };
  },
}));

import { useQuotationEditSave, type QuotationEditSaveOptions } from "./useQuotationEditSave";

const COMPANY_ID = "01890000-0000-7000-8000-000000000001";
const BRANCH_ID = "01890000-0000-7000-8000-000000000002";
const CHANNEL_ID = "01890000-0000-7000-8000-000000000005";
const PARTY_ID = "01890000-0000-7000-8000-000000000003";
const CONTACT_ID = "01890000-0000-7000-8000-000000000004";
const QUOTE_ID = "01890000-0000-7000-8000-000000000010";
const REV_1_ID = "01890000-0000-7000-8000-000000000011";
const REV_2_ID = "01890000-0000-7000-8000-000000000012";
const ITEM_HEADSET_ID = "01890000-0000-7000-8000-000000000020";
const ITEM_DOCK_ID = "01890000-0000-7000-8000-000000000025";
const UOM_ID = "01890000-0000-7000-8000-000000000021";
const LINE_1_CLIENT_ID = "01890000-0000-7000-8000-000000000061";
const LINE_2_CLIENT_ID = "01890000-0000-7000-8000-000000000062";
const MISMATCH_ID = "01890000-0000-7000-8000-000000000077";

function reply(data: unknown, replayed = false) {
  return { data, headers: new Headers(replayed ? { "Idempotency-Replayed": "true" } : {}) };
}

function apiError(status: number, code: string) {
  return new TenantApiClientError("Refused", {
    status,
    statusText: "Refused",
    headers: new Headers(),
    data: { code },
  });
}

function buildQuotationDetail(overrides: Partial<QuotationDetail> = {}): QuotationDetail {
  return {
    id: QUOTE_ID,
    version: 3,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    channelId: null,
    partyId: PARTY_ID,
    crmCustomerProfileId: null,
    customerEligibilitySource: "ACTIVE_COMMERCIAL_ACCOUNT",
    contactPartyId: null,
    currencyCode: "EGP",
    businessDate: "2026-11-14",
    lifecycleStatus: "DRAFT",
    approvalStatus: "NOT_REQUIRED",
    fulfillmentStatus: "UNPLANNED",
    billingStatus: "NOT_BILLED",
    grandTotal: "16660.00",
    documentNumber: null,
    draftReference: "RFQ-INITIAL",
    partySnapshot: { displayName: "Mersany Industrial Co." },
    createdBy: null,
    createdAt: "2026-11-14T01:00:00.000Z",
    updatedAt: "2026-11-14T01:00:00.000Z",
    currentRevisionId: REV_1_ID,
    acceptedRevisionId: null,
    revisions: [{
      id: REV_1_ID,
      revisionNumber: 1,
      status: "DRAFT",
      validUntil: "2099-11-30",
      subtotal: "17000.00",
      discountTotal: "340.00",
      grandTotal: "16660.00",
      pricingMode: "DISCOUNT",
      discountSnapshot: {
        pricing: { mode: "DISCOUNT", scope: "LINE", reason: "Bundle tier" },
        totals: { subtotal: "17000.00", discountTotal: "340.00", grandTotal: "16660.00", baseSubtotal: "17000.00", promotionSavings: "0.00" },
      },
      termsSnapshot: {
        paymentTermCode: "NET_45",
        incotermCode: "CIF",
        deliveryDays: 21,
        warrantyMonths: 24,
        customClause: "PRESERVE_CUSTOM_CLAUSE",
        grandTotal: "999999.99",
        subtotal: "888888.88",
      },
      sentAt: null,
      acceptedAt: null,
      rejectedAt: null,
      priceLockExpiresAt: null,
    }],
    currentLines: [
      {
        id: "01890000-0000-7000-8000-000000000031",
        clientLineId: LINE_1_CLIENT_ID,
        printLineNumber: 1,
        descriptionSnapshot: "Wireless Headset Pro",
        quantity: "2",
        uomId: UOM_ID,
        unitPrice: "2400.00",
        discountTotal: "240.00",
        lineTotal: "4560.00",
        discountSnapshot: { itemId: ITEM_HEADSET_ID, discount: { type: "PERCENT", value: "5" } },
      },
      {
        id: "01890000-0000-7000-8000-000000000032",
        clientLineId: LINE_2_CLIENT_ID,
        printLineNumber: 2,
        descriptionSnapshot: "USB-C Dock Station",
        quantity: "4",
        uomId: UOM_ID,
        unitPrice: "3050.00",
        discountTotal: "100.00",
        lineTotal: "12100.00",
        discountSnapshot: { itemId: ITEM_DOCK_ID, discount: { type: "AMOUNT", value: "100" } },
      },
    ],
    ...overrides,
  };
}

function buildRevisionInput(termsSnapshot: Record<string, unknown>, validUntil = "2099-12-31"): QuotationRevisionInput {
  const hydrated = hydrateQuotationTerms(termsSnapshot);
  return {
    validUntil,
    lines: [
      { clientLineId: LINE_1_CLIENT_ID, itemId: ITEM_HEADSET_ID, uomId: UOM_ID, quantity: "2", discount: { type: "PERCENT", value: "5" } },
      { clientLineId: LINE_2_CLIENT_ID, itemId: ITEM_DOCK_ID, uomId: UOM_ID, quantity: "4", discount: { type: "AMOUNT", value: "100" } },
    ],
    pricing: { mode: "DISCOUNT", scope: "LINE", reason: "Bundle tier" },
    expectedPricingFingerprint: "a".repeat(64),
    terms: buildSanitizedQuotationTerms({
      paymentTermCode: hydrated.paymentTermCode,
      incotermCode: hydrated.incotermCode,
      deliveryDays: Number(hydrated.deliveryDays),
      warrantyMonths: Number(hydrated.warrantyMonths),
      extraTerms: hydrated.extraTerms,
    }),
  };
}

function buildCommittedRevisionPayload(detail: QuotationDetail, grandTotal = "16150.00") {
  const rev1 = detail.revisions[0]!;
  const revision = {
    ...rev1,
    id: REV_2_ID,
    revisionNumber: 2,
    status: "DRAFT",
    validUntil: "2099-12-31",
    subtotal: "17000.00",
    discountTotal: "850.00",
    grandTotal,
    discountSnapshot: {
      pricing: { mode: "DISCOUNT", scope: "DOCUMENT", type: "AMOUNT", value: "850.00", reason: "Exec approval" },
      totals: { subtotal: "17000.00", discountTotal: "850.00", grandTotal, baseSubtotal: "17000.00", promotionSavings: "0.00" },
    },
    sentAt: null,
  };
  const lines = [
    { ...detail.currentLines[0]!, discountTotal: "240.00", lineTotal: "4560.00" },
    { ...detail.currentLines[1]!, discountTotal: "610.00", lineTotal: "11590.00" },
  ];
  return { revision, lines, wire: { ...revision, lines } };
}

function renderEditSave(overrides: Partial<QuotationEditSaveOptions> = {}) {
  return renderHook((props: QuotationEditSaveOptions) => useQuotationEditSave(props), {
    initialProps: {
      existingQuotation: buildQuotationDetail(),
      isEnabled: true,
      canUpdate: true,
      canSend: true,
      ...overrides,
    },
  });
}

describe("useQuotationEditSave production-path regressions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.user = { id: "01890000-0000-7000-8000-000000000090", isTenantOwner: true };
    auth.realtimeAuthGeneration = "tenant:session-a:01890000-0000-7000-8000-000000000090";
    toast.outcomeFromApi.mockReturnValue(false);
  });

  it("chains header PATCH into revision POST with sanitized terms, fences failed detail refresh, and converges on reload", async () => {
    const initial = buildQuotationDetail({ channelId: null });
    const patchedHeader: Quotation = { ...initial, version: 4, draftReference: "RFQ-COMBINED", contactPartyId: CONTACT_ID };
    const committed = buildCommittedRevisionPayload(initial);
    const refreshedDetail: QuotationDetail = {
      ...initial,
      ...patchedHeader,
      version: 5,
      currentRevisionId: REV_2_ID,
      grandTotal: committed.revision.grandTotal,
      revisions: [committed.revision, initial.revisions[0]!],
      currentLines: committed.lines,
    };

    tradePatchMock.mockResolvedValueOnce(reply(patchedHeader));
    tradePostMock.mockResolvedValueOnce(reply(committed.wire));
    tradeGetMock.mockRejectedValueOnce(apiError(403, "FORBIDDEN"));

    const onSaved = vi.fn();
    const onHeaderPatched = vi.fn();
    const { result } = renderEditSave({ existingQuotation: initial, onSaved });
    const patch = buildUpdateQuotationHeader({ draftReference: "  RFQ-COMBINED  ", contactPartyId: CONTACT_ID });
    const revisionInput = buildRevisionInput(initial.revisions[0]!.termsSnapshot);

    let completed = false;
    await act(async () => {
      completed = await result.current.saveExisting(patch, revisionInput, onHeaderPatched);
    });

    expect(completed).toBe(true);
    expect(onHeaderPatched).toHaveBeenCalledTimes(1);
    expect(onHeaderPatched).toHaveBeenCalledWith(expect.objectContaining({ version: 4, draftReference: "RFQ-COMBINED", contactPartyId: CONTACT_ID }));

    const patchHeaders = tradePatchMock.mock.calls[0]?.[2]?.headers as Record<string, string>;
    const revHeaders = tradePostMock.mock.calls[0]?.[2]?.headers as Record<string, string>;
    expect(patchHeaders["if-match"]).toBe('"3"');
    expect(revHeaders["if-match"]).toBe('"4"');
    expect(isUUIDv7(patchHeaders["x-idempotency-key"])).toBe(true);
    expect(revHeaders["x-idempotency-key"]).toBe(patchHeaders["x-idempotency-key"]);
    expect(patchHeaders[CHANNEL_SCOPE_HEADER]).toBeUndefined();
    expect(revHeaders[CHANNEL_SCOPE_HEADER]).toBeUndefined();

    const sentTerms = (tradePostMock.mock.calls[0]?.[1] as QuotationRevisionInput).terms;
    expect(sentTerms).toEqual({
      paymentTermCode: "NET_45",
      incotermCode: "CIF",
      deliveryDays: 21,
      warrantyMonths: 24,
      customClause: "PRESERVE_CUSTOM_CLAUSE",
    });
    expect(sentTerms.grandTotal).toBeUndefined();
    expect(sentTerms.subtotal).toBeUndefined();

    expect(result.current.confirmedQuotation).toMatchObject({
      version: 4,
      draftReference: "RFQ-COMBINED",
      contactPartyId: CONTACT_ID,
      currentRevisionId: REV_2_ID,
      grandTotal: "16150.00",
    });
    expect(result.current.isDetailsCurrent).toBe(false);
    expect(result.current.detailsError?.status).toBe(403);
    expect(result.current.canSendSaved).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();

    let blockedStaleWrite = true;
    await act(async () => {
      blockedStaleWrite = await result.current.saveExisting(null, revisionInput);
    });
    expect(blockedStaleWrite).toBe(false);
    expect(tradePostMock).toHaveBeenCalledTimes(1);

    tradeGetMock.mockResolvedValueOnce(reply(refreshedDetail));
    await act(async () => {
      await result.current.reloadExistingDetails();
    });
    expect(result.current.confirmedQuotation?.version).toBe(5);
    expect(result.current.isDetailsCurrent).toBe(true);
    expect(result.current.canSendSaved).toBe(true);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: QUOTE_ID, version: 5, currentRevisionId: REV_2_ID }));
  });

  it("retains confirmed PATCH header after definitive revision rejections and uses v4 with fresh keys on repeat retries", async () => {
    const initial = buildQuotationDetail({ channelId: CHANNEL_ID });
    const patchedHeader: Quotation = { ...initial, version: 4, draftReference: "RFQ-PARTIAL-CONFIRMED", contactPartyId: null };
    const committed = buildCommittedRevisionPayload(initial);
    const refreshedV5: QuotationDetail = {
      ...initial,
      ...patchedHeader,
      version: 5,
      currentRevisionId: REV_2_ID,
      grandTotal: committed.revision.grandTotal,
      revisions: [committed.revision, initial.revisions[0]!],
      currentLines: committed.lines,
    };

    tradePatchMock.mockResolvedValueOnce(reply(patchedHeader));
    tradePostMock
      .mockRejectedValueOnce(apiError(409, "TRADE.QUOTE.PRICING_CHANGED"))
      .mockRejectedValueOnce(apiError(422, "TRADE.QUOTE.DISCOUNT_CAP_EXCEEDED"))
      .mockResolvedValueOnce(reply(committed.wire));
    tradeGetMock.mockResolvedValueOnce(reply(refreshedV5));

    const onSaved = vi.fn();
    const onHeaderPatched = vi.fn();
    const { result } = renderEditSave({ existingQuotation: initial, onSaved });
    const patch = buildUpdateQuotationHeader({ draftReference: "RFQ-PARTIAL-CONFIRMED" });
    const revAttempt1 = buildRevisionInput(initial.revisions[0]!.termsSnapshot);

    let firstSaved = true;
    await act(async () => {
      firstSaved = await result.current.saveExisting(patch, revAttempt1, onHeaderPatched);
    });
    expect(firstSaved).toBe(false);
    expect(onHeaderPatched).toHaveBeenCalledTimes(1);
    expect(result.current.write.ambiguous).toBeNull();
    expect(result.current.write.isBlocked).toBe(false);
    expect(result.current.write.writeError?.code).toBe("TRADE.QUOTE.PRICING_CHANGED");
    expect(result.current.confirmedQuotation).toMatchObject({ version: 4, draftReference: "RFQ-PARTIAL-CONFIRMED" });
    expect(result.current.isDetailsCurrent).toBe(true);

    const revAttempt2 = { ...revAttempt1, expectedPricingFingerprint: "b".repeat(64) };
    let secondSaved = true;
    await act(async () => {
      secondSaved = await result.current.saveExisting(null, revAttempt2);
    });
    expect(secondSaved).toBe(false);
    expect(result.current.write.writeError?.code).toBe("TRADE.QUOTE.DISCOUNT_CAP_EXCEEDED");
    expect(result.current.confirmedQuotation?.version).toBe(4);
    expect(tradePatchMock).toHaveBeenCalledTimes(1);

    const revAttempt3 = { ...revAttempt2, expectedPricingFingerprint: "c".repeat(64) };
    let thirdSaved = false;
    await act(async () => {
      thirdSaved = await result.current.saveExisting(null, revAttempt3);
    });
    expect(thirdSaved).toBe(true);
    expect(tradePatchMock).toHaveBeenCalledTimes(1);
    expect(tradePostMock).toHaveBeenCalledTimes(3);

    const keys = tradePostMock.mock.calls.map((call) => (call[2]?.headers as Record<string, string>)["x-idempotency-key"]);
    expect(keys.every(isUUIDv7)).toBe(true);
    expect(new Set(keys).size).toBe(3);
    expect(tradePostMock.mock.calls.map((call) => (call[2]?.headers as Record<string, string>)["if-match"])).toEqual(['"4"', '"4"', '"4"']);
    expect(tradePostMock.mock.calls.every((call) => (call[2]?.headers as Record<string, string>)[CHANNEL_SCOPE_HEADER] === CHANNEL_ID)).toBe(true);
    expect(result.current.confirmedQuotation?.version).toBe(5);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it.each([
    [409, "GW.IDEM.IN_FLIGHT"],
    [409, "IDEMPOTENCY_REQUEST_PROCESSING"],
    [409, "TRADE.IDEMPOTENCY.IN_FLIGHT"],
    [503, "GW.UPSTREAM.UNAVAILABLE"],
    [0, "CLIENT_REQUEST_TIMEOUT"],
  ] as const)(
    "replays ambiguous second-phase HTTP %s %s with identical key, v4 If-Match, frozen payload, and scope without duplicate PATCH",
    async (status, code) => {
      const initial = buildQuotationDetail({ channelId: CHANNEL_ID });
      const patchedHeader: Quotation = { ...initial, version: 4, draftReference: "RFQ-AMBIGUOUS" };
      const committed = buildCommittedRevisionPayload(initial);
      const refreshedV5: QuotationDetail = {
        ...initial,
        ...patchedHeader,
        version: 5,
        currentRevisionId: REV_2_ID,
        grandTotal: committed.revision.grandTotal,
        revisions: [committed.revision, initial.revisions[0]!],
        currentLines: committed.lines,
      };

      tradePatchMock.mockResolvedValueOnce(reply(patchedHeader));
      tradePostMock
        .mockRejectedValueOnce(apiError(status, code))
        .mockRejectedValueOnce(apiError(503, "GW.UPSTREAM.UNAVAILABLE"))
        .mockResolvedValueOnce(reply(committed.wire, true));
      tradeGetMock.mockResolvedValueOnce(reply(refreshedV5));

      const { result } = renderEditSave({ existingQuotation: initial });
      const mutablePatch = { draftReference: "RFQ-AMBIGUOUS" };
      const mutableRevision = buildRevisionInput(initial.revisions[0]!.termsSnapshot);

      await act(async () => {
        await result.current.saveExisting(mutablePatch, mutableRevision);
      });

      const firstPending = result.current.write.ambiguous;
      expect(firstPending).not.toBeNull();
      expect(result.current.write.isBlocked).toBe(true);
      expect(result.current.canSendSaved).toBe(false);

      mutablePatch.draftReference = "MUTATED-PATCH";
      mutableRevision.lines[0]!.quantity = "999";
      mutableRevision.lines[0]!.discount!.value = "99";
      if (mutableRevision.pricing && "reason" in mutableRevision.pricing) {
        mutableRevision.pricing.reason = "MUTATED-REASON";
      }
      mutableRevision.terms.paymentTermCode = "MUTATED_TERM";

      await act(async () => {
        await result.current.saveExisting({ draftReference: "COMPETING" }, mutableRevision);
        await result.current.sendExisting();
        await result.current.reloadExistingDetails();
      });
      expect(tradePatchMock).toHaveBeenCalledTimes(1);
      expect(tradePostMock).toHaveBeenCalledTimes(1);
      expect(tradeGetMock).not.toHaveBeenCalled();

      await act(async () => {
        await firstPending?.retry();
      });
      expect(result.current.savingStep).toBe("idle");
      expect(result.current.write.ambiguous?.idempotencyKey).toBe(firstPending?.idempotencyKey);
      expect(tradePatchMock).toHaveBeenCalledTimes(1);
      expect(tradePostMock).toHaveBeenCalledTimes(2);

      await act(async () => {
        await result.current.write.ambiguous?.retry();
      });
      expect(tradePatchMock).toHaveBeenCalledTimes(1);
      expect(tradePostMock).toHaveBeenCalledTimes(3);
      expect(tradePostMock.mock.calls[1]).toEqual(tradePostMock.mock.calls[0]);
      expect(tradePostMock.mock.calls[2]).toEqual(tradePostMock.mock.calls[0]);
      expect((tradePostMock.mock.calls[2]?.[1] as QuotationRevisionInput).lines[0]?.quantity).toBe("2");
      expect((tradePostMock.mock.calls[2]?.[1] as QuotationRevisionInput).lines[0]?.discount?.value).toBe("5");
      expect((tradePostMock.mock.calls[2]?.[1] as QuotationRevisionInput).pricing).toMatchObject({ reason: "Bundle tier" });
      expect((tradePostMock.mock.calls[2]?.[1] as QuotationRevisionInput).terms.paymentTermCode).toBe("NET_45");
      expect((tradePostMock.mock.calls[2]?.[2]?.headers as Record<string, string>)["if-match"]).toBe('"4"');
      expect((tradePostMock.mock.calls[2]?.[2]?.headers as Record<string, string>)[CHANNEL_SCOPE_HEADER]).toBe(CHANNEL_ID);
      expect(result.current.write.ambiguous).toBeNull();
      expect(result.current.confirmedQuotation?.version).toBe(5);
      expect(result.current.isDetailsCurrent).toBe(true);
    },
  );

  it("enforces no-op, header-only save without extra GET, and SENT lifecycle header/supersede gates", async () => {
    const initial = buildQuotationDetail();
    const patchedHeader: Quotation = { ...initial, version: 4, contactPartyId: CONTACT_ID };
    tradePatchMock.mockResolvedValueOnce(reply(patchedHeader));

    const onSaved = vi.fn();
    const { result } = renderEditSave({ existingQuotation: initial, onSaved });

    let noopResult = true;
    await act(async () => {
      noopResult = await result.current.saveExisting(null, null);
    });
    expect(noopResult).toBe(false);
    expect(tradePatchMock).not.toHaveBeenCalled();
    expect(tradePostMock).not.toHaveBeenCalled();

    let headerSaved = false;
    await act(async () => {
      headerSaved = await result.current.saveExisting({ contactPartyId: CONTACT_ID }, null);
    });
    expect(headerSaved).toBe(true);
    expect(tradePatchMock).toHaveBeenCalledTimes(1);
    expect(tradePostMock).not.toHaveBeenCalled();
    expect(tradeGetMock).not.toHaveBeenCalled();
    expect(result.current.confirmedQuotation).toMatchObject({ version: 4, contactPartyId: CONTACT_ID });
    expect(result.current.isDetailsCurrent).toBe(true);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ version: 4, contactPartyId: CONTACT_ID }));

    const sentRev1 = { ...initial.revisions[0]!, status: "SENT", sentAt: "2026-11-14T02:00:00.000Z" };
    const sentQuote = buildQuotationDetail({ version: 6, lifecycleStatus: "SENT", documentNumber: "QT-000401", revisions: [sentRev1] });
    const committed = buildCommittedRevisionPayload(sentQuote);
    tradePostMock.mockResolvedValueOnce(reply(committed.wire));
    tradeGetMock.mockResolvedValueOnce(reply({
      ...sentQuote,
      version: 8, contactPartyId: CONTACT_ID,
      lifecycleStatus: "DRAFT",
      currentRevisionId: REV_2_ID,
      grandTotal: committed.revision.grandTotal,
      revisions: [committed.revision, sentRev1],
      currentLines: committed.lines,
    }));

    const sentHook = renderEditSave({ existingQuotation: sentQuote, canSend: true });
    const revInput = buildRevisionInput(sentRev1.termsSnapshot);
    await act(async () => {
      expect(await sentHook.result.current.saveExisting({ draftReference: "FORBIDDEN-ON-SENT" }, null)).toBe(false);
      expect(await sentHook.result.current.saveExisting(null, revInput)).toBe(false);
    });
    expect(tradePatchMock).toHaveBeenCalledTimes(1);
    expect(tradePostMock).not.toHaveBeenCalled();

    sentHook.rerender({ existingQuotation: sentQuote, isEnabled: true, canUpdate: true, canSend: false });
    await act(async () => {
      expect(await sentHook.result.current.saveExisting(null, revInput, undefined, true)).toBe(false);
    });
    sentHook.rerender({ existingQuotation: sentQuote, isEnabled: true, canUpdate: true, canSend: true });
    tradePatchMock.mockResolvedValueOnce(reply({
      ...sentQuote, lifecycleStatus: "DRAFT", version: 8, currentRevisionId: REV_2_ID, contactPartyId: CONTACT_ID,
    }));
    await act(async () => {
      expect(await sentHook.result.current.saveExisting({ contactPartyId: CONTACT_ID }, revInput, undefined, true)).toBe(true);
    });
    expect(tradePatchMock).toHaveBeenLastCalledWith(expect.any(String), { contactPartyId: CONTACT_ID },
      expect.objectContaining({ headers: expect.objectContaining({ "if-match": '"7"' }) }));
    expect(tradePostMock.mock.invocationCallOrder[0]).toBeLessThan(tradePatchMock.mock.invocationCallOrder[1]!);
    expect((tradePostMock.mock.calls[0]?.[2]?.headers as Record<string, string>)["if-match"]).toBe('"6"');
    expect(sentHook.result.current.confirmedQuotation?.lifecycleStatus).toBe("DRAFT");
    expect(sentHook.result.current.confirmedQuotation?.revisions).toHaveLength(2);
  });

  it.each(["id", "companyId", "branchId"] as const)(
    "rejects cross-scope %s mismatches on PATCH and detail refresh without corrupting confirmed state",
    async (field) => {
      const initial = buildQuotationDetail();
      const mismatchedHeader: Quotation = { ...initial, version: 4, [field]: MISMATCH_ID };
      tradePatchMock.mockResolvedValueOnce(reply(mismatchedHeader));

      const onSaved = vi.fn();
      const { result } = renderEditSave({ existingQuotation: initial, onSaved });
      const revInput = buildRevisionInput(initial.revisions[0]!.termsSnapshot);

      let patchMismatchSaved = true;
      await act(async () => {
        patchMismatchSaved = await result.current.saveExisting({ draftReference: "CROSS-SCOPE" }, revInput);
      });
      expect(patchMismatchSaved).toBe(false);
      expect(tradePostMock).not.toHaveBeenCalled();
      expect(result.current.confirmedQuotation?.[field]).toBe(initial[field]);
      expect(onSaved).not.toHaveBeenCalled();

      const committed = buildCommittedRevisionPayload(initial);
      tradePostMock.mockResolvedValueOnce(reply(committed.wire));
      tradeGetMock
        .mockResolvedValueOnce(reply({ ...initial, version: 4, [field]: MISMATCH_ID }))
        .mockResolvedValueOnce(reply({ ...initial, version: 4, [field]: MISMATCH_ID }));

      const refreshHook = renderEditSave({ existingQuotation: initial, onSaved });
      await act(async () => {
        await refreshHook.result.current.saveExisting(null, revInput);
      });
      expect(refreshHook.result.current.confirmedQuotation?.[field]).toBe(initial[field]);
      expect(refreshHook.result.current.confirmedQuotation?.currentRevisionId).toBe(REV_2_ID);
      expect(refreshHook.result.current.isDetailsCurrent).toBe(false);
      expect(refreshHook.result.current.canSendSaved).toBe(false);
      expect(refreshHook.result.current.detailsError).not.toBeNull();
      expect(onSaved).not.toHaveBeenCalled();

      await act(async () => {
        expect(await refreshHook.result.current.reloadExistingDetails()).toBeNull();
      });
      expect(refreshHook.result.current.isDetailsCurrent).toBe(false);
      expect(refreshHook.result.current.lockedHeaders).toEqual({
        [COMPANY_SCOPE_HEADER]: COMPANY_ID,
        [BRANCH_SCOPE_HEADER]: BRANCH_ID,
      });
    },
  );

  it("recovers from STALE_VERSION conflict via reloadExistingDetails and replays ambiguous sendExisting once", async () => {
    const initial = buildQuotationDetail();
    tradePatchMock
      .mockRejectedValueOnce(apiError(409, "TRADE.CONCURRENCY.STALE_VERSION"))
      .mockResolvedValueOnce(reply({ ...initial, version: 8, draftReference: "AFTER-RELOAD" }));
    tradeGetMock.mockResolvedValueOnce(reply({ ...initial, version: 7 }));

    const { result } = renderEditSave({ existingQuotation: initial });
    await act(async () => {
      expect(await result.current.saveExisting({ draftReference: "STALE-ATTEMPT" }, null)).toBe(false);
    });
    expect(result.current.versionConflict).toBe(true);

    await act(async () => {
      await result.current.reloadExistingDetails();
    });
    expect(result.current.versionConflict).toBe(false);
    expect(result.current.confirmedQuotation?.version).toBe(7);

    await act(async () => {
      expect(await result.current.saveExisting({ draftReference: "AFTER-RELOAD" }, null)).toBe(true);
    });
    expect((tradePatchMock.mock.calls[1]?.[2]?.headers as Record<string, string>)["if-match"]).toBe('"7"');
    expect(result.current.confirmedQuotation?.version).toBe(8);
    expect(result.current.canSendSaved).toBe(true);

    const sentHeader: Quotation = { ...initial, version: 9, lifecycleStatus: "SENT", documentNumber: "QT-000500", draftReference: "AFTER-RELOAD" };
    const sentDetail: QuotationDetail = { ...initial, ...sentHeader };
    tradePostMock
      .mockRejectedValueOnce(apiError(0, "NETWORK_ERROR"))
      .mockResolvedValueOnce(reply(sentHeader, true));
    tradeGetMock.mockResolvedValueOnce(reply(sentDetail));

    await act(async () => {
      await result.current.sendExisting();
    });
    expect(result.current.write.ambiguous).not.toBeNull();
    expect(result.current.canSendSaved).toBe(false);

    await act(async () => {
      await result.current.write.ambiguous?.retry();
    });
    expect(tradePostMock.mock.calls[1]).toEqual(tradePostMock.mock.calls[0]);
    expect((tradePostMock.mock.calls[1]?.[2]?.headers as Record<string, string>)["if-match"]).toBe('"8"');
    expect(result.current.confirmedQuotation?.lifecycleStatus).toBe("SENT");
    expect(result.current.confirmedQuotation?.version).toBe(9);
    expect(result.current.canSendSaved).toBe(false);
  });

  it("blocks ambiguous second-phase replay when actor session generation rotates mid-recovery", async () => {
    const initial = buildQuotationDetail();
    tradePatchMock.mockResolvedValueOnce(reply({ ...initial, version: 4, draftReference: "ACTOR-A-REF" }));
    tradePostMock.mockRejectedValueOnce(apiError(0, "NETWORK_ERROR"));

    const { result, rerender } = renderEditSave({ existingQuotation: initial });
    const revInput = buildRevisionInput(initial.revisions[0]!.termsSnapshot);

    await act(async () => {
      await result.current.saveExisting({ draftReference: "ACTOR-A-REF" }, revInput);
    });
    expect(result.current.write.ambiguous).not.toBeNull();
    expect(tradePatchMock).toHaveBeenCalledTimes(1);
    expect(tradePostMock).toHaveBeenCalledTimes(1);

    auth.user = { id: "01890000-0000-7000-8000-000000000091", isTenantOwner: false };
    auth.realtimeAuthGeneration = "tenant:session-b:01890000-0000-7000-8000-000000000091";
    rerender({ existingQuotation: initial, isEnabled: true, canUpdate: true, canSend: true });

    await act(async () => {
      await result.current.write.ambiguous?.retry();
    });
    expect(tradePatchMock).toHaveBeenCalledTimes(1);
    expect(tradePostMock).toHaveBeenCalledTimes(1);
    expect(result.current.write.ambiguous).not.toBeNull();
  });
});
