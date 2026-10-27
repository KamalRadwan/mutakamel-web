// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { LEADS_BULK_UPDATE_PATH } from "../lead-bulk-contract";
import type { LeadItem, LeadStage } from "../lead-list-contract";
import { useLeadCardWrites, useLeadQuickEditWrites } from "./useLeadCardWrites";
import type { LeadWriteOutcome } from "./useLeadMutations";
import { reportBulkLeadError, type LeadWriteContext } from "./useLeadMutations";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(), useToast: vi.fn(),
}));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { post: vi.fn(), patch: vi.fn() },
}));

const openStage: LeadStage = { id: "open-stage", nameAr: "", nameEn: "Open", flag: "NEW" };
const convertedStage: LeadStage = { id: "converted-stage", nameAr: "", nameEn: "Converted", flag: "CONVERTED" };
const open: LeadItem = {
  id: "01900100-0000-7000-8000-000000000001",
  partyId: "01900100-0000-7000-8000-000000000002",
  leadProfileType: "INDIVIDUAL", leadName: "Open lead", company: "", email: "",
  phone: "", phones: [], country: "", primaryContact: null,
  sourceNameAr: "", sourceNameEn: "", sourceIconUrl: null, stageId: openStage.id,
  ownerUserId: null, rating: 0, cardColor: null, owner: null, nextActivity: null,
  tags: [],
};
const converted: LeadItem = {
  ...open, id: "01900100-0000-7000-8000-000000000003", stageId: convertedStage.id,
};

function context(items: LeadItem[] = [open, converted]) {
  return {
    branchId: "01900100-0000-7000-8000-000000000004",
    items, stages: [openStage, convertedStage],
    capabilities: { create: null, update: { scope: "all", ownerUserIds: null }, delete: null },
    setError: vi.fn(), report: vi.fn(), reconcile: vi.fn().mockResolvedValue(true),
    setItems: vi.fn<(update: (current: LeadItem[]) => LeadItem[]) => void>(),
  } satisfies LeadWriteContext & {
    setItems: (update: (current: LeadItem[]) => LeadItem[]) => void;
  };
}

beforeEach(() => vi.clearAllMocks());

describe("converted lead field writes", () => {
  it("skips converted leads in a mixed bulk rating selection", async () => {
    const options = context();
    const { result } = renderHook(() => useLeadCardWrites(options));
    await act(async () => {
      expect(await result.current.bulkUpdateLeads([open.id, converted.id], { rating: 3 })).toBe(true);
    });
    expect(axiosClient.post).toHaveBeenCalledExactlyOnceWith(
      LEADS_BULK_UPDATE_PATH,
      { branchId: options.branchId, leadIds: [open.id], rating: 3 },
      expect.any(Object),
    );
    expect(options.reconcile).toHaveBeenCalledOnce();
  });

  it("sends no request when every selected lead is converted", async () => {
    const { result } = renderHook(() => useLeadCardWrites(context()));
    expect(await result.current.bulkUpdateLeads([converted.id], { rating: 3 })).toBe(false);
    expect(axiosClient.post).not.toHaveBeenCalled();
  });

  it("refuses stars, colour and inline edits even for board targets outside the list", async () => {
    const options = context([]);
    const { result } = renderHook(() => useLeadCardWrites(options));
    await result.current.updateLeadCard(converted.id, { rating: 3 }, converted);
    await result.current.updateLeadCard(converted.id, { cardColor: null }, converted);
    expect(await result.current.updateLeadInline(converted.id, { displayName: "Changed" }, converted)).toMatchObject({ kind: "blocked" });
    expect(axiosClient.patch).not.toHaveBeenCalled();
    expect(options.setItems).not.toHaveBeenCalled();
    expect(options.setError).toHaveBeenCalledWith(en.crmLeads.messages.cardNotPermitted);
  });

  it("retains owner capability restrictions for open leads", async () => {
    const options = { ...context(), capabilities: null };
    const { result } = renderHook(() => useLeadCardWrites(options));
    expect(await result.current.bulkUpdateLeads([open.id], { rating: 3 })).toBe(false);
    await result.current.updateLeadCard(open.id, { rating: 3 });
    expect(axiosClient.post).not.toHaveBeenCalled();
    expect(axiosClient.patch).not.toHaveBeenCalled();
  });

  it("reloads and identifies a lead converted since the last read", async () => {
    const error = new TenantApiClientError("Lead was already converted.", {
      status: 409, statusText: "Conflict", headers: new Headers(),
      data: { code: "LEAD_ALREADY_CONVERTED", details: { leadId: open.id } },
    });
    vi.mocked(axiosClient.post).mockRejectedValueOnce(error);
    const options = context();
    const { result } = renderHook(() => useLeadCardWrites(options));
    expect(await result.current.bulkUpdateLeads([open.id], { rating: 3 })).toBe(false);
    expect(options.reconcile).toHaveBeenCalledOnce();
    expect(options.report).toHaveBeenCalledWith(
      error,
      en.crmLeads.messages.cardUpdateFailed,
      open.id,
    );
  });
});

