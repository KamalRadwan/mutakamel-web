// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { QuotationContactsState } from "../hooks/useQuotationContacts";
import { CONTACT_OPTION } from "../hooks/quotation-composer.test-fixtures";
import { QuotationContactPicker } from "./QuotationContactPicker";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
afterEach(cleanup);
function contacts(): QuotationContactsState {
  return { enabled: true, partyType: "ORGANIZATION", options: [CONTACT_OPTION], search: "", isLoading: false,
    error: null, hasMore: false, setSearch: vi.fn(), loadMore: vi.fn(), retry: vi.fn() };
}

describe("quotation contact people picker", () => {
  it("shows real names and provided identity details, submits option IDs and exposes None", () => {
    const onSelect = vi.fn();
    render(<QuotationContactPicker contacts={contacts()} selectedContact={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: en.quotationExperience.contactLabel }));
    expect(screen.getByRole("option", { name: en.quotationExperience.contactNone })).toBeVisible();
    expect(screen.getByText(CONTACT_OPTION.displayName)).toBeVisible();
    expect(screen.getByText(/contact@example\.test/u)).toBeVisible();
    expect(screen.queryByText(CONTACT_OPTION.partyId)).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: new RegExp(CONTACT_OPTION.displayName, "u") }));
    expect(onSelect).toHaveBeenCalledWith(CONTACT_OPTION.partyId);
  });

  it("renders an explicit permission boundary without showing empty results or raw IDs", () => {
    render(<QuotationContactPicker contacts={{ ...contacts(), options: [], error: { status: 403 } }}
      selectedContact={null} selectedId={CONTACT_OPTION.partyId} onSelect={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(en.quotationExperience.contactsDenied);
    expect(screen.getByRole("button", { name: en.quotationExperience.contactLabel })).toHaveTextContent(en.quotationExperience.contactUnavailable);
    expect(screen.queryByText(en.quotationExperience.contactsEmpty)).toBeNull();
    expect(screen.queryByRole("button", { name: en.common.retry })).toBeNull();
    expect(screen.queryByText(CONTACT_OPTION.partyId)).toBeNull();
  });

  it("retains a known selected name during service failure and supports retry and explicit clearing", () => {
    const state = { ...contacts(), options: [], error: { status: 503 } };
    const onSelect = vi.fn();
    render(<QuotationContactPicker contacts={state} selectedContact={CONTACT_OPTION} onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: en.quotationExperience.contactLabel })).toHaveTextContent(CONTACT_OPTION.displayName);
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(state.retry).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: en.quotationExperience.contactClear }));
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });

  it("distinguishes an empty organization from a person, whose contact control is hidden", () => {
    const { rerender, container } = render(<QuotationContactPicker contacts={{ ...contacts(), options: [] }} selectedContact={null} onSelect={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(en.quotationExperience.contactsEmpty);
    rerender(<QuotationContactPicker contacts={{ ...contacts(), partyType: "PERSON", options: [] }} selectedContact={null} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
