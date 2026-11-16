// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { createCommercialLabels } from "../commercial-labels";

const current = vi.hoisted(() => ({ lang: "en" as "en" | "ar", code: "SUBSCRIPTION_BILLING_INCOMPLETE" }));
const dictionaries = { en, ar };
const error = () => ({ code: current.code, status: 409, correlationId: "support-123" });
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[current.lang], lang: current.lang }) }));
vi.mock("@/i18n/useLanguage", async (loadOriginal) => ({
  ...await loadOriginal<typeof import("@/i18n/useLanguage")>(),
  useLanguage: () => current.lang, useDictionary: () => dictionaries[current.lang],
}));
vi.mock("@/design-system", async (loadOriginal) => ({
  ...await loadOriginal<typeof import("@/design-system")>(),
  PageHeader: () => null,
  SubNav: () => null,
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../components/OwnerGate", () => ({ OwnerGate: ({ children }: { children: ReactNode }) => children }));
vi.mock("../hooks/useCommercialLabels", () => ({ useCommercialLabels: () => ({ ...createCommercialLabels(), rememberOffers: vi.fn() }) }));
vi.mock("../hooks/useSubscription", () => ({ useSubscription: () => ({
  view: null, subscriptionError: error(), denied: false, isLoading: false, reload: vi.fn(),
}) }));
vi.mock("../../billing/hooks/useBillingTableLabels", () => ({ useBillingTableLabels: () => ({}) }));
vi.mock("../hooks/useCommercialChange", () => ({ useCommercialChange: () => ({
  state: { phase: "uncertain", error: error() }, denied: false, busy: false,
}) }));
vi.mock("../hooks/useDefinitionAdoptionDiscovery", () => ({ useDefinitionAdoptionDiscovery: () => ({
  state: null, denied: false, busy: false, reload: vi.fn(),
}) }));

const { CommercialChangeWorkspace } = await import("./CommercialChangeWorkspace");
const { DefinitionAdoptionWorkspace } = await import("./DefinitionAdoptionWorkspace");
const { SubscriptionWorkspace } = await import("./subscription-workspace");
afterEach(cleanup);

it.each(["en", "ar"] as const)("renders an explanation and a labelled support reference in every workspace (%s)", (lang) => {
  current.lang = lang;
  current.code = "SUBSCRIPTION_BILLING_INCOMPLETE";
  const copy = dictionaries[lang].commercialPurchase;
  for (const Workspace of [CommercialChangeWorkspace, DefinitionAdoptionWorkspace, SubscriptionWorkspace]) {
    render(<Workspace />);
    expect(screen.getByText(copy.errors.billingIncomplete)).toBeInTheDocument();
    expect(screen.getByText(`${copy.supportReference}:`)).toBeInTheDocument();
    expect(screen.getByText("support-123")).toBeInTheDocument();
    expect(screen.queryByText(current.code)).not.toBeInTheDocument();
    cleanup();
  }
});

it("uses the safe fallback in every workspace for an unknown failure", () => {
  current.lang = "en";
  current.code = "UNRECOGNIZED_BACKEND_FAILURE";
  for (const Workspace of [CommercialChangeWorkspace, DefinitionAdoptionWorkspace, SubscriptionWorkspace]) {
    render(<Workspace />);
    expect(screen.getByText(en.commercialPurchase.errors.unknown)).toBeInTheDocument();
    expect(screen.queryByText(current.code)).not.toBeInTheDocument();
    cleanup();
  }
});
