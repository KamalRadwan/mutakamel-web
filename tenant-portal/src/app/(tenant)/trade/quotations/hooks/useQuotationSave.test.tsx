// @vitest-environment jsdom
import { apiError, reply, resetHarness, tradeGetMock, tradePostMock } from "./quotation-composer.test-harness";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CREATE_INPUT, CREATED_HEADER, DETAIL_WITH_REVISION, HEADERS, QUOTE_ID,
  REVISION_INPUT, REVISION_RESULT } from "./quotation-composer.test-fixtures";
import { useQuotationSave } from "./useQuotationSave";

function setup() {
  return renderHook(() => useQuotationSave({ headers: HEADERS, isEnabled: true,
    canCreate: true, canUpdate: true, canSend: true }));
}

describe("quotation confirmed writes and same-key recovery", () => {
  beforeEach(resetHarness);

  it("retains confirmed revision total and lines after a forbidden refresh without enabling send", async () => {
    tradePostMock.mockResolvedValueOnce(reply(CREATED_HEADER)).mockResolvedValueOnce(reply(REVISION_RESULT));
    tradeGetMock.mockRejectedValue(apiError(403, "FORBIDDEN"));
    const { result } = setup();
    await act(async () => { await result.current.save(CREATE_INPUT, REVISION_INPUT); });
    expect(result.current.savedQuotation?.grandTotal).toBe("35900.00");
    expect(result.current.savedQuotation?.currentLines).toEqual(DETAIL_WITH_REVISION.currentLines);
    expect(result.current.savedQuotation?.currentRevisionId).toBe(DETAIL_WITH_REVISION.currentRevisionId);
    expect(result.current.isDetailsCurrent).toBe(false);
    expect(result.current.detailsError?.status).toBe(403);
    expect(result.current.canSendSaved).toBe(false);
    expect(result.current.write.ambiguous).toBeNull();
    tradeGetMock.mockResolvedValue(reply(DETAIL_WITH_REVISION));
    await act(async () => { await result.current.reloadSavedDetails(); });
    expect(result.current.isDetailsCurrent).toBe(true);
    expect(result.current.canSendSaved).toBe(true);
    expect(tradePostMock).toHaveBeenCalledTimes(2);
  });

  it("replays an unknown revision with its exact key, body, version and scope without a second header", async () => {
    tradePostMock.mockResolvedValueOnce(reply(CREATED_HEADER))
      .mockRejectedValueOnce(apiError(0, "NETWORK_ERROR"))
      .mockResolvedValueOnce(reply(REVISION_RESULT, true));
    const { result } = setup();
    await act(async () => { await result.current.save(CREATE_INPUT, REVISION_INPUT); });
    expect(result.current.partialHeader?.id).toBe(QUOTE_ID);
    expect(result.current.write.ambiguous).not.toBeNull();
    expect(result.current.write.isBlocked).toBe(true);
    await act(async () => { await result.current.save(CREATE_INPUT, REVISION_INPUT); });
    expect(tradePostMock).toHaveBeenCalledTimes(2);
    await act(async () => { await result.current.write.ambiguous?.retry(); });
    expect(tradePostMock).toHaveBeenCalledTimes(3);
    expect(tradePostMock.mock.calls[2]).toEqual(tradePostMock.mock.calls[1]);
    expect(tradePostMock.mock.calls.filter(([path]) => String(path).endsWith("/quotations"))).toHaveLength(1);
    expect(result.current.write.ambiguous).toBeNull();
    expect(result.current.savedQuotation?.grandTotal).toBe("35900.00");
    expect(result.current.isDetailsCurrent).toBe(true);
    expect(result.current.partialHeader).toBeNull();
  });

  it.each([
    [409, "GW.IDEM.IN_FLIGHT"], [409, "IDEMPOTENCY_REQUEST_PROCESSING"],
    [409, "TRADE.IDEMPOTENCY.IN_FLIGHT"], [500, "GW.UPSTREAM.UNAVAILABLE"], [503, "GW.UPSTREAM.UNAVAILABLE"],
  ] as const)(
    "does not create a fresh header after an uncertain HTTP %s %s create response", async (status, code) => {
      tradePostMock.mockRejectedValueOnce(apiError(status, code))
        .mockRejectedValueOnce(apiError(status, code))
        .mockResolvedValueOnce(reply(CREATED_HEADER, true)).mockResolvedValueOnce(reply(REVISION_RESULT));
      const { result } = setup();
      await act(async () => { await result.current.save(CREATE_INPUT, REVISION_INPUT); });
      const pending = result.current.write.ambiguous!;
      expect(pending).not.toBeNull(); expect(result.current.write.isBlocked).toBe(true);
      expect(result.current.lockedHeaders).toEqual(HEADERS); expect(result.current.partialHeader).toBeNull();
      await act(async () => { await result.current.save({ ...CREATE_INPUT, draftReference: "Changed intent" }, REVISION_INPUT); });
      expect(tradePostMock).toHaveBeenCalledOnce();
      await act(async () => { await pending.retry(); });
      expect(result.current.write.isBlocked).toBe(true);
      expect(result.current.write.ambiguous?.idempotencyKey).toBe(pending.idempotencyKey);
      await act(async () => { await result.current.write.ambiguous?.retry(); });
      expect(tradePostMock.mock.calls[1]).toEqual(tradePostMock.mock.calls[0]);
      expect(tradePostMock.mock.calls[2]).toEqual(tradePostMock.mock.calls[0]);
      expect(tradePostMock.mock.calls[3]?.[0]).toBe(`/api/tenant/trade/v1/quotations/${QUOTE_ID}/revisions`);
      expect(tradePostMock).toHaveBeenCalledTimes(4);
      expect(result.current.savedQuotation?.id).toBe(QUOTE_ID);
      expect(result.current.savedQuotation?.grandTotal).toBe("35900.00");
      expect(result.current.write.ambiguous).toBeNull(); expect(result.current.isDetailsCurrent).toBe(true);
    },
  );

  it("replays an unknown send once and converges on the confirmed sent detail", async () => {
    tradePostMock.mockResolvedValueOnce(reply(CREATED_HEADER)).mockResolvedValueOnce(reply(REVISION_RESULT));
    const { result } = setup();
    await act(async () => { await result.current.save(CREATE_INPUT, REVISION_INPUT); });
    const sent = { ...DETAIL_WITH_REVISION, version: 3, lifecycleStatus: "SENT" };
    tradePostMock.mockRejectedValueOnce(apiError(0, "NETWORK_ERROR")).mockResolvedValueOnce(reply(sent, true));
    tradeGetMock.mockResolvedValue(reply(sent));
    await act(async () => { await result.current.sendSaved(); });
    expect(result.current.write.ambiguous).not.toBeNull();
    expect(result.current.canSendSaved).toBe(false);
    await act(async () => { await result.current.write.ambiguous?.retry(); });
    expect(tradePostMock.mock.calls[3]).toEqual(tradePostMock.mock.calls[2]);
    expect(result.current.savedQuotation?.lifecycleStatus).toBe("SENT");
    expect(result.current.savedQuotation?.version).toBe(3);
    expect(result.current.isDetailsCurrent).toBe(true);
    expect(result.current.write.ambiguous).toBeNull();
    expect(result.current.canSendSaved).toBe(false);
  });

  it("retains the partial header and conflict after a forbidden review, then adopts only the real server version", async () => {
    tradePostMock.mockResolvedValueOnce(reply(CREATED_HEADER))
      .mockRejectedValueOnce(apiError(409, "TRADE.CONCURRENCY.STALE_VERSION"));
    const { result } = setup();
    await act(async () => { await result.current.save(CREATE_INPUT, REVISION_INPUT); });
    expect(result.current.partialHeaderConflict).toBe(true);
    tradeGetMock.mockRejectedValueOnce(apiError(403, "FORBIDDEN"));
    await act(async () => { await result.current.reloadSavedDetails(); });
    expect(result.current.partialHeader?.version).toBe(1);
    expect(result.current.partialHeaderConflict).toBe(true);
    expect(result.current.savedQuotation).toBeNull();
    expect(result.current.detailsError?.status).toBe(403);
    tradeGetMock.mockResolvedValueOnce(reply({ ...DETAIL_WITH_REVISION, version: 7 }));
    await act(async () => { await result.current.reloadSavedDetails(); });
    expect(result.current.partialHeader?.version).toBe(7);
    expect(result.current.partialHeaderConflict).toBe(false);
    expect(result.current.savedQuotation).toBeNull();
    expect(result.current.detailsError).toBeNull();
    expect(tradeGetMock.mock.calls.at(-1)?.[1]).toMatchObject({ headers: HEADERS });
    expect(tradePostMock).toHaveBeenCalledTimes(2);
  });

  it("converges to the current server record when another actor already sent a partial draft", async () => {
    const { result } = setup();
    act(() => { result.current.restoreHeader(CREATED_HEADER, HEADERS); });
    tradeGetMock.mockResolvedValueOnce(reply({ ...DETAIL_WITH_REVISION, lifecycleStatus: "SENT", version: 4 }));
    await act(async () => { await result.current.reloadSavedDetails(); });
    expect(result.current.partialHeader).toBeNull();
    expect(result.current.savedQuotation?.lifecycleStatus).toBe("SENT");
    expect(result.current.savedQuotation?.version).toBe(4);
    expect(result.current.isDetailsCurrent).toBe(true);
    expect(result.current.canSendSaved).toBe(false);
    expect(tradePostMock).not.toHaveBeenCalled();
  });

  it.each(["id", "companyId", "branchId"] as const)(
    "refuses a refreshed %s mismatch while retaining the confirmed revision and disabling current-detail actions",
    async (field) => {
      tradePostMock.mockResolvedValueOnce(reply(CREATED_HEADER)).mockResolvedValueOnce(reply(REVISION_RESULT));
      tradeGetMock.mockResolvedValueOnce(reply({ ...DETAIL_WITH_REVISION,
        [field]: "01890000-0000-7000-8000-000000000077" }));
      const { result } = setup();
      await act(async () => { await result.current.save(CREATE_INPUT, REVISION_INPUT); });
      expect(result.current.savedQuotation?.id).toBe(QUOTE_ID);
      expect(result.current.savedQuotation?.companyId).toBe(CREATED_HEADER.companyId);
      expect(result.current.savedQuotation?.branchId).toBe(CREATED_HEADER.branchId);
      expect(result.current.savedQuotation?.grandTotal).toBe("35900.00");
      expect(result.current.savedQuotation?.currentLines).toEqual(DETAIL_WITH_REVISION.currentLines);
      expect(result.current.isDetailsCurrent).toBe(false);
      expect(result.current.canSendSaved).toBe(false);
      expect(result.current.detailsError).not.toBeNull();
      expect(result.current.write.ambiguous).toBeNull();
      tradeGetMock.mockResolvedValueOnce(reply(DETAIL_WITH_REVISION));
      await act(async () => { await result.current.reloadSavedDetails(); });
      expect(result.current.isDetailsCurrent).toBe(true);
      expect(result.current.canSendSaved).toBe(true);
    },
  );
});
