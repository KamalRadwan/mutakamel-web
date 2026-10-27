// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { Button } from "@/design-system";
import { runIdempotentWrite } from "@/lib/api/idempotent-write";
import { parseLeadConversionResponse } from "../lead-conversion-contract";
import { CONVERSION_IDS as ids, conversionLead, conversionReceipt } from "../__fixtures__/lead-conversion";
import { useLeadConvert } from "../hooks/useLeadConvert";
import type { LeadDetail } from "../../lead-contract";
import { LeadConvertModal } from "./LeadConvertModal";

const { locale } = vi.hoisted(() => ({ locale: { language: "en" as "en" | "ar" } }));
const dictionaries = { en, ar };
vi.mock("@/i18n/I18nContext", async (original) => ({
  ...await original<typeof import("@/i18n/I18nContext")>(),
  useI18n: () => ({ t: dictionaries[locale.language], lang: locale.language, dir: locale.language === "ar" ? "rtl" : "ltr" }),
}));
vi.mock("../hooks/useLeadConversionOptions", () => ({ useLeadConversionOptions: () => ({ pipelines: [], ownerOptions: [], loading: false, pipelinesFailed: false, usersFailed: false, canReadUsers: true }) }));
vi.mock("../../../shared/hooks/useCrmCreateCustomFields", () => ({ useCrmCreateCustomFields: () => ({ definitions: [], requiredFieldKeys: [], degraded: false, loading: false }) }));
vi.mock("@/lib/api/idempotent-write", async (original) => ({ ...await original<typeof import("@/lib/api/idempotent-write")>(), runIdempotentWrite: vi.fn() }));

function Harness({ lead }: { lead: LeadDetail }) {
  const state = useLeadConvert(lead, vi.fn(), true, null);
  return <I18nProvider><Button onClick={state.openModal}>Open conversion</Button><LeadConvertModal convert={state} /></I18nProvider>;
}
function open(lead = conversionLead) {
  render(<Harness lead={lead} />);
  fireEvent.click(screen.getByRole("button", { name: "Open conversion" }));
  return within(screen.getByRole("dialog", { name: dictionaries[locale.language].crmLeadConvert.title }));
}
function chooseType(modal: ReturnType<typeof within>, type: "INDIVIDUAL" | "CORPORATE") {
  const copy = dictionaries[locale.language];
  fireEvent.keyDown(modal.getByRole("combobox", { name: copy.crmLeadConvert.profileType }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: copy.crmCustomerProfiles.profileTypes[type] }));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); locale.language = "en"; });

