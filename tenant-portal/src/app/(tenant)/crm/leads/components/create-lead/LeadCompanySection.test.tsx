// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { emptyCreateLeadForm } from "../../lead-create-contract";
import { LeadCompanySection } from "./LeadCompanySection";

afterEach(cleanup);

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  // The real English dictionary, so a missing key fails the test rather than
  // rendering as empty text.
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const companies = [
  {
    id: "018f0000-0000-7000-8000-000000000001",
    displayName: "Acme Trading",
    legalName: "Acme Trading LLC",
    organizationName: null,
    branchId: null,
  },
  {
    id: "018f0000-0000-7000-8000-000000000002",
    displayName: "Nile Foods",
    legalName: "Nile Foods for Import",
    organizationName: null,
    branchId: null,
  },
  {
    id: "018f0000-0000-7000-8000-000000000003",
    displayName: "Delta Logistics",
    legalName: null,
    organizationName: null,
    branchId: null,
  },
];

function renderSection(overrides: { existingCompanyPartyId?: string } = {}) {
  const onSelectCompany = vi.fn();
  const selectCompany = vi.fn().mockResolvedValue(undefined);
  render(
    <I18nProvider>
      <LeadCompanySection
        form={{ ...emptyCreateLeadForm("contact-1"), ...overrides }}
        errors={{}}
        options={{
          companies,
          contacts: [],
          selectedCompanyId: overrides.existingCompanyPartyId ?? null,
          isLoadingCompanies: false,
          isLoadingContacts: false,
          error: null,
          selectCompany,
          reset: vi.fn(),
        }}
        disabled={false}
        onSelectCompany={onSelectCompany}
        onFieldChange={vi.fn()}
        onPhoneChange={vi.fn()}
        onPhoneAdd={vi.fn()}
        onPhoneRemove={vi.fn()}
        onBlur={vi.fn()}
      />
    </I18nProvider>,
  );
  return { onSelectCompany, selectCompany };
}

const picker = () => screen.getByRole("button", { name: /Existing company/ });
const search = () => screen.getByRole("combobox");

describe("the existing-company picker", () => {
  it("searches the directory instead of scrolling it", async () => {
    // A branch's directory runs to hundreds of organizations, which is what a
    // plain Select could not answer.
    renderSection();
    fireEvent.click(picker());
    expect(screen.getByText("Acme Trading")).toBeInTheDocument();

    fireEvent.change(search(), { target: { value: "nile" } });
    await waitFor(() => expect(screen.queryByText("Acme Trading")).toBeNull());
    expect(screen.getByText("Nile Foods")).toBeInTheDocument();
  });

  it("finds a company by the legal name it is filed under", async () => {
    // The name on the tax card is not always the name people say.
    renderSection();
    fireEvent.click(picker());
    fireEvent.change(search(), { target: { value: "import" } });
    await waitFor(() => expect(screen.queryByText("Delta Logistics")).toBeNull());
    expect(screen.getByText("Nile Foods")).toBeInTheDocument();
  });

  it("keeps 'create a new company' reachable when nothing matches", async () => {
    // A search that finds nothing is exactly when the new-company route is the
    // answer; making the user clear the box to reach it would be backwards.
    renderSection();
    fireEvent.click(picker());
    fireEvent.change(search(), { target: { value: "no such company" } });
    await waitFor(() => expect(screen.queryByText("Acme Trading")).toBeNull());
    expect(screen.getByRole("option", { name: en.crmLeads.newCompany })).toBeInTheDocument();
  });

  it("hands the chosen company to both the form and the contacts loader", () => {
    const { onSelectCompany, selectCompany } = renderSection();
    fireEvent.click(picker());
    fireEvent.click(screen.getByText("Nile Foods"));

    expect(onSelectCompany).toHaveBeenCalledWith(companies[1].id, "Nile Foods");
    expect(selectCompany).toHaveBeenCalledWith(companies[1].id);
  });

  it("asks for a company name only on the new-company route", () => {
    // A directory company is already named by the picker. The box used to
    // repeat that name back read-only, under a note explaining it could not be
    // edited — the same answer twice, plus a sentence about why the second
    // copy was useless.
    renderSection();
    expect(screen.getByLabelText(new RegExp(en.crmLeads.companyName))).toBeInTheDocument();

    cleanup();
    renderSection({ existingCompanyPartyId: companies[0].id });
    expect(screen.queryByLabelText(new RegExp(en.crmLeads.companyName))).toBeNull();
    // And with it the legal name, the registration numbers and the phones,
    // which the server refuses on this route anyway.
    expect(screen.queryByLabelText(new RegExp(en.crmLeads.create.legalName))).toBeNull();
  });

  it("treats the new-company row as no company at all", () => {
    const { onSelectCompany, selectCompany } = renderSection({
      existingCompanyPartyId: companies[0].id,
    });
    fireEvent.click(picker());
    fireEvent.click(screen.getByRole("option", { name: en.crmLeads.newCompany }));

    // An empty id is what the create contract reads as "this lead brings its
    // own company", and the contacts loader is told to drop what it holds.
    expect(onSelectCompany).toHaveBeenCalledWith("", "");
    expect(selectCompany).toHaveBeenCalledWith(null);
  });
});
