// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { QuotationContactOption, QuotationPartyType } from "../quotation-contact-contract";
import { DETAIL_WITH_REVISION, HEADERS } from "./quotation-composer.test-fixtures";
import { useQuotationHeaderEditor } from "./useQuotationHeaderEditor";

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  contacts: { options: [] as QuotationContactOption[], partyType: "ORGANIZATION" as QuotationPartyType | null,
    search: "", setSearch: vi.fn(), isLoading: false, hasMore: false, loadMore: vi.fn(), error: null, retry: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn(() => false) },
}));
vi.mock("./useQuotationContacts", () => ({ useQuotationContacts: () => mocks.contacts }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/design-system", () => ({ useToast: () => mocks.toast }));
vi.mock("../../trade-api", () => ({ tradePatch: mocks.patch, tradeIfMatch: (version: number) => `"${version}"`, isTradeReplay: () => false }));
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: (error: unknown) => error instanceof Error ? { status: 0 } : error }));
const OLD_CONTACT = "019f0000-0000-7000-8000-000000000051";
const CONTACT: QuotationContactOption = { partyId: "019f0000-0000-7000-8000-000000000052", displayName: "Mona Hassan",
  relationshipType: "CONTACT_PERSON", relationshipLabel: "Sales contact", isPrimary: true,
  email: "mona@example.test", mobile: null, phone: null };
function setup(contactPartyId: string | null = OLD_CONTACT) {
  const options = { open: true, quotation: { ...DETAIL_WITH_REVISION, contactPartyId }, headers: { ...HEADERS },
    onOpenChange: vi.fn(), onSaved: vi.fn(async () => {}) };
  return { options, ...renderHook(() => useQuotationHeaderEditor(options)) };
}
beforeEach(() => { vi.clearAllMocks(); mocks.contacts.options = [CONTACT]; mocks.contacts.partyType = "ORGANIZATION"; mocks.patch.mockReset(); mocks.patch.mockResolvedValue({ data: {}, headers: new Headers(), status: 200 }); });
afterEach(cleanup);

describe("existing quotation header named contact editing", () => {
  it("omits an unchanged unknown contact while changing the draft reference", async () => {
    mocks.contacts.options = [];
    const { result, options } = setup();
    act(() => result.current.setDraftReference("  RFQ changed  "));
    expect(result.current.selectedContact).toBeNull(); expect(result.current.canSubmit).toBe(true);
    await act(async () => { await result.current.submit(); });
    expect(mocks.patch).toHaveBeenCalledWith(expect.any(String), { draftReference: "RFQ changed" }, expect.objectContaining({ headers: expect.objectContaining({ ...HEADERS, "if-match": '"2"' }) }));
    expect(options.onSaved).toHaveBeenCalledOnce(); expect(options.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("accepts a changed contact only from the authorized options and sends no unchanged reference", async () => {
    const { result } = setup();
    act(() => result.current.selectContact("019f0000-0000-7000-8000-000000000099"));
    expect(result.current.isDirty).toBe(false); expect(result.current.contactPartyId).toBe(OLD_CONTACT);
    act(() => result.current.selectContact(CONTACT.partyId));
    expect(result.current.selectedContact?.displayName).toBe("Mona Hassan");
    await act(async () => { await result.current.submit(); });
    expect(mocks.patch.mock.calls[0][1]).toEqual({ contactPartyId: CONTACT.partyId });
  });

  it("uses explicit null for None without clearing the unrelated draft reference", async () => {
    const { result } = setup(); act(() => result.current.selectContact(undefined));
    await act(async () => { await result.current.submit(); });
    expect(mocks.patch.mock.calls[0][1]).toEqual({ contactPartyId: null });
  });

  it("retains a real selected option across search result changes", async () => {
    const { result, rerender } = setup(); act(() => result.current.selectContact(CONTACT.partyId));
    mocks.contacts.options = []; rerender();
    expect(result.current.selectedContact?.partyId).toBe(CONTACT.partyId); expect(result.current.canSubmit).toBe(true);
    await act(async () => { await result.current.submit(); });
    expect(mocks.patch.mock.calls[0][1]).toEqual({ contactPartyId: CONTACT.partyId });
  });

  it("does not add a company contact to a PERSON customer", async () => {
    mocks.contacts.partyType = "PERSON"; const { result } = setup(null);
    act(() => result.current.selectContact(CONTACT.partyId));
    expect(result.current.contactPartyId).toBe("");
    act(() => result.current.setDraftReference("Ref only")); await act(async () => { await result.current.submit(); });
    expect(mocks.patch.mock.calls[0][1]).toEqual({ draftReference: "Ref only" });
  });

  it("retains the exact header payload/key/scope and fences edits/close after an unknown response", async () => {
    mocks.patch.mockRejectedValueOnce(new Error("Reply lost")).mockResolvedValueOnce({ data: {}, headers: new Headers(), status: 200 });
    const { result, options } = setup(); act(() => result.current.selectContact(CONTACT.partyId));
    await act(async () => { await result.current.submit(); });
    const pending = result.current.write.ambiguous!;
    expect(result.current.write.isBlocked).toBe(true);
    act(() => { result.current.setDraftReference("Must not replace the intent"); result.current.selectContact(undefined); result.current.changeOpen(false); });
    expect(options.onOpenChange).not.toHaveBeenCalled(); expect(result.current.contactPartyId).toBe(CONTACT.partyId);
    await act(async () => { await pending.retry(); });
    expect(mocks.patch.mock.calls[1]).toEqual(mocks.patch.mock.calls[0]); expect(options.onSaved).toHaveBeenCalledOnce();
  });

  it("blocks overlong references without changing or truncating the local entry", async () => {
    const { result } = setup(); const reference = "R".repeat(81);
    act(() => result.current.setDraftReference(reference)); expect(result.current.canSubmit).toBe(false);
    await act(async () => { await result.current.submit(); });
    expect(mocks.patch).not.toHaveBeenCalled(); expect(result.current.draftReference).toBe(reference);
  });
});
