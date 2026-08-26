// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UseTenantBillingWorkspaceResult } from "../hooks/useTenantBillingWorkspace";
import type {
  PaymentReconciliationCaseView,
  PaymentReconciliationView,
  PaymentStatusView,
  SubscriptionPlanChangePreviewView,
  SubscriptionStatus,
  SubscriptionView,
  TenantBillingPermissions,
  WalletAdjustmentPreviewView,
  WalletStatus,
  WalletView,
} from "../types";
import { TenantBillingPanel } from "./TenantBillingPanel";

// TenantBillingPanel takes `lang` as a prop (its parent, TenantWorkspaceScreen,
// owns the language state) and never called useI18n() itself — until this
// panel's tables moved onto the design-system DataTable/Pagination, which do
// call useI18n() internally for header/label language selection. Every test
// below renders with lang="en", so this mock just gives DataTable/Pagination
// the same answer the prop already provides.
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en" as const }),
}));

const TENANT_ID = "019f0000-0000-7000-8000-000000000001";
const SUBSCRIPTION_ID = "019f0000-0000-7000-8000-000000000002";
const ITEM_ID = "019f0000-0000-7000-8000-000000000003";
const MODULE_ID = "019f0000-0000-7000-8000-000000000004";
const TIER_ID = "019f0000-0000-7000-8000-000000000005";
const PAYMENT_ID = "019f0000-0000-7000-8000-000000000006";
const RECONCILIATION_ID = "019f0000-0000-7000-8000-000000000007";
const ACTOR_ID = "019f0000-0000-7000-8000-000000000008";
const EXPIRED_AT = "2000-01-01T00:00:00.000Z";

const EMPTY_META = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
} as const;

function permissionFixture(
  overrides: Partial<TenantBillingPermissions> = {},
): TenantBillingPermissions {
  // This is the permission-fixture boundary. Keep optional future billing
  // capabilities denied unless a test opts into them explicitly.
  return {
    canReadSubscription: true,
    canCreateSubscription: false,
    canUpdateSubscription: false,
    canApplySubscriptionUpdate: false,
    canCancelSubscription: false,
    canReadWallet: true,
    canPreviewWalletAdjustment: false,
    canConfirmWalletAdjustment: false,
    canReadBillingSummary: true,
    canRefundPayment: false,
    canReconcilePayment: false,
    canDecideReconciliation: false,
    canRecordOfflinePayment: false,
    ...overrides,
  } as TenantBillingPermissions;
}

function subscriptionFixture(
  status: SubscriptionStatus = "ACTIVE",
  cancelAt: string | null = null,
): SubscriptionView {
  return {
    subscription: {
      id: SUBSCRIPTION_ID,
      tenantId: TENANT_ID,
      allowedUsers: 10,
      status,
      billingCycle: "MONTHLY",
      currencyCode: "USD",
      startedAt: "2026-08-01T00:00:00.000Z",
      currentPeriodStart: "2026-08-01T00:00:00.000Z",
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
      pendingPeriodStart: null,
      pendingPeriodEnd: null,
      trialDays: 14,
      trialStartedAt: null,
      trialEndsAt: null,
      activationScheduledAt: null,
      activatedAt: "2026-08-01T00:00:00.000Z",
      cancelAt,
      totalPrice: "30.00",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
    },
    effectiveAllowedUsers: 10,
    enabledModules: ["crm"],
    items: [
      {
        id: ITEM_ID,
        subscriptionId: SUBSCRIPTION_ID,
        moduleId: MODULE_ID,
        moduleKey: "crm",
        moduleName: "CRM",
        tierId: TIER_ID,
        tierKey: "growth",
        tierName: "Growth",
        seats: 10,
        lineTotal: "30.00",
        currencyCode: "USD",
        features: ["contacts"],
      },
    ],
  };
}

function walletFixture(status: WalletStatus = "ACTIVE"): WalletView {
  return {
    currencyCode: "USD",
    balanceUsd: "100.00",
    reservedBalanceUsd: "10.00",
    availableBalanceUsd: "90.00",
    status,
  };
}

function paymentFixture(status: PaymentStatusView["status"] = "SUCCEEDED"):
  PaymentStatusView {
  return {
    paymentId: PAYMENT_ID,
    purpose: "INVOICE_SETTLEMENT",
    provider: "PAYMOB",
    status,
    invoiceId: "019f0000-0000-7000-8000-000000000009",
    invoiceStatus: "PAID",
    subscriptionStatus: "ACTIVE",
    providerAmount: "30.00",
    providerCurrencyCode: "USD",
    settlementAmountUsd: "30.00",
    walletAppliedUsd: "0.00",
    totalAppliedUsd: "30.00",
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
  };
}