describe("bulk lead error details", () => {
  it.each([undefined, null, { leadId: 42 }, { leadId: "" }])("preserves the original error for invalid details %j", (details) => {
    const error = new TenantApiClientError("Refused", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: { details },
    });
    const report = vi.fn();
    reportBulkLeadError(error, "Failed", report);
    expect(report).toHaveBeenCalledWith(error, "Failed");
  });
});


describe("inline lead write outcomes", () => {
  it("sends the loaded timestamp and preserves an explicitly captured draft baseline", async () => {
    const loaded = { ...open, updatedAt: "2026-10-26T10:00:00.123Z" };
    const options = context([loaded]);
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: {}, status: 200, statusText: "OK", headers: new Headers() });
    const { result } = renderHook(() => useLeadCardWrites(options));
    await act(async () => { await result.current.updateLeadInline(open.id, { description: "Next" }); });
    expect(axiosClient.patch).toHaveBeenLastCalledWith(expect.any(String), { description: "Next", expectedUpdatedAt: loaded.updatedAt }, expect.any(Object));
    const baseline = "2026-10-26T09:00:00.123Z";
    await act(async () => { await result.current.updateLeadInline(open.id, { description: "Draft", expectedUpdatedAt: baseline }); });
    expect(axiosClient.patch).toHaveBeenLastCalledWith(expect.any(String), { description: "Draft", expectedUpdatedAt: baseline }, expect.any(Object));
  });

  it.each([400, 403, 409, 422])("returns the normalized %s rejection to the modal", async (status) => {
    const caught = new TenantApiClientError("Refused", {
      status, statusText: "Refused", headers: new Headers(),
      data: { message: "Rejected", correlationId: "write-reference", details: { rating: ["Invalid rating"] } },
    });
    vi.mocked(axiosClient.patch).mockRejectedValueOnce(caught);
    const options = context();
    const { result } = renderHook(() => useLeadCardWrites(options));
    const outcome = await result.current.updateLeadInline(open.id, { rating: 3 });
    expect(outcome).toMatchObject({ kind: "failed", error: {
      status, correlationId: "write-reference", fieldErrors: { rating: ["Invalid rating"] },
    } });
    expect(options.report).toHaveBeenCalledWith(caught, en.crmLeads.messages.cardUpdateFailed);
    expect(options.reconcile).not.toHaveBeenCalled();
  });

  it("returns success after reconciling and preserves uncertainty on a network failure", async () => {
    const options = context();
    const { result } = renderHook(() => useLeadCardWrites(options));
    vi.mocked(axiosClient.patch).mockResolvedValueOnce({ data: {}, status: 200, statusText: "OK", headers: new Headers() });
    expect(await result.current.updateLeadInline(open.id, { rating: 3 })).toEqual({ kind: "success" });
    vi.mocked(axiosClient.patch).mockRejectedValueOnce(new TypeError("Lost connection"));
    expect(await result.current.updateLeadInline(open.id, { rating: 2 })).toMatchObject({ kind: "ambiguous", error: { status: 0 } });
    expect(options.reconcile).toHaveBeenCalledTimes(2);
  });
});

describe("quick-edit write lifetime", () => {
  it("keeps a new write pending when the selection reset is queued", async () => {
    let finish!: (outcome: LeadWriteOutcome) => void;
    const write = vi.fn(() => new Promise<LeadWriteOutcome>((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ lead }) => useLeadQuickEditWrites(lead, "branch"), { initialProps: { lead: open } });
    rerender({ lead: converted });
    let pending!: Promise<LeadWriteOutcome | null>;
    act(() => { pending = result.current.runWrite(write); });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.isPending).toBe(true);
    const duplicate = vi.fn();
    expect(await result.current.runWrite(duplicate)).toBeNull();
    expect(duplicate).not.toHaveBeenCalled();
    await act(async () => {
      finish({ kind: "blocked", message: "No longer permitted" });
      await pending;
    });
    expect(result.current.isPending).toBe(false);
    expect(result.current.message).toBe("No longer permitted");
  });

  it("serializes clicks and ignores a late refusal after navigating to another lead", async () => {
    let finish!: (outcome: LeadWriteOutcome) => void;
    const write = vi.fn(() => new Promise<LeadWriteOutcome>((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook(({ lead }) => useLeadQuickEditWrites(lead, "branch"), { initialProps: { lead: open } });
    let pending!: Promise<LeadWriteOutcome | null>;
    act(() => { pending = result.current.runWrite(write); });
    const duplicate = vi.fn();
    expect(await result.current.runWrite(duplicate)).toBeNull();
    expect(duplicate).not.toHaveBeenCalled();
    rerender({ lead: converted });
    await act(async () => { finish({ kind: "failed", error: { status: 422 } }); await pending; });
    expect(result.current.error).toBeNull();
    expect(result.current.isPending).toBe(false);
  });
});
