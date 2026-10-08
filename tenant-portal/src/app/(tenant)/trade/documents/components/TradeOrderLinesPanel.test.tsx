// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TradeOrderLinesPanel } from "./TradeOrderLinesPanel";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en" }),
}));

const line = {
  id: "0192f3a0-0000-7000-8000-000000000001",
  printLineNumber: 1,
  descriptionSnapshot: "Blue widget",
  deliveryDescriptionSnapshot: "Protect from heat",
  orderedQuantity: "2",
  unitPrice: "125",
  lineTotal: "278.5",
  taxSnapshot: { jurisdiction: "EG", rate: "14" },
};

afterEach(cleanup);

describe("TradeOrderLinesPanel", () => {
  it("renders captured descriptions and exposes tax evidence through a named disclosure", () => {
    render(
      <TradeOrderLinesPanel
        lines={[line]}
        currencyCode="EGP"
        secondaryDescriptionLabel={en.tradeDocuments.deliveryDescription}
        secondaryDescription={(entry) => entry.deliveryDescriptionSnapshot}
        emptyTitle={en.tradeDocuments.orderLinesEmpty}
        errorTitle={en.tradeDocuments.salesOrders.loadFailed}
      />,
    );

    expect(screen.getByRole("heading", { name: en.tradeDocuments.lines })).toBeVisible();
    expect(screen.getByText("Blue widget")).toBeVisible();
    expect(screen.getByText("Protect from heat")).toBeVisible();

    const disclosure = screen.getByText(en.tradeDocuments.taxEvidence, {
      selector: "summary",
    });
    expect(disclosure).toHaveAccessibleName(
      `${en.tradeDocuments.taxEvidence}: Blue widget`,
    );
    expect(disclosure.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(disclosure);
    expect(disclosure.closest("details")).toHaveAttribute("open");
    expect(
      screen.getByLabelText(`${en.tradeDocuments.taxEvidence}: Blue widget`, {
        selector: "pre",
      }),
    ).toHaveTextContent('"jurisdiction": "EG"');
  });
});
