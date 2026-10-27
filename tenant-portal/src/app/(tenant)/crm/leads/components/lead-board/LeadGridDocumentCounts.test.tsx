// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar, type Dictionary } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { formatTemplate } from "@/lib/format/template";
import type { LeadDocumentCounts } from "../../lead-document-counts-contract";
import { LeadGridDocumentCounts } from "../lead-grid/LeadGridDocumentCounts";

let dictionary: Dictionary = en;
let lang: "en" | "ar" = "en";
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionary, lang }),
}));
afterEach(cleanup);

const partyId = "01900100-0000-7000-8000-000000000011";
const documents = [
  { kind: "opportunities", route: "crm/opportunities" },
  { kind: "quotations", route: "trade/quotations" },
  { kind: "salesOrders", route: "trade/sales-orders" },
  { kind: "invoices", route: "trade/invoices" },
] as const;

describe("LeadGridDocumentCounts baseline defaults", () => {
  it.each(["en", "ar"] as const)("renders missing counts as localized zero with counted accessible labels in %s", (language) => {
    lang = language;
    dictionary = language === "ar" ? ar : en;
    for (const counts of [undefined, { opportunities: null, quotations: null, salesOrders: null, invoices: null }]) {
      const { unmount } = render(<LeadGridDocumentCounts leadId="lead" partyId={partyId} counts={counts} />);
      for (const document of documents) {
        const name = formatTemplate(dictionary.crmLeadDetail.related.labelWithCount, {
          name: dictionary.crmLeadDetail.related.labels[document.kind], count: "0",
        });
        const link = screen.getByRole("link", { name });
        expect(link).toHaveAttribute("href", `/${document.route}?partyId=${partyId}`);
        expect(within(link).getByText("0")).toHaveClass("text-foreground");
        expect(within(link).queryByText("—")).toBeNull();
      }
      unmount();
    }
  });

  it("preserves supplied zero and positive counts", () => {
    lang = "en";
    dictionary = en;
    const counts: LeadDocumentCounts = { opportunities: 0, quotations: 3, salesOrders: 2, invoices: 1 };
    render(<LeadGridDocumentCounts leadId="lead" partyId={partyId} counts={counts} />);
    for (const document of documents) {
      const count = String(counts[document.kind]);
      const name = formatTemplate(en.crmLeadDetail.related.labelWithCount, {
        name: en.crmLeadDetail.related.labels[document.kind], count,
      });
      expect(within(screen.getByRole("link", { name })).getByText(count)).toHaveClass(
        count === "0" ? "text-foreground" : "text-primary",
      );
    }
  });
});
