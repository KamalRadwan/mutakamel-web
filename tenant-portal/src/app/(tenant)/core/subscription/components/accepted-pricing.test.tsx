// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { createSubscriptionFixture } from "../subscription-read.fixture";
const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[locale.lang], lang: locale.lang }) }));
vi.mock("@/i18n/useLanguage", async (loadOriginal) => {
  const original = await loadOriginal<typeof import("@/i18n/useLanguage")>();
  return { ...original, useLanguage: () => locale.lang, useDictionary: () => dictionaries[locale.lang] };
});
const { AcceptedPricingDetails } = await import("./AcceptedPricingDetails");
const { SubscriptionAddonSelections } = await import("./SubscriptionAddonSelections");
afterEach(cleanup);

describe("accepted-price presentation", () => {
  it.each(["en", "ar"] as const)("shows accepted evidence and independent capacity in %s", (language) => {
    locale.lang = language;
    const t = dictionaries[language];
    render(<SubscriptionAddonSelections view={createSubscriptionFixture().data} />);
    expect(screen.getByText(t.subscriptionAddons.acceptedBreakdown)).toBeInTheDocument();
    expect(screen.getByText(t.subscriptionAddons.separateSeats)).toBeInTheDocument();
    expect(screen.getByText(t.subscriptionAddons.projectionNotObserved)).toBeInTheDocument();
    expect(screen.getByText(t.applicationAccess.status.REVOKED)).toBeInTheDocument();
    expect(screen.queryByText("REVOKED")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
  it("uses a keyboard-operable disclosure and preserves sub-cent prices", () => {
    locale.lang = "en";
    render(<AcceptedPricingDetails pricing={{ billingCycle: "MONTHLY", currencyCode: "USD", recurringAmountUsd: "0.0010",  priceRevision: "a".repeat(64),
      breakdown: [{ minUsers: 1, maxUsers: null, chargedUsers: 10, unitPriceUsd: "0.0001", amountUsd: "0.0010" }] }} />);
    expect(screen.getByText(en.subscriptionAddons.acceptedBreakdown).tagName).toBe("SUMMARY");
    expect(screen.getByText("$0.0001")).toBeInTheDocument();
    expect(screen.getByText("$0.001")).toBeInTheDocument();
    expect(screen.getByText(en.subscriptionAddons.openEnded)).toBeInTheDocument();
  });
});
