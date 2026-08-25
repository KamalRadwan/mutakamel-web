import { describe, expect, it } from "vitest";
import {
  TenantBillingContractError,
  readBillingSummary,
  readCancellationResult,
  readCoreData,
  readCorePage,
  readPayment,
  readPlanChangeApplyResult,
  readPlanChangePreview,
  readReconciliation,
  readReconciliationCase,
  readSubscriptionItems,
  readSubscriptionView,
  readWallet,
  readWalletAdjustmentPreview,
  readWalletInputCurrencies,
  readWalletLedger,
} from "./readers";

const TENANT_ID = "019ff251-0000-7000-8000-000000000001";
const SUBSCRIPTION_ID = "019ff251-0000-7000-8000-000000000002";
const ITEM_ID = "019ff251-0000-7000-8000-000000000003";
const MODULE_ID = "019ff251-0000-7000-8000-000000000004";
const TIER_ID = "019ff251-0000-7000-8000-000000000005";
const NEXT_TIER_ID = "019ff251-0000-7000-8000-000000000006";
const PREVIEW_ID = "019ff251-0000-7000-8000-000000000007";
const WALLET_ID = "019ff251-0000-7000-8000-000000000008";
const LEDGER_ID = "019ff251-0000-7000-8000-000000000009";
const RATE_ID = "019ff251-0000-7000-8000-00000000000a";
const PAYMENT_ID = "019ff251-0000-7000-8000-00000000000b";
const INVOICE_ID = "019ff251-0000-7000-8000-00000000000c";
const RECONCILIATION_ID = "019ff251-0000-7000-8000-00000000000d";
const MAKER_ID = "019ff251-0000-7000-8000-00000000000e";
const CHECKER_ID = "019ff251-0000-7000-8000-00000000000f";
const CORRELATION_ID = "019ff251-0000-7000-8000-000000000010";

const NOW = "2026-08-11T19:33:49.000Z";
const LATER = "2026-08-11T19:34:49.000Z";
const FUTURE = "2026-09-11T19:33:49.000Z";
const HASH = "a".repeat(64);

function envelope(data: unknown, meta?: Record<string, unknown>) {
  return {
    success: true,
    data,
    ...(meta === undefined ? {} : { meta }),
    correlationId: CORRELATION_ID,
    timestamp: NOW,
  };
}

function subscriptionItem(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    subscriptionId: SUBSCRIPTION_ID,
    moduleId: MODULE_ID,
    tierId: TIER_ID,
    seats: 2,
    lineTotal: "10.0000",
    moduleKey: "crm",
    moduleName: "CRM",
    tierKey: "growth",
    tierName: "Growth",
    currencyCode: "USD",
    features: ["crm.read", "crm.write"],
    createdAt: NOW,
    updatedAt: LATER,
    ...overrides,
  };
}

function subscriptionView(overrides: Record<string, unknown> = {}) {
  return {
    subscription: {
      id: SUBSCRIPTION_ID,
      tenantId: TENANT_ID,
      allowedUsers: 2,
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      currencyCode: "USD",
      startedAt: NOW,
      currentPeriodStart: NOW,
      currentPeriodEnd: FUTURE,
      pendingPeriodStart: null,
      pendingPeriodEnd: null,
      trialDays: 14,
      trialStartedAt: NOW,
      trialEndsAt: FUTURE,
      activationScheduledAt: null,
      activatedAt: NOW,
      cancelAt: null,
      totalPrice: "10.0000",
      createdAt: NOW,
      updatedAt: LATER,
    },
    effectiveAllowedUsers: 2,
    enabledModules: ["module.crm"],
    items: [subscriptionItem()],
    ...overrides,
  };
}