function planPreviewFixture(): SubscriptionPlanChangePreviewView {
  return {
    previewId: "019f0000-0000-7000-8000-000000000010",
    subscriptionId: SUBSCRIPTION_ID,
    tenantId: TENANT_ID,
    operation: "CHANGE",
    currencyCode: "USD",
    billingCycle: "MONTHLY",
    itemSetFingerprint: "item-fingerprint",
    planFingerprint: "plan-fingerprint",
    pricingRevision: "pricing-1",
    pricedAt: "1999-12-31T23:55:00.000Z",
    expiresAt: EXPIRED_AT,
    item: {
      itemId: ITEM_ID,
      moduleId: MODULE_ID,
      fromTierId: TIER_ID,
      toTierId: "019f0000-0000-7000-8000-000000000011",
      fromSeats: 10,
      toSeats: 20,
      previousLineTotalUsd: "30.00",
      nextLineTotalUsd: "50.00",
    },
    financial: {
      fullPeriodDeltaUsd: "20.00",
      direction: "DEBIT",
      proratedAmountUsd: "10.00",
      walletAvailableUsd: "90.00",
      walletShortfallUsd: "0.00",
      walletStatus: "ACTIVE",
      canApply: true,
    },
  };
}

function walletPreviewFixture(): WalletAdjustmentPreviewView {
  return {
    quoteId: "019f0000-0000-7000-8000-000000000012",
    purpose: "ADMIN_WALLET_ADJUSTMENT",
    sourceAmount: "25.00",
    sourceCurrencyCode: "USD",
    amountUsd: "25.00",
    currencyUnitsPerUsd: "1.00",
    rateRevisionId: null,
    rateObservedAt: "1999-12-31T23:55:00.000Z",
    expiresAt: EXPIRED_AT,
    direction: "CREDIT",
    reasonCode: "MANUAL_CREDIT",
    balanceBeforeUsd: "100.00",
    balanceAfterUsd: "125.00",
  };
}

function reconciliationFixture(
  reconciliations: PaymentReconciliationView[] = [],
): PaymentReconciliationCaseView {
  return {
    payment: {
      paymentId: PAYMENT_ID,
      tenantId: TENANT_ID,
      status: "REQUIRES_REVIEW",
      purpose: "INVOICE_SETTLEMENT",
      provider: "PAYMOB",
      invoiceId: "019f0000-0000-7000-8000-000000000009",
      failureCode: "PROVIDER_TIMEOUT",
      providerSucceededAt: null,
      providerSuccessEventReference: null,
      unexpectedRefundEventReference: null,
      unexpectedRefundProviderOutcomeReference: null,
      refundAttemptedAt: null,
      refundProviderReference: null,
      refundReservedUsd: "0.00",
    },
    eligibleActions: ["CONFIRM_FAILED", "CONFIRM_REFUNDED"],
    reconciliations,
  };
}

function proposedReconciliationFixture(): PaymentReconciliationView {
  return {
    id: RECONCILIATION_ID,
    paymentId: PAYMENT_ID,
    tenantId: TENANT_ID,
    action: "CONFIRM_FAILED",
    status: "PROPOSED",
    evidenceReference: "provider-case-42",
    providerOutcomeReference: null,
    proposalNote: "Provider outcome reviewed",
    proposedByAdminId: ACTOR_ID,
    decidedByAdminId: null,
    decisionNote: null,
    decidedAt: null,
    paymentStatus: "REQUIRES_REVIEW",
    createdAt: "2026-08-11T00:00:00.000Z",
  };
}

