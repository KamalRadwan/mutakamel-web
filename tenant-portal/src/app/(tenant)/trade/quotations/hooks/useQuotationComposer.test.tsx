// @vitest-environment jsdom
import { apiError, lineDraftState, loadCurrenciesMock, renderComposer, reply, resetHarness, settle,
  tradeGetMock, tradePostMock } from "./quotation-composer.test-harness";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CREATED_HEADER, CUSTOMER_OPTION, DETAIL_WITH_REVISION, PARTY_ID, QUOTE_ID,
  REVISION_RESULT, HEADERS, WORKSPACE_CURRENCIES, draftLine } from "./quotation-composer.test-fixtures";
import { useQuotationComposer } from "./useQuotationComposer";

describe("useQuotationComposer stay-open and two-step retry safety", () => {
  beforeEach(resetHarness);

  it("stays saved after header creation and resets only when explicitly asked", async () => {
    tradePostMock.mockResolvedValueOnce(reply(CREATED_HEADER));
    tradeGetMock.mockImplementation(async (path: string) => reply(path.includes("customer-options")
      ? { items: [CUSTOMER_OPTION] } : { ...CREATED_HEADER, revisions: [], currentLines: [] }));
    const onSaved = vi.fn();
    const { result } = renderComposer({ onSaved });
    await settle();
    act(() => { result.current.selectCustomer(PARTY_ID); result.current.setDraftReference("RFQ-2026"); });
    await act(async () => { await result.current.submit({ headerOnly: true }); });
    expect(result.current.mode).toBe("saved");
    expect(result.current.savedQuotation?.id).toBe(QUOTE_ID);
    expect(onSaved).toHaveBeenCalledTimes(1);
    act(() => { result.current.resetComposer(); });
    expect(result.current.mode).toBe("editing");
    expect(result.current.savedQuotation).toBeNull();
  });

  it("retains a confirmed header after revision refusal and never creates it twice", async () => {
    lineDraftState.lines = [draftLine()];
    let attempts = 0;
    tradePostMock.mockImplementation(async (path: string) => {
      if (path.endsWith("/quotations")) return reply(CREATED_HEADER);
      attempts += 1;
      if (attempts === 1) throw apiError(409);
      return reply(REVISION_RESULT);
    });
    const { result } = renderComposer();
    await settle();
    act(() => { result.current.selectCustomer(PARTY_ID); result.current.setValidUntil("2099-11-15"); });
    await act(async () => { await result.current.submit(); });
    expect(tradePostMock.mock.calls.filter(([path]) => String(path).endsWith("/quotations"))).toHaveLength(1);
    expect(attempts).toBe(1);
    expect(result.current.mode).toBe("editing");
    expect(result.current.partialHeader?.id).toBe(QUOTE_ID);
    await act(async () => { await result.current.submit(); });
    expect(tradePostMock.mock.calls.filter(([path]) => String(path).endsWith("/quotations"))).toHaveLength(1);
    expect(attempts).toBe(2);
    expect(result.current.mode).toBe("saved");
    expect(result.current.savedQuotation?.grandTotal).toBe(DETAIL_WITH_REVISION.grandTotal);
  });

  it("keeps loaded customer options when the Combobox opens with an empty search", async () => {
    const { result } = renderComposer();
    await settle();
    expect(result.current.customers.options).toHaveLength(1);
    act(() => { result.current.customers.setSearch(""); });
    expect(result.current.customers.options).toHaveLength(1);
    expect(result.current.customers.options[0]?.displayName).toBe(CUSTOMER_OPTION.displayName);
  });

  it.each(["0", "-1", "1.2.3", "1e2", "10000000000000000", "1.123456789"])(
    "refuses invalid quantity %s before creating a header",
    async (quantity) => {
      lineDraftState.lines = [{ ...draftLine(), quantity }];
      lineDraftState.invalidLineIndex = 0;
      const { result } = renderComposer();
      await settle();
      act(() => { result.current.selectCustomer(PARTY_ID); result.current.setValidUntil("2099-11-15"); });
      await act(async () => { await result.current.submit(); });
      expect(tradePostMock).not.toHaveBeenCalled();
      expect(result.current.partialHeader).toBeNull();
    },
  );

  it.each(["2000-01-01", "2099-02-29", "2099-11-15T23:00:00-12:00"])(
    "refuses invalid or past validity %s before creating a header",
    async (date) => {
      lineDraftState.lines = [draftLine()];
      const { result } = renderComposer();
      await settle();
      act(() => { result.current.selectCustomer(PARTY_ID); result.current.setValidUntil(date); });
      await act(async () => { await result.current.submit(); });
      expect(tradePostMock).not.toHaveBeenCalled();
      expect(result.current.partialHeader).toBeNull();
    },
  );

  it("saves header-only despite invalid local lines, dates and revision terms", async () => {
    lineDraftState.lines = [{ ...draftLine(), quantity: "0", uomId: "" }];
    lineDraftState.invalidLineIndex = 0;
    tradePostMock.mockResolvedValueOnce(reply(CREATED_HEADER));
    const { result } = renderComposer();
    await settle();
    act(() => {
      result.current.selectCustomer(PARTY_ID); result.current.setValidUntil("2000-01-01");
      result.current.setDeliveryDays("invalid");
    });
    await act(async () => { await result.current.submit({ headerOnly: true }); });
    expect(tradePostMock).toHaveBeenCalledTimes(1);
    expect(tradePostMock.mock.calls[0]?.[0]).toMatch(/\/quotations$/u);
    expect(result.current.mode).toBe("saved");
  });

  it("reviews a stale partial version without losing local lines and retries with that reviewed version", async () => {
    lineDraftState.lines = [draftLine()];
    tradePostMock.mockResolvedValueOnce(reply(CREATED_HEADER))
      .mockRejectedValueOnce(apiError(409, "TRADE.CONCURRENCY.STALE_VERSION"))
      .mockResolvedValueOnce(reply(REVISION_RESULT));
    const { result } = renderComposer();
    await settle();
    act(() => { result.current.selectCustomer(PARTY_ID); result.current.setValidUntil("2099-11-15"); });
    await act(async () => { await result.current.submit(); });
    expect(result.current.partialHeaderConflict).toBe(true);
    tradeGetMock.mockResolvedValueOnce(reply({ ...DETAIL_WITH_REVISION, version: 7 }));
    await act(async () => { await result.current.reloadSavedDetails(); });
    expect(result.current.lineDraft.lines).toEqual([draftLine()]);
    expect(lineDraftState.reset).not.toHaveBeenCalled();
    expect(lineDraftState.restore).not.toHaveBeenCalled();
    await act(async () => { await result.current.submit(); });
    expect(tradePostMock.mock.calls[2]?.[2]).toMatchObject({ headers: { "if-match": '"7"' } });
    expect(tradePostMock.mock.calls[2]?.[1]).toMatchObject({ lines: [{ quantity: "10" }] });
    expect(tradePostMock.mock.calls.filter(([path]) => String(path).endsWith("/quotations"))).toHaveLength(1);
  });

  it("blocks direct submission while the scope becomes unresolved and reenables when it resolves", async () => {
    const { result, rerender } = renderHook(({ enabled, headers }) => useQuotationComposer({
      headers, isEnabled: enabled, canCreate: true, canUpdate: true, canSend: true,
    }), { initialProps: { enabled: true, headers: HEADERS as Record<string, string> } });
    await settle();
    act(() => { result.current.selectCustomer(PARTY_ID); });
    expect(result.current.canSubmitHeaderOnly).toBe(true);
    rerender({ enabled: false, headers: {} });
    await act(async () => { await result.current.submit({ headerOnly: true }); });
    expect(result.current.canSubmitHeaderOnly).toBe(false);
    expect(tradePostMock).not.toHaveBeenCalled();
    rerender({ enabled: true, headers: HEADERS });
    await settle();
    expect(result.current.canSubmitHeaderOnly).toBe(true);
    expect(tradePostMock).not.toHaveBeenCalled();
  });

  it("defaults only from the active workspace currency list rather than inventing EGP", async () => {
    loadCurrenciesMock.mockResolvedValue([{ ...WORKSPACE_CURRENCIES[1]!, isDefault: true }]);
    const { result } = renderComposer();
    await waitFor(() => expect(result.current.currencyCode).toBe("USD"));
    expect(result.current.currencies.options.map((option) => option.value)).toEqual(["USD"]);
    expect(result.current.isDirty).toBe(false);
  });

  it("retains an unavailable user selection after refresh and blocks a new header", async () => {
    const { result } = renderComposer();
    await settle();
    act(() => { result.current.selectCustomer(PARTY_ID); result.current.setCurrencyCode("USD"); });
    loadCurrenciesMock.mockResolvedValue([{ ...WORKSPACE_CURRENCIES[0]!, code: "SAR", isDefault: true }]);
    act(() => { result.current.currencies.retry(); });
    await waitFor(() => expect(result.current.currencies.defaultCode).toBe("SAR"));
    expect(result.current.currencyCode).toBe("USD");
    expect(result.current.currencyUnavailable).toBe(true);
    expect(result.current.canSubmitHeaderOnly).toBe(false);
    await act(async () => { await result.current.submit({ headerOnly: true }); });
    expect(tradePostMock).not.toHaveBeenCalled();
  });

  it("keeps a fresh currency blank and refuses a typed code when the workspace has no active currency", async () => {
    loadCurrenciesMock.mockResolvedValue([]);
    const { result } = renderComposer();
    await settle();
    expect(result.current.currencyCode).toBe("");
    act(() => { result.current.selectCustomer(PARTY_ID); result.current.setCurrencyCode("EGP"); });
    await act(async () => { await result.current.submit({ headerOnly: true }); });
    expect(result.current.currencyUnavailable).toBe(true);
    expect(tradePostMock).not.toHaveBeenCalled();
  });
});
