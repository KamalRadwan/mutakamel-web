// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { createSubscriptionOffersFixture } from "../subscription-offers.fixture";
const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[locale.lang], lang: locale.lang }) }));
vi.mock("@/i18n/useLanguage", async (loadOriginal) => {
  const original = await loadOriginal<typeof import("@/i18n/useLanguage")>();
  return { ...original, useLanguage: () => locale.lang, useDictionary: () => dictionaries[locale.lang] };
});
const { SubscriptionOfferCard } = await import("./SubscriptionOfferCard");
afterEach(cleanup);

describe("read-only published offer presentation", () => {
  it.each(["en", "ar"] as const)("distinguishes unconfigured prices from actual zero in %s", (language) => {
    locale.lang = language;
    const offer = createSubscriptionOffersFixture().data[0], onSelectTier = vi.fn();
    render(<SubscriptionOfferCard offer={offer} onSelectTier={onSelectTier} />);
    expect(screen.getByText(dictionaries[language].subscriptionOffers.status.UNCONFIGURED)).toBeInTheDocument();
    expect(screen.getByText(dictionaries[language].subscriptionOffers.status.PREPARATION_REQUIRED)).toBeInTheDocument();
    expect(screen.queryByText("PREPARATION_REQUIRED")).not.toBeInTheDocument();
    expect(screen.getAllByText(/\$0\.00|0\.00\sUS\$/u)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: dictionaries[language].subscriptionOffers.filter }));
    expect(onSelectTier).toHaveBeenCalledExactlyOnceWith(offer);
  });
  it("renders dynamic Addon bounds/prices with no purchase or parent-selection action", () => {
    locale.lang = "en";
    const offer = createSubscriptionOffersFixture().data[1]; offer.ladders[0].brackets[0].unitPrice = "37.0041";
    render(<SubscriptionOfferCard offer={offer} onSelectTier={vi.fn()} />);
    expect(screen.getByText("$37.0041")).toBeInTheDocument();
    expect(screen.getByText("$9.00")).toBeInTheDocument(); expect(screen.getByText("$8.00")).toBeInTheDocument();
    expect(screen.getByText(en.subscriptionAddons.openEnded)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.subscriptionOffers.filter })).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(en.subscriptionOffers.pricing)).tagName).toBe("SUMMARY");
  });
});
