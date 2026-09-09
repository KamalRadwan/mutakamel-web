// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { createInvoiceReadFixture, createManualInvoiceReadFixture } from "../../../invoice-read.fixture";
import { parseInvoiceRead } from "../../../invoice-read";
const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[locale.lang], lang: locale.lang }) }));
vi.mock("@/i18n/useLanguage", async (original) => ({ ...await original<typeof import("@/i18n/useLanguage")>(), useLanguage: () => locale.lang, useDictionary: () => dictionaries[locale.lang] }));
const { InvoiceRetainedDetails } = await import("./InvoiceRetainedDetails");
afterEach(cleanup);
const parse = (value: ReturnType<typeof createInvoiceReadFixture> | ReturnType<typeof createManualInvoiceReadFixture>) =>
  parseInvoiceRead(value, { invoiceId: value.data.invoice.id, tenantId: value.data.invoice.tenantId });

describe("prepared retained invoice presentation", () => {
  it.each(["en", "ar"] as const)("shows source labels and saved selected IDs without payment or purchase controls in %s", (lang) => {
    locale.lang = lang;
    const copy = dictionaries[lang];
    const source = createInvoiceReadFixture();
    render(<InvoiceRetainedDetails view={parse(source)} />);
    expect(screen.getByText(copy.invoiceEvidence.notice)).toBeInTheDocument();
    expect(screen.getByText(copy.invoiceEvidence.status.APPLICATION)).toBeInTheDocument();
    expect(screen.getByText(copy.invoiceEvidence.status.ADDON)).toBeInTheDocument();
    expect(screen.getByText(source.data.lines[1].addonDefinitionVersionId!)).toBeInTheDocument();
    expect(screen.getAllByText(copy.invoiceEvidence.acceptedSeats)).toHaveLength(2);
    expect(screen.getAllByText(copy.subscriptionAddons.acceptedBreakdown).every((node) => node.tagName === "SUMMARY")).toBe(true);
    expect(screen.queryByText("APPLICATION")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay|purchase|شراء|دفع/i })).not.toBeInTheDocument();
    expect(screen.queryByText(copy.coreBilling.invoiceOutstanding)).not.toBeInTheDocument();
  });
  it("keeps four-place unit prices and renders missing historical identity without guessed labels", () => {
    locale.lang = "en";
    const { unmount } = render(<InvoiceRetainedDetails view={parse(createInvoiceReadFixture())} />);
    expect(screen.getByText("$2.1234")).toBeInTheDocument();
    unmount();
    render(<InvoiceRetainedDetails view={parse(createManualInvoiceReadFixture())} />);
    expect(screen.getByText(en.invoiceEvidence.notice)).toBeInTheDocument();
    expect(screen.getByText("Historical manual item")).toBeInTheDocument();
    expect(screen.getAllByText(en.invoiceEvidence.notRecorded)).toHaveLength(3);
    expect(screen.queryByText(en.invoiceEvidence.acceptedSeats)).not.toBeInTheDocument();
    expect(screen.queryByText(en.subscriptionAddons.acceptedBreakdown)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