function workspaceFixture(
  overrides: Partial<UseTenantBillingWorkspaceResult> = {},
): UseTenantBillingWorkspaceResult {
  const subscription = subscriptionFixture();
  const fixture = {
    permissions: permissionFixture(),
    actorId: ACTOR_ID,
    subscription,
    subscriptionItems: subscription.items,
    subscriptionState: "ready",
    subscriptionError: null,
    wallet: walletFixture(),
    inputCurrencies: {
      walletCurrencyCode: "USD",
      items: [{ currencyCode: "USD", isBaseCurrency: true }],
      total: 1,
    },
    inputCurrenciesState: "ready",
    inputCurrenciesError: null,
    ledger: { items: [], meta: EMPTY_META },
    ledgerPage: 1,
    setLedgerPage: vi.fn(),
    ledgerState: "empty",
    ledgerError: null,
    walletState: "ready",
    walletError: null,
    payments: { items: [], meta: EMPTY_META },
    paymentsPage: 1,
    setPaymentsPage: vi.fn(),
    paymentsState: "ready",
    paymentsError: null,
    billingSummary: {
      tenantId: TENANT_ID,
      subscriptionId: SUBSCRIPTION_ID,
      currentCollectionInvoice: {
        id: "019f0000-0000-7000-8000-000000000009",
        number: "INV-100",
        purpose: "RENEWAL",
        status: "ISSUED",
        currencyCode: "USD",
        canonicalUsd: true,
        totalUsd: "30.00",
        amountPaidUsd: "0.00",
        outstandingUsd: "30.00",
        legacyOriginalAmounts: null,
        periodStart: "2026-08-01T00:00:00.000Z",
        periodEnd: "2026-09-01T00:00:00.000Z",
        issuedAt: "2026-08-01T00:00:00.000Z",
        dueAt: "2026-08-15T00:00:00.000Z",
        paidAt: null,
      },
    },
    billingSummaryState: "ready",
    billingSummaryError: null,
    planPreview: null,
    walletPreview: null,
    selectedPaymentId: null,
    reconciliationCase: null,
    reconciliationState: "idle",
    reconciliationError: null,
    mutation: { name: null, error: null },
    isAuthLoading: false,
    refresh: vi.fn().mockResolvedValue(undefined),
    seedSubscription: vi.fn().mockResolvedValue(null),
    previewPlanChange: vi.fn().mockResolvedValue(null),
    applyPlanChange: vi.fn().mockResolvedValue(null),
    cancelSubscription: vi.fn().mockResolvedValue(null),
    previewWalletAdjustment: vi.fn().mockResolvedValue(null),
    confirmWalletAdjustment: vi.fn().mockResolvedValue(null),
    refundPayment: vi.fn().mockResolvedValue(null),
    selectPayment: vi.fn().mockResolvedValue(null),
    proposeReconciliation: vi.fn().mockResolvedValue(null),
    decideReconciliation: vi.fn().mockResolvedValue(null),
    recordOfflinePayment: vi.fn().mockResolvedValue(null),
    clearPlanPreview: vi.fn(),
    clearWalletPreview: vi.fn(),
  };

  // Cast only at the fixture boundary; each domain object above is typed.
  return { ...fixture, ...overrides } as UseTenantBillingWorkspaceResult;
}

function openPayments(workspace: UseTenantBillingWorkspaceResult) {
  render(<TenantBillingPanel workspace={workspace} lang="en" />);
  fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
}

