// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { commercialLabel, createCommercialLabels } from "../commercial-labels";
import type { CommercialPreparationRequest } from "../commercial-command-request";
import type { CommercialPreview } from "../commercial-preview";
import { createSubscriptionFixture } from "../subscription-read.fixture";
import { createSubscriptionOffersFixture } from "../subscription-offers.fixture";

const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[locale.lang], lang: locale.lang }) }));
vi.mock("@/i18n/useLanguage", async (loadOriginal) => ({
  ...await loadOriginal<typeof import("@/i18n/useLanguage")>(),
  useLanguage: () => locale.lang, useDictionary: () => dictionaries[locale.lang],
}));
const { CommercialChangeList } = await import("./CommercialChangeList");
const { CommercialPreviewDetails } = await import("./CommercialPreviewDetails");
const { SubscriptionAddonSelections } = await import("./SubscriptionAddonSelections");
afterEach(cleanup);

function fixture() {
  const view = createSubscriptionFixture().data, base = view.baseItems[0], addon = view.addonSelections[0];
  const offers = createSubscriptionOffersFixture().data;
  for (const offer of offers) {
    offer.application.id = base.applicationId;
    if (offer.sourceKind === "APPLICATION") offer.tier.id = base.tierId;
    else offer.addon.id = addon.addonId;
  }
  const labels = createCommercialLabels(view, offers);
  const request: CommercialPreparationRequest = { expectedSubscriptionRevision: view.subscriptionRevision, changes: [
    { sourceKind: "APPLICATION", operation: "CHANGE", selectionKey: "application-selection", itemId: base.id, seats: 12 },
    { sourceKind: "ADDON", operation: "CHANGE", selectionKey: "addon-selection", addonSelectionId: addon.id, seats: 4 },
  ] };
  const preview: CommercialPreview = {
    previewId: "preview-id", subscriptionId: view.subscription.id, subscriptionRevision: view.subscriptionRevision,
    operationId: "operation-id", actorBindingDigest: "a".repeat(64), targetSetDigest: "b".repeat(64),
    pricedAt: "2026-10-29T12:00:00.000Z", expiresAt: "2026-10-29T12:05:00.000Z", billingCycle: "MONTHLY", currencyCode: "USD",
    preparation: { preparationId: "preparation-id" }, changes: [{
      ordinal: 1, sourceKind: "APPLICATION", operation: "CHANGE", selectionKey: "application-selection",
      applicationId: base.applicationId, itemId: base.id, addonSelectionId: null, addonId: null, parentItemId: null, parentSelectionKey: null,
      fromSeats: 10, toSeats: 12, fromTierId: base.tierId, toTierId: base.tierId, fromDefinitionVersionId: null, toDefinitionVersionId: null,
      acceptedPricingBefore: null, acceptedPricingAfter: null,
      previousAmountUsd: "100.0000", nextAmountUsd: "120.0000", fullPeriodDeltaUsd: "20.0000", proratedAllocationUsd: "20.0000",
    }], financial: { previousRecurringUsd: "100.0000", nextRecurringUsd: "120.0000", fullPeriodDeltaUsd: "20.0000",
      direction: "DEBIT", proratedAmountUsd: "20.0000", walletStatus: "ACTIVE", walletAvailableUsd: "200.0000", walletShortfallUsd: "0.0000", canApply: true },
  };
  return { view, labels, request, preview };
}

function expectIdentifiersCollapsed(ids: string[]) {
  for (const id of ids) for (const node of screen.getAllByText(id)) {
    const disclosure = node.closest("details");
    expect(disclosure).not.toBeNull();
    expect(disclosure).not.toHaveAttribute("open");
  }
}

it.each(["en", "ar"] as const)("names the review, quote and Addon section with collapsed identifiers (%s)", (lang) => {
  locale.lang = lang;
  const { view, labels, request, preview } = fixture();
  const original = JSON.stringify(request);
  render(<CommercialChangeList request={request} labels={labels} />);
  expect(screen.getByText("CRM · CRM Starter")).toBeInTheDocument();
  expect(screen.getByText("CRM · Logistics")).toBeInTheDocument();
  expectIdentifiersCollapsed([view.baseItems[0].id, view.addonSelections[0].id, "application-selection", "addon-selection"]);
  expect(JSON.stringify(request)).toBe(original);
  cleanup();
  render(<CommercialPreviewDetails preview={preview} labels={labels} />);
  expect(screen.getByText("CRM · CRM Starter")).toBeInTheDocument();
  expect(screen.getByText(dictionaries[lang].commercialPurchase.confirmable)).toBeInTheDocument();
  expectIdentifiersCollapsed([preview.previewId, preview.operationId, preview.preparation.preparationId, view.baseItems[0].applicationId]);
  cleanup();
  render(<SubscriptionAddonSelections view={view} labels={labels} />);
  expect(screen.getByText("CRM · Logistics")).toBeInTheDocument();
  expectIdentifiersCollapsed([view.addonSelections[0].id, view.addonSelections[0].definitionVersionId]);
});

it("falls back to known keys, and renders a restored unmatched intent without using UUIDs as names", () => {
  locale.lang = "en";
  const { view, request } = fixture();
  const labels = createCommercialLabels(view);
  expect(commercialLabel(labels, request.changes[0], "Application")).toBe("CRM · starter");
  expect(commercialLabel(labels, request.changes[1], "Addon")).toBe("CRM · crm.logistics");
  render(<CommercialChangeList request={request} />);
  expect(screen.getByText(en.commercialPurchase.status.APPLICATION)).toBeInTheDocument();
  expectIdentifiersCollapsed([view.baseItems[0].id, view.addonSelections[0].id]);
});

it("resolves Addon adoption by discovery key and new Addons by their draft parent", () => {
  const { view } = fixture(), offers = createSubscriptionOffersFixture().data;
  const selections = [{ addonSelectionId: "adoption-selection", applicationKey: "crm", addonKey: "crm.logistics",
    currentDefinition: { definitionVersionId: "definition-id", version: "1", revokedAt: null } }];
  const labels = createCommercialLabels(null, offers, selections);
  expect(commercialLabel(labels, { sourceKind: "ADDON", addonSelectionId: "adoption-selection" }, "Addon")).toBe("CRM · Logistics");
  expect(commercialLabel(createCommercialLabels(null, [], selections), { sourceKind: "ADDON", addonSelectionId: "adoption-selection",
    applicationId: "unknown-application-id", addonId: "unknown-addon-id" }, "Addon")).toBe("crm · crm.logistics");
  expect(commercialLabel(labels, { sourceKind: "ADDON", addonId: offers[1].sourceKind === "ADDON" ? offers[1].addon.id : "", parentSelectionKey: "new-parent" }, "Addon", [
    { sourceKind: "APPLICATION", operation: "ADD", selectionKey: "new-parent", applicationId: offers[0].application.id, tierId: view.baseItems[0].tierId, seats: 10 },
  ])).toBe("CRM · Logistics");
});