function planPreview(overrides: Record<string, unknown> = {}) {
  return {
    previewId: PREVIEW_ID,
    subscriptionId: SUBSCRIPTION_ID,
    tenantId: TENANT_ID,
    operation: "CHANGE",
    currencyCode: "USD",
    billingCycle: "MONTHLY",
    itemSetFingerprint: HASH,
    planFingerprint: HASH,
    pricingRevision: HASH,
    pricedAt: NOW,
    expiresAt: LATER,
    item: {
      itemId: ITEM_ID,
      moduleId: MODULE_ID,
      fromTierId: TIER_ID,
      toTierId: NEXT_TIER_ID,
      fromSeats: 2,
      toSeats: 3,
      previousLineTotalUsd: "10.0000",
      nextLineTotalUsd: "12.0000",
    },
    financial: {
      fullPeriodDeltaUsd: "2.0000",
      direction: "DEBIT",
      proratedAmountUsd: "1.0000",
      walletAvailableUsd: "5.0000",
      walletShortfallUsd: "0.0000",
      walletStatus: "ACTIVE",
      canApply: true,
    },
    ...overrides,
  };
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    paymentId: PAYMENT_ID,
    purpose: "INVOICE_SETTLEMENT",
    provider: "OFFLINE",
    status: "SUCCEEDED",
    invoiceId: INVOICE_ID,
    invoiceStatus: "PARTIALLY_PAID",
    subscriptionStatus: "ACTIVE",
    providerAmount: "15.0000",
    providerCurrencyCode: "USD",
    settlementAmountUsd: "10.0000",
    walletAppliedUsd: "5.0000",
    totalAppliedUsd: "15.0000",
    createdAt: NOW,
    updatedAt: LATER,
    ...overrides,
  };
}

function reconciliation(overrides: Record<string, unknown> = {}) {
  return {
    id: RECONCILIATION_ID,
    paymentId: PAYMENT_ID,
    tenantId: TENANT_ID,
    action: "CONFIRM_SUCCEEDED",
    status: "PROPOSED",
    evidenceReference: "provider-case-1",
    providerOutcomeReference: null,
    proposalNote: "Provider evidence was reviewed.",
    proposedByAdminId: MAKER_ID,
    decidedByAdminId: null,
    decisionNote: null,
    decidedAt: null,
    paymentStatus: "REQUIRES_REVIEW",
    createdAt: NOW,
    ...overrides,
  };
}

