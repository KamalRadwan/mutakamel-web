// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { QuotationDraftNote } from "./QuotationDraftNote";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));

afterEach(cleanup);

describe("QuotationDraftNote receipt", () => {
  it("shows the partial-header receipt only for a partial create", () => {
    render(<QuotationDraftNote headerSaved />);
    expect(screen.getByText(en.quotationExperience.headerSaved)).toBeInTheDocument();
  });

  it("never shows the partial-header receipt for an existing saved draft", () => {
    render(<QuotationDraftNote headerSaved existingDraft />);
    expect(screen.queryByText(en.quotationExperience.headerSaved)).toBeNull();
    expect(screen.getByText(en.quotationExperience.draftSaved)).toBeInTheDocument();
  });

  it("shows not-saved for a fresh create", () => {
    render(<QuotationDraftNote headerSaved={false} />);
    expect(screen.getByText(en.quotationExperience.unsaved)).toBeInTheDocument();
  });
});
