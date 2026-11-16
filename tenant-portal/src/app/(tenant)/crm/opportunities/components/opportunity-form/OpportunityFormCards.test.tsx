// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { EMPTY_OPPORTUNITY_FORM } from "../../opportunity-write-contract";
import { OpportunityFormCards, type OpportunityFormCardsProps } from "./OpportunityFormCards";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/i18n/useLanguage", () => ({ useLanguage: () => "en", useDirection: () => "ltr", useDictionary: () => en }));

afterEach(cleanup);

function props(overrides: Partial<OpportunityFormCardsProps> = {}): OpportunityFormCardsProps {
  return {
    form: { ...EMPTY_OPPORTUNITY_FORM, title: "Annual service contract", amount: "125000.00", currencyCode: "EGP", importance: "0", customFields: {} },
    errors: {}, disabled: false, view: "fast", mode: "create", onFieldChange: vi.fn(), onBlur: vi.fn(),
    customers: { items: [], selectedLabel: "", isLoading: false, onSearch: vi.fn(), onSelect: vi.fn() },
    lookups: { owners: { items: [], isLoading: false, error: null, reload: vi.fn() }, customer: { contacts: [], sourceLeads: [], isLoading: false, error: null, reload: vi.fn() } },
    pipelines: [], selectableStages: [],
    customFields: { definitions: [
      { id: "reference", fieldKey: "purchase_reference", ownerType: "OPPORTUNITY", nameEn: "Purchase reference", nameAr: "مرجع الشراء", type: "TEXT", options: [], optionsCount: 0, isSearchable: false, isActive: true, sortOrder: 1, requirements: [] },
      { id: "sites", fieldKey: "sites", ownerType: "OPPORTUNITY", nameEn: "Site count", nameAr: "عدد المواقع", type: "NUMBER", options: [], optionsCount: 0, isSearchable: false, isActive: true, sortOrder: 2, requirements: [] },
    ], requiredFieldKeys: ["purchase_reference"] },
    ...overrides,
  };
}

describe("the shared opportunity form", () => {
  it("keeps required tenant fields in Fast create and labels above inputs", () => {
    render(<OpportunityFormCards {...props()} />);
    expect(screen.getByLabelText("Purchase reference *")).toBeRequired();
    expect(screen.queryByLabelText("Site count")).toBeNull();
    expect(screen.queryByText(en.crmOpportunityDetail.form.contactPerson)).toBeNull();
    const title = screen.getByLabelText(`${en.crmOpportunities.title} *`);
    expect(title).toHaveValue("Annual service contract");
    expect(title).toHaveAttribute("placeholder", "");
    expect(document.querySelector(`label[for="${title.id}"]`)).not.toHaveClass("sr-only");
    expect(screen.getByLabelText(en.crmOpportunityDetail.amount)).toHaveValue("125000.00");
    expect(screen.getAllByRole("radio", { name: /Set importance/ })).toHaveLength(3);
    expect(screen.queryByText(en.crmOpportunityDetail.create.placementDescription)).toBeNull();
  });

  it("shows all fields on Full view without changing entered values", () => {
    const model = props();
    const { rerender } = render(<OpportunityFormCards {...model} />);
    rerender(<OpportunityFormCards {...model} view="full" />);
    expect(screen.getByLabelText(`${en.crmOpportunities.title} *`)).toHaveValue(model.form.title);
    expect(screen.getByLabelText(en.crmOpportunityDetail.amount)).toHaveValue(model.form.amount);
    expect(screen.getByLabelText("Site count")).toBeInTheDocument();
    expect(screen.getByLabelText(en.crmOpportunityDetail.form.contactPerson)).toBeDisabled();
    expect(screen.getByLabelText(en.crmOpportunityDetail.create.probabilityPercent)).toBeInTheDocument();
    expect(model.onFieldChange).not.toHaveBeenCalled();
  });

  it("uses one clearable star value with zero represented by hollow stars", () => {
    const model = props();
    const { rerender } = render(<OpportunityFormCards {...model} />);
    const stars = screen.getAllByRole("radio", { name: /Set importance/ });
    expect(stars.every((star) => star.getAttribute("aria-checked") === "false")).toBe(true);
    fireEvent.click(stars[1]);
    expect(model.onFieldChange).toHaveBeenLastCalledWith("importance", "2");
    rerender(<OpportunityFormCards {...model} form={{ ...model.form, importance: "2" }} />);
    fireEvent.click(screen.getByRole("radio", { name: "Set importance to 0 of 3" }));
    expect(model.onFieldChange).toHaveBeenLastCalledWith("importance", "0");
  });

  it("keeps immutable saved relations and lifecycle changes out of ordinary inputs", () => {
    const model = props({ mode: "edit", view: "full", readonlyCustomer: <div>Customer account: Nile Engineering</div>,
      readonlyLead: <div>Source lead: Nile Engineering</div>, pipelineSlot: <button type="button">Transfer pipeline</button> });
    render(<OpportunityFormCards {...model} />);
    expect(screen.getByText("Customer account: Nile Engineering")).toBeInTheDocument();
    expect(screen.getByText("Source lead: Nile Engineering")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transfer pipeline" })).toBeInTheDocument();
    expect(screen.queryByLabelText(`${en.crmOpportunities.customer} *`)).toBeNull();
    expect(screen.queryByLabelText(`${en.crmOpportunities.pipeline} *`)).toBeNull();
    fireEvent.change(screen.getByLabelText(`${en.crmOpportunities.title} *`), { target: { value: "Renewal" } });
    expect(model.onFieldChange).toHaveBeenLastCalledWith("title", "Renewal");
  });

  it("fills the row with Tags & notes only after confirming there are no custom fields", () => {
    const model = props({ view: "full", customFields: { definitions: [], requiredFieldKeys: [] } });
    const { rerender } = render(<OpportunityFormCards {...model} />);
    expect(screen.getByRole("region", { name: en.crmOpportunityDetail.form.tagsNotes })).toHaveClass("lg:col-span-2");
    rerender(<OpportunityFormCards {...model} customFields={{ ...model.customFields, loading: true }} />);
    expect(screen.getByRole("region", { name: en.crmOpportunityDetail.form.tagsNotes })).not.toHaveClass("lg:col-span-2");
    rerender(<OpportunityFormCards {...model} customFields={{ ...model.customFields, degraded: true }} />);
    expect(screen.getByRole("region", { name: en.crmOpportunityDetail.form.tagsNotes })).not.toHaveClass("lg:col-span-2");
    rerender(<OpportunityFormCards {...model} customFields={props().customFields} />);
    expect(screen.getByRole("region", { name: en.crmOpportunityDetail.form.tagsNotes })).not.toHaveClass("lg:col-span-2");
  });

  it("resolves a preselected customer's name when the draft label starts empty", () => {
    const model = props({ customers: { items: [{ id: "customer", displayName: "Nile Engineering", profileType: "CORPORATE" }],
      selectedLabel: "", isLoading: false, onSearch: vi.fn(), onSelect: vi.fn() } });
    render(<OpportunityFormCards {...model} form={{ ...model.form, customerProfileId: "customer" }} />);
    expect(screen.getByLabelText(`${en.crmOpportunities.customer} *`)).toHaveTextContent("Nile Engineering");
  });
});