function reconciliationCase(overrides: Record<string, unknown> = {}) {
  return {
    payment: {
      paymentId: PAYMENT_ID,
      tenantId: TENANT_ID,
      status: "REQUIRES_REVIEW",
      purpose: "INVOICE_SETTLEMENT",
      provider: "PAYMOB",
      invoiceId: INVOICE_ID,
      failureCode: null,
      providerSucceededAt: NOW,
      providerSuccessEventReference: "event-1",
      unexpectedRefundEventReference: null,
      unexpectedRefundProviderOutcomeReference: null,
      refundAttemptedAt: null,
      refundProviderReference: null,
      refundReservedUsd: "0.0000",
    },
    eligibleActions: ["CONFIRM_SUCCEEDED", "CONFIRM_FAILED"],
    reconciliations: [reconciliation()],
    ...overrides,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function expectContractError(read: () => unknown, code?: string): void {
  expect(read).toThrow(TenantBillingContractError);
  if (code !== undefined) expect(read).toThrow(code);
}

describe("Core billing envelopes", () => {
  it("requires the canonical success discriminator, UUIDv7 correlation and ISO timestamp", () => {
    expect(readCoreData(envelope({ value: 1 }), (value) => value)).toEqual({ value: 1 });

    for (const invalid of [
      { ...envelope({}), success: false },
      { ...envelope({}), correlationId: "not-v7" },
      { ...envelope({}), timestamp: "2026-08-11" },
      { success: true, correlationId: CORRELATION_ID, timestamp: NOW },
    ]) {
      expectContractError(() => readCoreData(invalid, (value) => value), "INVALID_CORE_ENVELOPE");
    }
  });

  it("accepts positive, internally consistent pagination", () => {
    const parsed = readCorePage(
      envelope([payment()], {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }),
      readPayment,
    );
    expect(parsed.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  it.each([
    ["zero page", { page: 0 }],
    ["zero limit", { limit: 0 }],
    ["oversized limit", { limit: 101 }],
    ["wrong page count", { totalPages: 2 }],
    ["wrong next flag", { hasNext: true }],
    ["wrong previous flag", { hasPrev: true }],
  ])("rejects %s pagination", (_label, patch) => {
    const meta = {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
      ...patch,
    };
    expectContractError(() => readCorePage(envelope([payment()], meta), readPayment));
  });
});

describe("subscription readers", () => {
  it("reads the enriched view and enforces route identity", () => {
    const parsed = readSubscriptionView(subscriptionView(), {
      tenantId: TENANT_ID,
      subscriptionId: SUBSCRIPTION_ID,
    });
    expect(parsed.subscription.status).toBe("ACTIVE");
    expect(parsed.items[0]?.features).toEqual(["crm.read", "crm.write"]);

    expectContractError(() =>
      readSubscriptionView(subscriptionView(), {
        tenantId: "019ff251-0000-7000-8000-000000000099",
      }),
    );
    const withTenant = subscriptionView();
    const missingTenant = {
      ...withTenant,
      subscription: { ...withTenant.subscription, tenantId: null },
    };
    expectContractError(() =>
      readSubscriptionView(missingTenant, { tenantId: TENANT_ID }),
    );
  });

  it("normalizes raw subscription items with an absent features property to null", () => {
    const raw = subscriptionItem();
    Reflect.deleteProperty(raw, "features");
    const parsed = readSubscriptionItems([raw], { subscriptionId: SUBSCRIPTION_ID });
    expect(parsed[0]?.features).toBeNull();
  });

  it.each([
    ["enum", (value: ReturnType<typeof subscriptionView>) => {
      value.subscription.status = "UNKNOWN";
    }],
    ["UUID version", (value: ReturnType<typeof subscriptionView>) => {
      value.subscription.id = "019ff251-0000-4000-8000-000000000002";
    }],
    ["timestamp", (value: ReturnType<typeof subscriptionView>) => {
      value.subscription.updatedAt = "later";
    }],
    ["money precision", (value: ReturnType<typeof subscriptionView>) => {
      value.subscription.totalPrice = "10.00000";
    }],
    ["seat aggregate", (value: ReturnType<typeof subscriptionView>) => {
      value.effectiveAllowedUsers = 3;
    }],
    ["module projection", (value: ReturnType<typeof subscriptionView>) => {
      value.enabledModules = ["module.trading"];
    }],
    ["line total aggregate", (value: ReturnType<typeof subscriptionView>) => {
      value.subscription.totalPrice = "11.0000";
    }],
    ["cross-item subscription", (value: ReturnType<typeof subscriptionView>) => {
      value.items.push(subscriptionItem({
        id: "019ff251-0000-7000-8000-000000000020",
        moduleId: "019ff251-0000-7000-8000-000000000021",
        moduleKey: "trade",
        subscriptionId: "019ff251-0000-7000-8000-000000000022",
      }));
    }],
  ])("rejects an invalid %s", (_label, mutate) => {
    const value = clone(subscriptionView());
    mutate(value);
    expectContractError(() => readSubscriptionView(value));
  });

  it("rejects duplicate modules and duplicate feature grants", () => {
    expectContractError(() =>
      readSubscriptionItems([
        subscriptionItem(),
        subscriptionItem({ id: "019ff251-0000-7000-8000-000000000020" }),
      ]),
    );
    expectContractError(() =>
      readSubscriptionItems([
        subscriptionItem({ features: ["crm.read", "crm.read"] }),
      ]),
    );
  });
});

describe("subscription lifecycle mutation readers", () => {
  it("reads a financially consistent plan-change preview", () => {
    expect(
      readPlanChangePreview(planPreview(), {
        tenantId: TENANT_ID,
        subscriptionId: SUBSCRIPTION_ID,
        previewId: PREVIEW_ID,
      }).financial.canApply,
    ).toBe(true);
  });

  it.each([
    ["hash", (value: ReturnType<typeof planPreview>) => {
      value.planFingerprint = "A".repeat(64);
    }],
    ["expiry", (value: ReturnType<typeof planPreview>) => {
      value.expiresAt = NOW;
    }],
    ["operation shape", (value: ReturnType<typeof planPreview>) => {
      value.operation = "ADD";
    }],
    ["full-period delta", (value: ReturnType<typeof planPreview>) => {
      value.financial.fullPeriodDeltaUsd = "3.0000";
    }],
    ["direction", (value: ReturnType<typeof planPreview>) => {
      value.financial.direction = "CREDIT";
    }],
    ["shortfall", (value: ReturnType<typeof planPreview>) => {
      value.financial.walletShortfallUsd = "1.0000";
    }],
    ["application eligibility", (value: ReturnType<typeof planPreview>) => {
      value.financial.canApply = false;
    }],
  ])("rejects an invalid plan-change %s", (_label, mutate) => {
    const value = clone(planPreview());
    mutate(value);
    expectContractError(() => readPlanChangePreview(value));
  });

  it("enforces ADD and REMOVE result shapes", () => {
    const applied = readPlanChangeApplyResult(
      {
        previewId: PREVIEW_ID,
        operation: "CHANGE",
        appliedAt: LATER,
        item: {
          id: ITEM_ID,
          subscriptionId: SUBSCRIPTION_ID,
          moduleId: MODULE_ID,
          tierId: NEXT_TIER_ID,
          seats: 3,
          lineTotal: "12.0000",
        },
        removedItemId: null,
        wallet: { direction: "DEBIT", amountUsd: "1.0000" },
        subscriptionTotalUsd: "12.0000",
      },
      { previewId: PREVIEW_ID, subscriptionId: SUBSCRIPTION_ID },
    );
    expect(applied.item?.seats).toBe(3);

    expectContractError(() =>
      readPlanChangeApplyResult({ ...applied, operation: "REMOVE" }),
    );
    expectContractError(() =>
      readPlanChangeApplyResult({
        ...applied,
        wallet: { direction: "NONE", amountUsd: "1.0000" },
      }),
    );
  });

  it("enforces immediate and scheduled cancellation semantics", () => {
    expect(
      readCancellationResult(
        {
          tenantId: TENANT_ID,
          subscriptionId: SUBSCRIPTION_ID,
          status: "CANCELLED",
          cancelAt: LATER,
          scheduled: false,
          changed: true,
          appliedAt: LATER,
        },
        { tenantId: TENANT_ID, subscriptionId: SUBSCRIPTION_ID },
      ).status,
    ).toBe("CANCELLED");

    expectContractError(() =>
      readCancellationResult({
        tenantId: TENANT_ID,
        subscriptionId: SUBSCRIPTION_ID,
        status: "CANCELLED",
        cancelAt: LATER,
        scheduled: true,
        changed: true,
        appliedAt: null,
      }),
    );
  });
});

describe("wallet readers", () => {
  it("enforces canonical USD wallet arithmetic and exact lifecycle states", () => {
    expect(
      readWallet({
        currencyCode: "USD",
        balanceUsd: "20.0000",
        reservedBalanceUsd: "5.0000",
        availableBalanceUsd: "15.0000",
        status: "ACTIVE",
      }).availableBalanceUsd,
    ).toBe("15.0000");

    expectContractError(() =>
      readWallet({
        currencyCode: "USD",
        balanceUsd: "20.0000",
        reservedBalanceUsd: "5.0000",
        availableBalanceUsd: "16.0000",
        status: "ACTIVE",
      }),
    );
  });

  it("requires one leading USD base currency, unique codes, and exact total", () => {
    expect(
      readWalletInputCurrencies({
        walletCurrencyCode: "USD",
        items: [
          { currencyCode: "USD", isBaseCurrency: true },
          { currencyCode: "EUR", isBaseCurrency: false },
        ],
        total: 2,
      }).total,
    ).toBe(2);
    expectContractError(() =>
      readWalletInputCurrencies({
        walletCurrencyCode: "USD",
        items: [
          { currencyCode: "EUR", isBaseCurrency: false },
          { currencyCode: "USD", isBaseCurrency: true },
        ],
        total: 2,
      }),
    );
  });

  it("strictly reads ledger money, FX evidence, actor and wallet identity", () => {
    const ledger = {
      id: LEDGER_ID,
      walletId: WALLET_ID,
      direction: "CREDIT",
      amountUsd: "2.0000",
      sourceAmount: "100.0000",
      sourceCurrencyCode: "EUR",
      currencyUnitsPerUsd: "50.000000000000",
      rateRevisionId: RATE_ID,
      rateObservedAt: NOW,
      balanceAfterUsd: "12.0000",
      reason: "TOP_UP",
      actor: { type: "ADMIN", id: MAKER_ID },
      referenceType: "offline_payment",
      referenceId: PAYMENT_ID,
      note: "Recorded offline",
      createdAt: LATER,
    };
    expect(readWalletLedger(ledger, { walletId: WALLET_ID }).sourceCurrencyCode).toBe("EUR");
    expectContractError(() => readWalletLedger({ ...ledger, amountUsd: "0.0000" }));
    expectContractError(() =>
      readWalletLedger({ ...ledger, actor: { type: "ADMIN", id: null } }),
    );
    expectContractError(() =>
      readWalletLedger({ ...ledger, rateObservedAt: null }),
    );
    expectContractError(() =>
      readWalletLedger({ ...ledger, amountUsd: "2.0001" }),
    );
  });

  it("enforces wallet-adjustment quote direction, FX and balance arithmetic", () => {
    const preview = {
      quoteId: PREVIEW_ID,
      purpose: "ADMIN_WALLET_ADJUSTMENT",
      sourceAmount: "5.0000",
      sourceCurrencyCode: "USD",
      amountUsd: "5.0000",
      currencyUnitsPerUsd: "1.000000000000",
      rateRevisionId: null,
      rateObservedAt: NOW,
      expiresAt: LATER,
      direction: "CREDIT",
      reasonCode: "MANUAL_CREDIT",
      balanceBeforeUsd: "10.0000",
      balanceAfterUsd: "15.0000",
    };
    expect(readWalletAdjustmentPreview(preview, { previewId: PREVIEW_ID }).amountUsd).toBe("5.0000");
    expectContractError(() =>
      readWalletAdjustmentPreview({ ...preview, reasonCode: "MANUAL_DEBIT" }),
    );
    expectContractError(() =>
      readWalletAdjustmentPreview({ ...preview, balanceAfterUsd: "14.0000" }),
    );
    expectContractError(() =>
      readWalletAdjustmentPreview({ ...preview, rateRevisionId: RATE_ID }),
    );
    expectContractError(() =>
      readWalletAdjustmentPreview({ ...preview, amountUsd: "4.9999" }),
    );
  });
});

describe("payment, invoice and reconciliation readers", () => {
  it("enforces payment purpose shape, exact enums, money arithmetic and identity", () => {
    expect(readPayment(payment(), { paymentId: PAYMENT_ID }).totalAppliedUsd).toBe("15.0000");
    expectContractError(() => readPayment(payment({ invoiceId: null })));
    expectContractError(() => readPayment(payment({ totalAppliedUsd: "14.0000" })));
    expectContractError(() => readPayment(payment({ providerCurrencyCode: "usd" })));
    expectContractError(() =>
      readPayment(payment(), {
        paymentId: "019ff251-0000-7000-8000-000000000099",
      }),
    );
  });

  it("reads canonical USD and legacy invoice shapes without mixing amount models", () => {
    const canonical = {
      tenantId: TENANT_ID,
      subscriptionId: SUBSCRIPTION_ID,
      currentCollectionInvoice: {
        id: INVOICE_ID,
        number: "INV-2026-0001",
        purpose: "RENEWAL",
        status: "PARTIALLY_PAID",
        currencyCode: "USD",
        canonicalUsd: true,
        totalUsd: "20.0000",
        amountPaidUsd: "5.0000",
        outstandingUsd: "15.0000",
        legacyOriginalAmounts: null,
        periodStart: NOW,
        periodEnd: FUTURE,
        issuedAt: NOW,
        dueAt: FUTURE,
        paidAt: null,
      },
    };
    expect(readBillingSummary(canonical, { tenantId: TENANT_ID }).currentCollectionInvoice?.canonicalUsd).toBe(true);

    const legacy = clone(canonical);
    Object.assign(legacy.currentCollectionInvoice, {
      currencyCode: "EUR",
      canonicalUsd: false,
      totalUsd: null,
      amountPaidUsd: null,
      outstandingUsd: null,
      legacyOriginalAmounts: {
        currencyCode: "EUR",
        subtotal: "18.0000",
        taxTotal: "2.0000",
        total: "20.0000",
      },
    });
    expect(readBillingSummary(legacy).currentCollectionInvoice?.legacyOriginalAmounts?.currencyCode).toBe("EUR");

    const invalid = clone(canonical);
    invalid.currentCollectionInvoice.outstandingUsd = "14.0000";
    expectContractError(() => readBillingSummary(invalid));
  });

  it("enforces reconciliation case and row identity, state shape and maker/checker", () => {
    const parsed = readReconciliationCase(reconciliationCase(), {
      tenantId: TENANT_ID,
      paymentId: PAYMENT_ID,
    });
    expect(parsed.reconciliations[0]?.paymentStatus).toBe("REQUIRES_REVIEW");

    const wrongPayment = reconciliationCase({
      reconciliations: [
        reconciliation({
          paymentId: "019ff251-0000-7000-8000-000000000099",
        }),
      ],
    });
    expectContractError(() => readReconciliationCase(wrongPayment));

    expectContractError(() =>
      readReconciliationCase(reconciliationCase({
        eligibleActions: ["CONFIRM_FAILED", "CONFIRM_FAILED"],
      })),
    );

    expect(
      readReconciliation(reconciliation({
        status: "APPLIED",
        decidedByAdminId: CHECKER_ID,
        decisionNote: "Approved after provider review.",
        decidedAt: LATER,
      })).decidedByAdminId,
    ).toBe(CHECKER_ID);

    expectContractError(() =>
      readReconciliation(reconciliation({
        status: "APPLIED",
        decidedByAdminId: MAKER_ID,
        decisionNote: "Approved after provider review.",
        decidedAt: LATER,
      })),
    );
  });

  it("requires refund outcome evidence only for CONFIRM_REFUNDED", () => {
    expect(
      readReconciliation(reconciliation({
        action: "CONFIRM_REFUNDED",
        providerOutcomeReference: "provider-refund-1",
      })).providerOutcomeReference,
    ).toBe("provider-refund-1");
    expectContractError(() =>
      readReconciliation(reconciliation({
        action: "CONFIRM_REFUNDED",
        providerOutcomeReference: null,
      })),
    );
  });

  it("requires derived unexpected-refund outcome evidence", () => {
    const base = reconciliationCase();
    const valid = {
      ...base,
      payment: {
        ...base.payment,
        unexpectedRefundEventReference: "refund-event-1",
        unexpectedRefundProviderOutcomeReference: "webhook:refund-event-1",
      },
    };
    expect(readReconciliationCase(valid).payment.unexpectedRefundEventReference).toBe("refund-event-1");

    valid.payment.unexpectedRefundProviderOutcomeReference = "different";
    expectContractError(() => readReconciliationCase(valid));
  });
});
