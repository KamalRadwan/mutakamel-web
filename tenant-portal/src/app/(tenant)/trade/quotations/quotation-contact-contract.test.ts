// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseQuotationCustomerPage } from "./quotation-contract";
import { parseQuotationContactPage, quotationContactOptionsPath, quotationContactMatchesCustomer } from "./quotation-contact-contract";
import { CONTACT_OPTION, CUSTOMER_OPTION, HANDOFF, HEADERS } from "./hooks/quotation-composer.test-fixtures";
import { readQuotationHandoff, writeQuotationHandoff } from "./quotation-composer-draft";

describe("quotation contact resource contract", () => {
  it("uses the documented bounded query without truncating Unicode codepoints or opaque cursors", () => {
    const cursor = "x".repeat(2048);
    const url = new URL(quotationContactOptionsPath(CUSTOMER_OPTION.partyId, ` ${"😀".repeat(121)} `, cursor), "http://test.local");
    expect(url.pathname).toBe("/api/tenant/trade/v1/quotations/contact-options");
    expect(url.searchParams.get("partyId")).toBe(CUSTOMER_OPTION.partyId);
    expect([...(url.searchParams.get("search") ?? "")]).toHaveLength(120);
    expect(url.searchParams.get("cursor")).toBe(cursor);
    expect(() => quotationContactOptionsPath(CUSTOMER_OPTION.partyId, "", "x".repeat(2049))).toThrow();
  });

  it("projects only declared contact fields and accepts the full 200-codepoint name", () => {
    const result = parseQuotationContactPage({ partyType: "ORGANIZATION", items: [{ ...CONTACT_OPTION, displayName: "😀".repeat(200), ignored: "not forwarded" }] });
    expect([...result.items[0].displayName]).toHaveLength(200);
    expect(result.items[0]).not.toHaveProperty("ignored");
    expect(result.nextCursor).toBeNull();
  });

  it("refuses malformed roles, absent nullable fields, invalid type and impossible person contact rows", () => {
    for (const payload of [
      { partyType: "ORGANIZATION", items: [{ ...CONTACT_OPTION, relationshipType: "UNKNOWN" }] },
      { partyType: "ORGANIZATION", items: [{ ...CONTACT_OPTION, mobile: undefined }] },
      { partyType: "PERSON", items: [CONTACT_OPTION] },
      { partyType: "UNKNOWN", items: [] },
      { partyType: "ORGANIZATION", items: [], nextCursor: null },
    ]) expect(() => parseQuotationContactPage(payload)).toThrow();
    expect(parseQuotationContactPage({ partyType: "PERSON", items: [] })).toEqual({ partyType: "PERSON", items: [], nextCursor: null });
    const { partyType: _partyType, ...oldCustomer } = CUSTOMER_OPTION;
    expect(() => parseQuotationCustomerPage({ items: [oldCustomer] })).toThrow();
  });

  it("binds selected contact metadata to the organization and keeps handoff strict", () => {
    const selectedContact = { ...CONTACT_OPTION, customerPartyId: CUSTOMER_OPTION.partyId };
    expect(quotationContactMatchesCustomer(CUSTOMER_OPTION, CONTACT_OPTION.partyId, selectedContact)).toBe(true);
    expect(quotationContactMatchesCustomer({ ...CUSTOMER_OPTION, partyType: "PERSON" }, CONTACT_OPTION.partyId, selectedContact)).toBe(false);
    expect(writeQuotationHandoff("contact-test-actor", { ...HANDOFF, contactPartyId: CONTACT_OPTION.partyId, selectedContact })).toBe(true);
    expect(readQuotationHandoff("contact-test-actor", HEADERS)?.selectedContact).toEqual(selectedContact);
    expect(writeQuotationHandoff("contact-test-actor", { ...HANDOFF, contactPartyId: CONTACT_OPTION.partyId,
      selectedContact: { ...selectedContact, customerPartyId: CONTACT_OPTION.partyId } })).toBe(false);
  });
});
