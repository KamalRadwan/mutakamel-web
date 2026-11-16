// @vitest-environment jsdom
import { auth, lineDraftState, loadCurrenciesMock, renderComposer, reply, resetHarness, settle,
  tradeGetMock, tradePostMock } from "./quotation-composer.test-harness";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHANNEL_SCOPE_HEADER } from "../../trade-api";
import { COMPANY_SCOPE_HEADER, BRANCH_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { QUOTATION_HANDOFF_STORAGE_KEY, readQuotationHandoff, readQuotationReplacementCreateKey,
  writeQuotationHandoff } from "../quotation-composer-draft";
import { defaultQuotationDiscount } from "../quotation-discount-draft";
import { QUOTATIONS_PATH } from "../quotation-contract";
import { CATALOG_ITEM, CATALOG_UNIT, CREATED_HEADER, CUSTOMER_OPTION, HANDOFF, HEADERS,
  ITEM_ID, PARTY_ID, QUOTE_ID, REVISION_RESULT, draftLine } from "./quotation-composer.test-fixtures";

const actorAKey = `${QUOTATION_HANDOFF_STORAGE_KEY}:actor-a`;
const actorBKey = `${QUOTATION_HANDOFF_STORAGE_KEY}:actor-b`;
function renderHandoff(headers = HEADERS) {
  return renderComposer({ hydrateHandoff: true, headers });
}
function storedEnvelope() {
  writeQuotationHandoff("actor-a", HANDOFF);
  return JSON.parse(sessionStorage.getItem(actorAKey)!) as Record<string, unknown>;
}

describe("quotation composer actor and operating-scope handoff", () => {
  beforeEach(resetHarness);

  it("hydrates validated header fields, lines and catalogue cache once in the same actor/scope", async () => {
    writeQuotationHandoff("actor-a", HANDOFF);
    const first = renderHandoff();
    await settle();
    expect(first.result.current.selected).toEqual(CUSTOMER_OPTION);
    expect(first.result.current.currencyCode).toBe("SAR");
    expect(first.result.current.draftReference).toBe(HANDOFF.draftReference);
    expect(lineDraftState.restore).toHaveBeenCalledWith({
      lines: [{ ...draftLine(), unitPrice: null }],
      items: [CATALOG_ITEM], uomsByItem: { [ITEM_ID]: [CATALOG_UNIT] },
    });
    expect(sessionStorage.getItem(actorAKey)).toBeNull();
    first.unmount();
    const second = renderHandoff();
    expect(second.result.current.selected).toBeNull();
    expect(second.result.current.draftReference).toBe("");
  });

  it("never hydrates actor A's draft for actor B", () => {
    writeQuotationHandoff("actor-a", HANDOFF);
    const original = sessionStorage.getItem(actorAKey);
    auth.user = { id: "actor-b" };
    const { result } = renderHandoff();
    expect(result.current.selected).toBeNull();
    expect(result.current.draftReference).toBe("");
    expect(sessionStorage.getItem(actorAKey)).toBe(original);
    act(() => { result.current.saveHandoffSnapshot(); });
    expect(sessionStorage.getItem(actorBKey)).not.toBeNull();
    expect(sessionStorage.getItem(actorAKey)).toBe(original);
  });

  it("persists discount intent without persisting calculated pricing evidence", () => {
    const discount = { ...defaultQuotationDiscount(), mode: "DISCOUNT" as const, scope: "LINE" as const,
      reason: "Customer agreement", lineDiscounts: { [draftLine().clientLineId]: { type: "AMOUNT" as const, value: "25.5" } } };
    writeQuotationHandoff("actor-a", { ...HANDOFF, discount });
    const restored = readQuotationHandoff("actor-a", HEADERS);
    expect(restored?.discount).toEqual(discount);
    expect(JSON.stringify(restored)).not.toContain("fingerprint");
    expect(JSON.stringify(restored)).not.toContain("discountTotal");
  });

  it("discards discount intent that belongs to a line outside the handed-off draft", () => {
    const envelope = storedEnvelope();
    envelope.fields = { ...(envelope.fields as Record<string, unknown>), discount: {
      ...defaultQuotationDiscount(), mode: "DISCOUNT", scope: "LINE",
      lineDiscounts: { "01890000-0000-7000-8000-000000000077": { type: "PERCENT", value: "5" } } } };
    sessionStorage.setItem(actorAKey, JSON.stringify(envelope));
    expect(readQuotationHandoff("actor-a", HEADERS)).toBeNull();
  });

  it("writes a complete scoped actor draft for standalone hydration", async () => {
    lineDraftState.lines = [draftLine()]; lineDraftState.items = [CATALOG_ITEM];
    lineDraftState.uomsByItem = { [ITEM_ID]: [CATALOG_UNIT] };
    const writer = renderComposer({ isEnabled: false, hydrateHandoff: false });
    act(() => { writer.result.current.setDraftReference("Continue here"); writer.result.current.setCurrencyCode("SAR"); });
    act(() => { writer.result.current.saveHandoffSnapshot(); });
    expect(sessionStorage.getItem(QUOTATION_HANDOFF_STORAGE_KEY)).toBeNull();
    const envelope = JSON.parse(sessionStorage.getItem(actorAKey)!) as Record<string, unknown>;
    expect(envelope).toMatchObject({ format: 1, scope: HEADERS,
      lines: [{ clientLineId: draftLine().clientLineId, quantity: "10" }],
      items: [CATALOG_ITEM], units: { [ITEM_ID]: [CATALOG_UNIT] } });
    expect(JSON.stringify(envelope)).not.toContain("3590.00");
    writer.unmount();
    const reader = renderHandoff();
    await settle();
    expect(reader.result.current.draftReference).toBe("Continue here");
    expect(reader.result.current.currencyCode).toBe("SAR");
  });

  it.each([COMPANY_SCOPE_HEADER, BRANCH_SCOPE_HEADER, CHANNEL_SCOPE_HEADER])(
    "discards a handoff for another %s",
    (scopeKey) => {
      writeQuotationHandoff("actor-a", HANDOFF);
      const { result } = renderHandoff({ ...HEADERS, [scopeKey]: "01890000-0000-7000-8000-000000000077" });
      expect(result.current.selected).toBeNull();
      expect(result.current.draftReference).toBe("");
      expect(lineDraftState.restore).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(actorAKey)).toBeNull();
    },
  );

  it.each(["{invalid", "null", "[]", JSON.stringify({ selected: CUSTOMER_OPTION })])(
    "discards malformed or former header-only data %s", (raw) => {
      sessionStorage.setItem(actorAKey, raw);
      const { result } = renderHandoff();
      expect(result.current.selected).toBeNull();
      expect(result.current.draftReference).toBe("");
      expect(sessionStorage.getItem(actorAKey)).toBeNull();
    },
  );

  it.each([
    { currencyCode: 42 },
    { extra: true },
    { selected: { ...CUSTOMER_OPTION, quotationSelectable: "true" } },
    { selected: { ...CUSTOMER_OPTION, partyId: "invalid" } },
    { selected: { ...CUSTOMER_OPTION, extra: true } },
  ])("discards malformed stored fields %j", (patch) => {
    const envelope = storedEnvelope();
    envelope.fields = { ...(envelope.fields as Record<string, unknown>), ...patch };
    sessionStorage.setItem(actorAKey, JSON.stringify(envelope));
    const { result } = renderHandoff();
    expect(result.current.selected).toBeNull();
    expect(result.current.draftReference).toBe("");
    expect(sessionStorage.getItem(actorAKey)).toBeNull();
  });

  it.each([-31 * 60_000, 10_000])("discards expired or future-dated envelopes %s", (offset) => {
    const envelope = storedEnvelope(); envelope.createdAt = Date.now() + offset;
    sessionStorage.setItem(actorAKey, JSON.stringify(envelope));
    expect(renderHandoff().result.current.selected).toBeNull();
  });

  it("discards the former unscoped entry without hydrating it", () => {
    sessionStorage.setItem(QUOTATION_HANDOFF_STORAGE_KEY, JSON.stringify(HANDOFF));
    const { result } = renderHandoff();
    expect(result.current.selected).toBeNull();
    expect(sessionStorage.getItem(QUOTATION_HANDOFF_STORAGE_KEY)).toBeNull();
  });

  it("does not read or write a handoff without an authenticated actor", () => {
    writeQuotationHandoff("actor-a", HANDOFF);
    const original = sessionStorage.getItem(actorAKey); auth.user = null;
    const { result } = renderHandoff();
    expect(result.current.selected).toBeNull();
    act(() => { result.current.saveHandoffSnapshot(); });
    expect(sessionStorage.length).toBe(1);
    expect(sessionStorage.getItem(actorAKey)).toBe(original);
  });

  it("continues a handed-off confirmed header with a revision instead of a duplicate create", async () => {
    lineDraftState.lines = [draftLine()];
    writeQuotationHandoff("actor-a", { ...HANDOFF, currencyCode: "EGP", partialHeader: CREATED_HEADER });
    tradePostMock.mockResolvedValueOnce(reply(REVISION_RESULT));
    const { result } = renderComposer({ hydrateHandoff: true });
    await settle();
    expect(result.current.partialHeader?.id).toBe(QUOTE_ID);
    expect(loadCurrenciesMock).not.toHaveBeenCalled();
    await act(async () => { await result.current.submit(); });
    expect(tradePostMock).toHaveBeenCalledTimes(1);
    expect(tradePostMock.mock.calls[0]?.[0]).toBe(`/api/tenant/trade/v1/quotations/${QUOTE_ID}/revisions`);
    expect(result.current.mode).toBe("saved");
  });

  it("does not post the replacement revision when logout starts during create, before auth rerenders", async () => {
    const crmCustomerProfileId = "01890000-0000-7000-8000-000000000071";
    const replacementId = "01890000-0000-7000-8000-000000000072";
    const prospect = { ...CUSTOMER_OPTION, crmCustomerProfileId,
      commercialAccountStatus: "NONE", eligibilitySource: "CRM_PROFILE" };
    const source = { ...CREATED_HEADER, crmCustomerProfileId,
      customerEligibilitySource: "CRM_PROFILE", revisions: [], currentLines: [] };
    expect(writeQuotationHandoff("actor-a", {
      ...HANDOFF, selected: null, currencyCode: "EGP",
      replacementSource: { quotationId: QUOTE_ID, version: source.version, partyId: PARTY_ID,
        crmCustomerProfileId, displayName: prospect.displayName },
    })).toBe(true);
    lineDraftState.lines = [draftLine()];
    const get = tradeGetMock.getMockImplementation()!;
    tradeGetMock.mockImplementation((path: string) => path.includes("customer-options")
      ? Promise.resolve(reply({ items: [prospect] }))
      : path === `${QUOTATIONS_PATH}/${QUOTE_ID}` ? Promise.resolve(reply(source)) : get(path));
    const onSaved = vi.fn();
    const { result } = renderComposer({ hydrateHandoff: true, replacementQuoteId: QUOTE_ID, onSaved });
    await waitFor(() => expect(result.current.customers.options).toContainEqual(prospect));
    act(() => { result.current.selectCustomer(PARTY_ID); });
    await waitFor(() => expect(result.current.canSubmit).toBe(true));

    let finishCreate: (() => void) | undefined;
    tradePostMock.mockImplementationOnce(() => new Promise((resolve) => {
      finishCreate = () => resolve(reply({ ...source, id: replacementId }));
    })).mockResolvedValueOnce(reply(REVISION_RESULT));
    let save: Promise<boolean> | undefined;
    act(() => { save = result.current.submit(); });
    await waitFor(() => expect(finishCreate).toBeTypeOf("function"));

    // Logout holds readiness synchronously. The rendered user, generation and permissions still describe the old session.
    auth.readReadyProfileCommit.mockReturnValue(null);
    await act(async () => { finishCreate?.(); await save; });

    expect(tradePostMock.mock.calls.map(([path]) => path)).toEqual([QUOTATIONS_PATH]);
    const key = tradePostMock.mock.calls[0]?.[2]?.headers?.["x-idempotency-key"];
    expect(key).toEqual(expect.any(String));
    expect(readQuotationReplacementCreateKey("actor-a", HEADERS, QUOTE_ID)).toBe(key);
    expect(result.current.replacementReconciliation).toEqual({ kind: "confirmed", quotationId: replacementId, key });
    expect(onSaved).not.toHaveBeenCalled();
  });
});
