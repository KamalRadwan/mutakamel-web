// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { QuotationSavedReceipt, type QuotationSavedReceiptState } from "./QuotationSavedReceipt";
import { QuotationSaveStatus } from "./QuotationSaveStatus";
import { CATALOG_ITEM, CATALOG_UNIT, CREATED_HEADER, CUSTOMER_OPTION, DETAIL_WITH_REVISION, draftLine } from "../hooks/quotation-composer.test-fixtures";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("./QuotationContactDisplay", () => ({ QuotationContactDisplay: () => <span>Authorized contact lookup</span> }));

function composer(): QuotationSavedReceiptState {
  return { savedQuotation: { ...DETAIL_WITH_REVISION, revisions: [{ ...DETAIL_WITH_REVISION.revisions[0], termsSnapshot: { paymentTermCode: "NET_45", incotermCode: "FCA", deliveryDays: 21, warrantyMonths: 3 } }] }, selected: CUSTOMER_OPTION,
    lineDraft: { lines: [{ ...draftLine(), quantity: "999", unitPrice: "777" }], itemsById: { [CATALOG_ITEM.id]: { ...CATALOG_ITEM, localizedNames: { en: "Changed current name" } } }, uomsByItem: { [CATALOG_ITEM.id]: [CATALOG_UNIT] } } };
}

describe("saved quotation review surface", () => {
  afterEach(cleanup);

  it("keeps saved description and money authoritative while showing real cached code and unit", () => {
    render(<QuotationSavedReceipt composer={composer()} />);
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Industrial Valve")).toBeTruthy(); expect(table.getByText("VALVE-1")).toBeTruthy();
    expect(table.getByText("Each", { exact: false })).toBeTruthy();
    expect(table.queryByText("Changed current name")).toBeNull(); expect(table.queryByText("999")).toBeNull(); expect(table.queryByText("777")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull(); expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.getByText("NET_45")).toBeTruthy(); expect(screen.getByText("FCA")).toBeTruthy(); expect(screen.getByText(/2099/)).toBeTruthy();
  });

  it("falls back to the server description without exposing a raw item or UOM ID", () => {
    const state = composer(); state.lineDraft = { lines: [], itemsById: {}, uomsByItem: {} };
    render(<QuotationSavedReceipt composer={state} />);
    const table = screen.getByRole("table");
    expect(table.textContent).toContain("Industrial Valve"); expect(table.textContent).not.toContain(DETAIL_WITH_REVISION.currentLines[0].uomId);
    expect(within(table).queryByText("VALVE-1")).toBeNull();
  });

  it("does not display a guessed record version after a confirmed save whose detail read failed", () => {
    render(<QuotationSaveStatus composer={{ savedQuotation: DETAIL_WITH_REVISION, isDetailsCurrent: false }} />);
    expect(screen.getByRole("status").textContent).toContain(en.quotationExperience.versionUnverified);
    expect(screen.queryByText("v2")).toBeNull(); expect(screen.getByText("R1")).toBeTruthy();
  });

  it("does not synthesize saved terms or validity for a header-only quotation", () => {
    const state = composer(); state.savedQuotation = { ...CREATED_HEADER, revisions: [], currentLines: [] };
    render(<QuotationSavedReceipt composer={state} />);
    expect(screen.queryByText("NET_30")).toBeNull(); expect(screen.queryByText("NET_45")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull(); expect(screen.getByText(en.quotationExperience.noSavedLines)).toBeTruthy();
  });

  it("shows current create-contact metadata only when both saved contact and customer identity match", () => {
    const state = composer(); const contactId = "019f0000-0000-7000-8000-000000000052";
    state.savedQuotation = { ...DETAIL_WITH_REVISION, contactPartyId: contactId };
    state.selectedContact = { partyId: contactId, customerPartyId: DETAIL_WITH_REVISION.partyId, displayName: "Mona Hassan",
      relationshipType: "CONTACT_PERSON", relationshipLabel: null, isPrimary: true, email: null, mobile: null, phone: null };
    render(<QuotationSavedReceipt composer={state} />);
    expect(screen.getByText("Mona Hassan")).toBeTruthy(); expect(screen.queryByText("Authorized contact lookup")).toBeNull();
  });

  it.each(["customer", "contact"] as const)("does not display cached metadata for a different %s", (mismatch) => {
    const state = composer(); const contactId = "019f0000-0000-7000-8000-000000000052";
    state.savedQuotation = { ...DETAIL_WITH_REVISION, contactPartyId: contactId };
    state.selectedContact = { partyId: mismatch === "contact" ? "019f0000-0000-7000-8000-000000000053" : contactId,
      customerPartyId: mismatch === "customer" ? "019f0000-0000-7000-8000-000000000054" : DETAIL_WITH_REVISION.partyId,
      displayName: "Unrelated private name", relationshipType: "CONTACT_PERSON", relationshipLabel: null,
      isPrimary: true, email: null, mobile: null, phone: null };
    render(<QuotationSavedReceipt composer={state} />);
    expect(screen.getByText("Authorized contact lookup")).toBeTruthy(); expect(screen.queryByText("Unrelated private name")).toBeNull();
  });
});
