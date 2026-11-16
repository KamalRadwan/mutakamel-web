// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { CreditDecision } from "../commercial-account-contract";
import { CreditPanel } from "./CreditPanel";

const mocks = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: dictionaries[mocks.lang],
    lang: mocks.lang,
    dir: mocks.lang === "ar" ? "rtl" : "ltr",
  }),
}));

afterEach(cleanup);

const decision: CreditDecision = {
  receiptId: "receipt",
  outcome: "ALLOW",
  reasonCode: "CREDIT_AVAILABLE",
  effectiveLimit: "100",
  exposureAmount: "99.996",
  proposedAmount: "0",
  remainingAmount: "0.004",
  currencyCode: "EGP",
  orderingHold: false,
  asOf: null,
  explanation: "",
};

function panelProps(value: CreditDecision | null) {
  return {
    canViewCredit: true,
    isSubmitting: false,
    decision: value,
    error: null,
    onEvaluate: vi.fn(),
    defaultCurrency: "EGP",
  };
}

describe("CreditPanel exact utilisation", () => {
  it.each(["en", "ar"] as const)("floors and clamps the displayed bar in %s", (lang) => {
    mocks.lang = lang;
    const cases = [
      ["100", "99.996", 99],
      ["100", "100", 100],
      ["100", "125", 100],
      ["100", "0", 0],
      ["100", "-1", 0],
      ["100", null, 0],
      ["9007199254740993.01", "9007199254740993.00", 99],
      ["0.00000003", "0.00000002", 66],
    ] as const;

    for (const [effectiveLimit, exposureAmount, expected] of cases) {
      const { unmount } = render(
        <CreditPanel {...panelProps({ ...decision, effectiveLimit, exposureAmount })} />,
      );
      const percentage = screen.getByText(`${expected}%`);
      const bar = percentage.parentElement?.parentElement?.querySelector("[style]");
      expect(bar).toHaveStyle({ width: `${expected}%` });
      unmount();
    }
  });

  it.each([null, "0", "-1"])("omits the bar for limit %s", (effectiveLimit) => {
    render(<CreditPanel {...panelProps({ ...decision, effectiveLimit })} />);
    expect(screen.queryByText(/^\d+%$/u)).not.toBeInTheDocument();
  });

  it("omits the bar before evaluation", () => {
    render(<CreditPanel {...panelProps(null)} />);
    expect(screen.queryByText(/^\d+%$/u)).not.toBeInTheDocument();
  });

  it.each(["en", "ar"] as const)("keeps grouped preset labels and exact submitted strings in %s", (lang) => {
    mocks.lang = lang;
    const props = panelProps(null);
    render(<CreditPanel {...props} />);
    for (const [label, amount] of [
      ["5,000", "5000"],
      ["25,000", "25000"],
      ["100,000", "100000"],
      ["250,000", "250000"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      fireEvent.click(screen.getByRole("button", { name: dictionaries[lang].trade.creditEvaluate }));
      expect(props.onEvaluate).toHaveBeenLastCalledWith(amount, "EGP");
    }
  });
});
