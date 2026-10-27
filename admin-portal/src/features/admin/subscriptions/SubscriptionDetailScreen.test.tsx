// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  auth: {
    user: {
      id: "01900000-0000-7000-8000-000000000099",
      isSuperAdmin: false,
      permissions: [] as string[],
    },
    isLoading: false,
  },
}));
const api = vi.hoisted(() => ({
  getSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  getWallet: vi.fn(),
  getInputCurrencies: vi.fn(),
  getLedger: vi.fn(),
  getPayments: vi.fn(),
  getBillingSummary: vi.fn(),
}));
const tenantWorkspace = vi.hoisted(() => vi.fn(() => {
  throw new Error("Subscription detail must not mount tenant management");
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: state.lang }) }));
vi.mock("../tenant-workspace/billing/api/tenant-billing.api", () => ({ tenantBillingApi: api }));
vi.mock("../tenant-workspace/core/hooks/useTenantCoreWorkspace", () => ({
  useTenantCoreWorkspace: tenantWorkspace,
}));
// Aggregate editing has its own suites; retain the real billing hook, panel,
// permission reader and commercial detail evidence for this route regression.
vi.mock("./commercial-change/CommercialChangeWorkspace", () => ({
  CommercialChangeWorkspace: () => null,
}));

import { SubscriptionDetailScreen } from "./SubscriptionDetailScreen";
import { adaptSubscriptionCommercial } from "../tenant-workspace/billing/model/subscription-commercial";
import { commercialFixture, commercialIds } from "../tenant-workspace/billing/model/subscription-commercial-fixtures";

const BILLING_OPERATOR = [
  "admin.subscriptions.read",
  "admin.subscriptions.cancel",
  "admin.subscriptions.critical",
];

describe("SubscriptionDetailScreen", () => {
  beforeEach(() => {
    Object.values(api).forEach(mock => mock.mockReset());
    tenantWorkspace.mockClear();
    window.sessionStorage.clear();
    window.localStorage.clear();
    state.lang = "en";
    state.auth.isLoading = false;
    state.auth.user.permissions = [...BILLING_OPERATOR];
    api.getSubscription.mockResolvedValue(adaptSubscriptionCommercial(commercialFixture()));
  });

  afterEach(cleanup);

  it("shows commercial detail and cancels without tenant-read authority", async () => {
    const scheduled = commercialFixture();
    scheduled.subscription.cancelAt = scheduled.subscription.currentPeriodEnd;
    api.getSubscription
      .mockResolvedValueOnce(adaptSubscriptionCommercial(commercialFixture()))
      .mockResolvedValue(adaptSubscriptionCommercial(scheduled));
    api.cancelSubscription.mockResolvedValue({ status: "ACTIVE", scheduled: true, changed: true });

    render(<SubscriptionDetailScreen tenantId={commercialIds.tenant} />);

    expect(await screen.findByRole("heading", { name: "Subscription items" })).toBeTruthy();
    expect(screen.getAllByText(/crm\.logistics/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/575\.0000/u).length).toBeGreaterThan(0);
    expect(state.auth.user.permissions).not.toContain("admin.tenants.read");
    const cancel = screen.getByRole("button", { name: "Cancel subscription" });
    expect(cancel.hasAttribute("disabled")).toBe(true);
    fireEvent.click(cancel);
    expect(api.cancelSubscription).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "I confirm cancellation" }));
    fireEvent.click(cancel);

    await waitFor(() => expect(api.cancelSubscription).toHaveBeenCalledWith(
      commercialIds.tenant,
      expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u),
    ));
    await waitFor(() => expect(api.getSubscription).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancel subscription" })).toBeNull());
    expect(screen.getByText(/Cancellation scheduled:/u)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to subscriptions" }).getAttribute("href")).toBe("/subscriptions");
    expect(screen.queryByRole("link", { name: /tenant/iu })).toBeNull();
    expect(tenantWorkspace).not.toHaveBeenCalled();
    for (const [name, method] of Object.entries(api)) {
      if (name !== "getSubscription" && name !== "cancelSubscription") expect(method).not.toHaveBeenCalled();
    }
  });

  it.each(["admin.subscriptions.cancel", "admin.subscriptions.critical"])(
    "keeps detail readable but hides cancellation without %s",
    async missing => {
      state.auth.user.permissions = BILLING_OPERATOR.filter(permission => permission !== missing);
      render(<SubscriptionDetailScreen tenantId={commercialIds.tenant} />);
      expect(await screen.findByRole("heading", { name: "Subscription items" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Cancel subscription" })).toBeNull();
      expect(api.cancelSubscription).not.toHaveBeenCalled();
    },
  );

  it("does not mount billing or issue requests without subscription read", () => {
    state.auth.user.permissions = BILLING_OPERATOR.filter(permission => permission !== "admin.subscriptions.read");
    render(<SubscriptionDetailScreen tenantId={commercialIds.tenant} />);
    expect(screen.getByRole("alert").textContent).toContain("admin.subscriptions.read");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(Object.values(api).every(method => method.mock.calls.length === 0)).toBe(true);
    expect(tenantWorkspace).not.toHaveBeenCalled();
  });

  it("waits for auth hydration before mounting billing", () => {
    state.auth.isLoading = true;
    render(<SubscriptionDetailScreen tenantId={commercialIds.tenant} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(Object.values(api).every(method => method.mock.calls.length === 0)).toBe(true);
  });

  it("preserves a backend detail 403 as forbidden and exposes no cancellation", async () => {
    api.getSubscription.mockRejectedValue({
      isNormalized: true, httpStatus: 403, errorCode: "FORBIDDEN", message: "Forbidden",
    });
    render(<SubscriptionDetailScreen tenantId={commercialIds.tenant} />);
    expect(await screen.findByText("You do not have permission to read this subscription.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel subscription" })).toBeNull();
    expect(api.cancelSubscription).not.toHaveBeenCalled();
  });

  it("uses Arabic copy and RTL for the same authorized route", async () => {
    state.lang = "ar";
    const { container } = render(<SubscriptionDetailScreen tenantId={commercialIds.tenant} />);
    expect(screen.getByRole("heading", { name: "تفاصيل الاشتراك" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "العودة إلى الاشتراكات" }).getAttribute("href")).toBe("/subscriptions");
    expect(await screen.findByRole("button", { name: "إلغاء الاشتراك" })).toBeTruthy();
    expect(container.firstElementChild?.getAttribute("dir")).toBe("rtl");
  });
});