describe("TenantBillingPanel safety boundaries", () => {
  it("keeps an independently authorized invoice summary visible when subscription reads are forbidden", () => {
    const workspace = workspaceFixture({
      permissions: permissionFixture({
        canReadSubscription: false,
        canReadBillingSummary: true,
      }),
      subscription: null,
      subscriptionItems: [],
      subscriptionState: "forbidden",
    });

    render(<TenantBillingPanel workspace={workspace} lang="en" />);

    expect(screen.getByText("Current collection invoice")).toBeInTheDocument();
    expect(screen.getByText("INV-100")).toBeInTheDocument();
    expect(
      screen.getByText("You do not have permission to read this subscription."),
    ).toBeInTheDocument();
  });

  it("requires explicit confirmation before recording an offline invoice payment", () => {
    const recordOfflinePayment = vi.fn().mockResolvedValue(null);
    const workspace = workspaceFixture({
      permissions: permissionFixture({ canRecordOfflinePayment: true }),
      recordOfflinePayment,
    });
    render(<TenantBillingPanel workspace={workspace} lang="en" />);

    fireEvent.change(screen.getByLabelText("Source amount"), {
      target: { value: "125.5000" },
    });
    fireEvent.change(screen.getByLabelText("External receipt reference"), {
      target: { value: "receipt-42" },
    });
    const submit = screen.getByRole("button", {
      name: "Record offline payment",
    });
    expect(submit).toBeDisabled();

    fireEvent.click(
      screen.getByLabelText(
        "I verified the receipt and confirm this critical collection",
      ),
    );
    fireEvent.click(submit);
    expect(recordOfflinePayment).toHaveBeenCalledWith({
      amount: "125.5000",
      currencyCode: "USD",
      reference: "receipt-42",
    });
  });

  it.each<SubscriptionStatus>([
    "PENDING_ACTIVATION",
    "PAST_DUE",
    "CANCELLED",
  ])("does not offer plan changes while subscription status is %s", (status) => {
    const subscription = subscriptionFixture(status);
    const workspace = workspaceFixture({
      permissions: permissionFixture({ canUpdateSubscription: true }),
      subscription,
      subscriptionItems: subscription.items,
    });

    render(<TenantBillingPanel workspace={workspace} lang="en" />);

    expect(
      screen.getByText(
        "Plan changes are available only while the subscription is in trial or active.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Preview change" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer a second cancellation after one is scheduled", () => {
    const subscription = subscriptionFixture(
      "ACTIVE",
      "2026-09-01T00:00:00.000Z",
    );
    const workspace = workspaceFixture({
      permissions: permissionFixture({ canCancelSubscription: true }),
      subscription,
      subscriptionItems: subscription.items,
    });

    render(<TenantBillingPanel workspace={workspace} lang="en" />);

    expect(screen.getByText(/Cancellation scheduled:/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel subscription" }),
    ).not.toBeInTheDocument();
  });

  it("keeps manual wallet adjustments unavailable for a frozen wallet", () => {
    const workspace = workspaceFixture({
      permissions: permissionFixture({ canPreviewWalletAdjustment: true }),
      wallet: walletFixture("FROZEN"),
    });

    render(<TenantBillingPanel workspace={workspace} lang="en" />);
    fireEvent.click(screen.getByRole("tab", { name: "Wallet" }));

    expect(
      screen.getByText(
        "Manual adjustments are unavailable while the wallet is frozen or closed.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Preview adjustment" }),
    ).not.toBeInTheDocument();
  });

  it("uses eligible reconciliation actions and requires provider evidence only for confirmed refunds", () => {
    const proposeReconciliation = vi.fn().mockResolvedValue(null);
    const workspace = workspaceFixture({
      permissions: permissionFixture({ canReconcilePayment: true }),
      payments: { items: [paymentFixture("REQUIRES_REVIEW")], meta: EMPTY_META },
      selectedPaymentId: PAYMENT_ID,
      reconciliationCase: reconciliationFixture(),
      reconciliationState: "ready",
      proposeReconciliation,
    });
    openPayments(workspace);

    const action = screen.getByLabelText("Action");
    expect(action).toHaveValue("CONFIRM_FAILED");
    expect(
      screen.queryByLabelText("Provider outcome reference"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Evidence reference"), {
      target: { value: "provider-case-42" },
    });
    fireEvent.change(screen.getByLabelText("Audit note"), {
      target: { value: "Provider outcome reviewed" },
    });
    expect(screen.getByRole("button", { name: "Propose" })).toBeEnabled();

    fireEvent.change(action, { target: { value: "CONFIRM_REFUNDED" } });
    const providerReference = screen.getByLabelText(
      "Provider outcome reference",
    );
    expect(providerReference).toBeRequired();
    expect(screen.getByRole("button", { name: "Propose" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Evidence reference"), {
      target: { value: "provider-case-42" },
    });
    fireEvent.change(providerReference, { target: { value: "refund-9001" } });
    fireEvent.click(screen.getByRole("button", { name: "Propose" }));

    expect(proposeReconciliation).toHaveBeenCalledWith({
      action: "CONFIRM_REFUNDED",
      evidenceReference: "provider-case-42",
      providerOutcomeReference: "refund-9001",
      note: "Provider outcome reviewed",
    });
  });

  it("blocks duplicate reconciliation proposals and prevents maker self-approval", () => {
    const workspace = workspaceFixture({
      permissions: permissionFixture({
        canReconcilePayment: true,
        canDecideReconciliation: true,
      }),
      payments: { items: [paymentFixture("REQUIRES_REVIEW")], meta: EMPTY_META },
      selectedPaymentId: PAYMENT_ID,
      reconciliationCase: reconciliationFixture([
        proposedReconciliationFixture(),
      ]),
      reconciliationState: "ready",
    });
    openPayments(workspace);

    expect(
      screen.getByText(
        "An open reconciliation proposal already exists for this payment.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The proposing administrator cannot approve or reject their own proposal.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Propose" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reject" }),
    ).not.toBeInTheDocument();
  });

  it("requires explicit confirmation before dispatching a refund", () => {
    const refundPayment = vi.fn().mockResolvedValue(null);
    const workspace = workspaceFixture({
      permissions: permissionFixture({ canRefundPayment: true }),
      payments: { items: [paymentFixture()], meta: EMPTY_META },
      refundPayment,
    });
    openPayments(workspace);

    const refund = screen.getByRole("button", { name: "Refund" });
    expect(refund).toBeDisabled();
    expect(refundPayment).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I confirm this critical refund",
      }),
    );
    expect(refund).toBeEnabled();
    fireEvent.click(refund);

    expect(refundPayment).toHaveBeenCalledWith(PAYMENT_ID, undefined);
  });

  it("disables apply and confirm commands when their reviewed previews have expired", () => {
    const workspace = workspaceFixture({
      permissions: permissionFixture({
        canUpdateSubscription: true,
        canApplySubscriptionUpdate: true,
        canPreviewWalletAdjustment: true,
        canConfirmWalletAdjustment: true,
      }),
      planPreview: planPreviewFixture(),
      walletPreview: walletPreviewFixture(),
    });

    render(<TenantBillingPanel workspace={workspace} lang="en" />);

    expect(screen.getByText(/reviewed server preview has expired/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply reviewed change" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("tab", { name: "Wallet" }));
    fireEvent.change(screen.getByLabelText("Audit note"), {
      target: { value: "Reviewed manual credit" },
    });
    expect(screen.getByText(/reviewed server preview has expired/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm adjustment" }),
    ).toBeDisabled();
  });
});