describe("LeadConvertModal", () => {
  it.each(["en", "ar"] as const)("renders a centered Small dialog with correct defaults in %s", (language) => {
    locale.language = language;
    const modal = open();
    const copy = dictionaries[language];
    expect(screen.getByRole("dialog")).toHaveClass("max-w-[672px]");
    expect(modal.getByRole("combobox", { name: copy.crmLeadConvert.profileType })).toBeEnabled();
    expect(modal.getByRole("combobox", { name: copy.crmLeadConvert.profileType })).toHaveTextContent(copy.crmCustomerProfiles.profileTypes.CORPORATE);
    expect(modal.getByRole("switch", { name: copy.crmLeadConvert.newContact })).not.toBeChecked();
    expect(modal.getByRole("switch", { name: copy.crmLeadConvert.createOpportunity })).toBeDisabled();
    expect(modal.getByRole("radio", { name: copy.crmLeadConvert.keepLead })).toBeChecked();
    expect(modal.getByRole("radio", { name: copy.crmLeadConvert.deleteLead })).not.toBeChecked();
    expect(modal.queryByLabelText(copy.crmLeadConvert.contactFullName)).toBeNull();
    expect(modal.getByRole("button", { name: copy.crmLeadConvert.reviewTitle })).toHaveClass("h-(--size-control-sm)");
  });
  it("shows every new-contact field only after an explicit choice", () => {
    const modal = open();
    fireEvent.click(modal.getByRole("switch", { name: en.crmLeadConvert.newContact }));
    for (const label of [en.crmLeadConvert.contactFullName, en.crmLeadConvert.firstName, en.crmLeadConvert.lastName, en.crmLeadConvert.contactJobTitle, en.crmLeads.email]) {
      expect(modal.getByLabelText(label)).toHaveValue("");
    }
    fireEvent.click(modal.getByRole("button", { name: en.crmLeadConvert.addMethod }));
    expect(modal.getByRole("textbox", { name: /^Value/ })).toHaveAttribute("maxlength", "255");
    expect(modal.getByLabelText(en.crmLeadConvert.methodLabel)).toHaveAttribute("maxlength", "80");
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });
  it("reviews read-only before confirmation, then keeps the actual response links without another submit", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValue({ kind: "success", replayed: false, value: parseLeadConversionResponse(conversionReceipt(), ids.lead, false, true) });
    const modal = open();
    await act(async () => fireEvent.click(modal.getByRole("button", { name: en.crmLeadConvert.reviewTitle })));
    expect(modal.getByLabelText(en.crmLeads.name)).toBeDisabled();
    expect(modal.getByRole("combobox", { name: en.crmLeadConvert.profileType })).toBeDisabled();
    expect(modal.getByRole("button", { name: en.crmLeadConvert.backToForm })).toBeInTheDocument();
    expect(runIdempotentWrite).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(modal.getByRole("button", { name: en.crmLeadConvert.confirm })));
    expect(modal.getByRole("link", { name: en.crmLeadConvert.viewCustomer })).toHaveAttribute("href", `/crm/customer-profiles/${ids.customer}`);
    expect(modal.queryByRole("link", { name: en.crmLeadConvert.viewOpportunity })).toBeNull();
    expect(modal.queryByRole("button", { name: en.crmLeadConvert.confirm })).toBeNull();
    expect(runIdempotentWrite).toHaveBeenCalledOnce();
  });
  it.each(["en", "ar"] as const)("allows individual-to-company conversion with an explicit company name in %s", async (language) => {
    locale.language = language;
    const copy = dictionaries[language];
    const modal = open({ ...conversionLead, leadProfileType: "INDIVIDUAL", displayName: "Noura Saleh", companyName: null });
    expect(modal.getByRole("combobox", { name: copy.crmLeadConvert.profileType })).toHaveTextContent(copy.crmCustomerProfiles.profileTypes.INDIVIDUAL);
    chooseType(modal, "CORPORATE");
    expect(modal.getByRole("textbox", { name: copy.crmLeads.name })).toHaveValue("");
    expect(modal.getByRole("textbox", { name: copy.crmLeads.companyName })).toHaveValue("");
    await act(async () => fireEvent.click(modal.getByRole("button", { name: copy.crmLeadConvert.reviewTitle })));
    expect(modal.getByRole("textbox", { name: copy.crmLeads.companyName })).toHaveAttribute("aria-invalid", "true");
    expect(modal.getAllByText(copy.crmLeadConvert.serverErrors.LEAD_CONVERSION_COMPANY_NAME_REQUIRED).length).toBeGreaterThan(0);
    expect(runIdempotentWrite).not.toHaveBeenCalled();
    fireEvent.change(modal.getByRole("textbox", { name: copy.crmLeads.companyName }), { target: { value: "New Company" } });
    await act(async () => fireEvent.click(modal.getByRole("button", { name: copy.crmLeadConvert.reviewTitle })));
    expect(modal.getByRole("button", { name: copy.crmLeadConvert.confirm })).toBeInTheDocument();
  });
  it.each(["en", "ar"] as const)("uses the company lead's primary contact for an individual customer in %s", async (language) => {
    locale.language = language;
    const copy = dictionaries[language];
    const modal = open({ ...conversionLead, contacts: [{
      partyId: ids.party, relationshipId: null, displayName: "Noura Saleh", firstName: "Noura", lastName: "Saleh",
      honorificTitle: null, jobTitle: null, isPrimary: true, email: null, phones: [],
    }] });
    chooseType(modal, "INDIVIDUAL");
    expect(modal.queryByLabelText(copy.crmLeads.companyName)).toBeNull();
    expect(modal.queryByRole("switch", { name: copy.crmLeadConvert.newContact })).toBeNull();
    expect(modal.getByRole("textbox", { name: copy.crmLeads.name })).toHaveValue("");
    expect(modal.getByText(copy.crmLeadConvert.individualFromContact + ": Noura Saleh")).toBeInTheDocument();
    await act(async () => fireEvent.click(modal.getByRole("button", { name: copy.crmLeadConvert.reviewTitle })));
    expect(modal.getByRole("button", { name: copy.crmLeadConvert.confirm })).toBeInTheDocument();
  });
  it.each(["en", "ar"] as const)("translates missing-primary-contact validation in %s", async (language) => {
    locale.language = language;
    const copy = dictionaries[language];
    const modal = open();
    chooseType(modal, "INDIVIDUAL");
    await act(async () => fireEvent.click(modal.getByRole("button", { name: copy.crmLeadConvert.reviewTitle })));
    expect(modal.getByRole("combobox", { name: copy.crmLeadConvert.profileType })).toHaveAttribute("aria-invalid", "true");
    expect(modal.getAllByText(copy.crmLeadConvert.serverErrors.LEAD_CONVERSION_CONTACT_REQUIRED).length).toBeGreaterThan(0);
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });
  const conversionErrorCodes = ["LEAD_CONVERSION_COMPANY_NAME_REQUIRED", "LEAD_CONVERSION_CONTACT_REQUIRED",
    "LEAD_CONVERSION_CONTACT_INVALID", "LEAD_CONVERSION_INDIVIDUAL_FIELDS_INVALID", "PARTY_NOT_FOUND"] as const;
  it.each((["en", "ar"] as const).flatMap((language) => conversionErrorCodes.map((code) => ({ language, code }))))(
    "translates backend $code in $language", async ({ language, code }) => {
      locale.language = language;
      vi.mocked(runIdempotentWrite).mockResolvedValue({ kind: "failed", error: { status: code === "PARTY_NOT_FOUND" ? 404 : 422, code, message: "Raw backend detail" } });
      const modal = open();
      const copy = dictionaries[language];
      await act(async () => fireEvent.click(modal.getByRole("button", { name: copy.crmLeadConvert.reviewTitle })));
      await act(async () => fireEvent.click(modal.getByRole("button", { name: copy.crmLeadConvert.confirm })));
      expect(modal.getByText(copy.crmLeadConvert.serverErrors[code])).toBeInTheDocument();
      expect(modal.queryByText("Raw backend detail")).toBeNull();
    },
  );
  it("asks explicitly whether the converted lead is kept or removed", async () => {
    const modal = open();
    fireEvent.click(modal.getByRole("radio", { name: en.crmLeadConvert.deleteLead }));
    await act(async () => fireEvent.click(modal.getByRole("button", { name: en.crmLeadConvert.reviewTitle })));
    expect(modal.getByRole("radio", { name: en.crmLeadConvert.deleteLead })).toBeChecked();
    expect(modal.getByText(en.crmLeadConvert.deleteLeadHint)).toBeInTheDocument();
  });
  it("confirms that removing the lead preserves the converted customer", async () => {
    vi.mocked(runIdempotentWrite).mockResolvedValue({
      kind: "success",
      replayed: false,
      value: parseLeadConversionResponse(
        conversionReceipt(false, false),
        ids.lead,
        false,
        false,
      ),
    });
    const modal = open();
    fireEvent.click(modal.getByRole("radio", { name: en.crmLeadConvert.deleteLead }));
    await act(async () =>
      fireEvent.click(modal.getByRole("button", { name: en.crmLeadConvert.reviewTitle })),
    );
    await act(async () =>
      fireEvent.click(modal.getByRole("button", { name: en.crmLeadConvert.confirm })),
    );

    expect(modal.getByText(en.crmLeadConvert.successDescriptionDeleted)).toBeInTheDocument();
    expect(modal.getByRole("link", { name: en.crmLeadConvert.viewCustomer })).toHaveAttribute(
      "href",
      `/crm/customer-profiles/${ids.customer}`,
    );
  });
  it("guards dirty cancellation without sending a conversion", () => {
    const modal = open();
    fireEvent.change(modal.getByLabelText(en.crmLeads.name), { target: { value: "Draft name" } });
    fireEvent.click(modal.getByRole("button", { name: en.common.cancel }));
    const guard = within(screen.getByRole("alertdialog"));
    fireEvent.click(guard.getByRole("button", { name: en.common.discardConfirm }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(runIdempotentWrite).not.toHaveBeenCalled();
  });
});
