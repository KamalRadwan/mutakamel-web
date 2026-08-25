import { axiosClient } from "@/lib/api/axiosClient";
import {
  readBillingSummary,
  readCancellationResult,
  readCoreData,
  readCorePage,
  readPayment,
  readPlanChangeApplyResult,
  readPlanChangePreview,
  readReconciliation,
  readReconciliationCase,
  readSubscriptionView,
  readSubscriptionItems,
  readWallet,
  readWalletAdjustmentPreview,
  readWalletInputCurrencies,
  readWalletLedger,
} from "../model/readers";
import type {
  CreateSubscriptionPlanChangePreviewDto,
  OfflinePaymentDto,
  PaymentReconciliationAction,
  PreviewWalletAdjustmentDto,
  SeedTenantSubscriptionDto,
  PageView,
  SubscriptionItemView,
  WalletLedgerView,
} from "../types";

const BASE = "/api/admin/core/v1";

function tenantPath(tenantId: string, suffix: string): string {
  return `${BASE}/tenants/${encodeURIComponent(tenantId)}${suffix}`;
}

function keyed(idempotencyKey: string) {
  return { headers: { "x-idempotency-key": idempotencyKey } };
}

function pageQuery(page: number, limit: number): string {
  return `?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`;
}

export const tenantBillingApi = {
  getSubscription: async (tenantId: string, signal?: AbortSignal) => {
    const [subscriptionResponse, itemsResponse] = await Promise.all([
      axiosClient.get<unknown>(
        tenantPath(tenantId, "/subscription"),
        signal ? { signal } : undefined,
      ),
      axiosClient.get<unknown>(
        tenantPath(tenantId, "/subscription/items"),
        signal ? { signal } : undefined,
      ),
    ]);
    const subscription = readCoreData(
      subscriptionResponse.data,
      readSubscriptionView,
    );
    const items = readCoreData(itemsResponse.data, (value) =>
      readSubscriptionItems(value, {
        subscriptionId: subscription.subscription.id,
      }),
    );
    assertSameSubscriptionItems(subscription.items, items);
    return {
      ...subscription,
      items: items.map((item) => {
        const embedded = subscription.items.find(
          (candidate) => candidate.id === item.id,
        );
        if (!embedded) throw new Error("SUBSCRIPTION_ITEMS_PROJECTION_DRIFT");
        return {
          ...embedded,
          ...item,
          features: item.features ?? embedded.features,
          moduleKey: item.moduleKey ?? embedded.moduleKey,
          moduleName: item.moduleName ?? embedded.moduleName,
          tierKey: item.tierKey ?? embedded.tierKey,
          tierName: item.tierName ?? embedded.tierName,
          currencyCode: item.currencyCode ?? embedded.currencyCode,
        };
      }),
    };
  },

  seedSubscription: async (
    tenantId: string,
    dto: SeedTenantSubscriptionDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<unknown>(
      tenantPath(tenantId, "/subscription"),
      dto,
      keyed(idempotencyKey),
    );
    return readCoreData(response.data, readSubscriptionView);
  },

  previewPlanChange: async (
    subscriptionId: string,
    dto: CreateSubscriptionPlanChangePreviewDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<unknown>(
      `${BASE}/subscriptions/${encodeURIComponent(subscriptionId)}/plan-change-previews`,
      dto,
      keyed(idempotencyKey),
    );
    return readCoreData(response.data, readPlanChangePreview);
  },

  applyPlanChange: async (
    subscriptionId: string,
    previewId: string,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<unknown>(
      `${BASE}/subscriptions/${encodeURIComponent(subscriptionId)}/plan-change-previews/${encodeURIComponent(previewId)}/apply`,
      undefined,
      keyed(idempotencyKey),
    );
    return readCoreData(response.data, readPlanChangeApplyResult);
  },

  cancelSubscription: async (tenantId: string, idempotencyKey: string) => {
    const response = await axiosClient.post<unknown>(
      `${BASE}/subscriptions/${encodeURIComponent(tenantId)}/cancel`,
      undefined,
      keyed(idempotencyKey),
    );
    return readCoreData(response.data, readCancellationResult);
  },

  getWallet: async (tenantId: string, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      tenantPath(tenantId, "/wallet"),
      signal ? { signal } : undefined,
    );
    return readCoreData(response.data, readWallet);
  },

  getInputCurrencies: async (signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${BASE}/wallet/input-currencies`,
      signal ? { signal } : undefined,
    );
    return readCoreData(response.data, readWalletInputCurrencies);
  },

  getLedger: async (
    tenantId: string,
    page = 1,
    limit = 20,
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.get<unknown>(
      `${tenantPath(tenantId, "/wallet/ledger")}${pageQuery(page, limit)}`,
      signal ? { signal } : undefined,
    );
    const tenantLedger = readCorePage(response.data, readWalletLedger);
    const walletId = tenantLedger.items[0]?.walletId;
    if (!walletId) return tenantLedger;
    if (tenantLedger.items.some((item) => item.walletId !== walletId)) {
      throw new Error("INVALID_TENANT_WALLET_LEDGER_RESPONSE");
    }
    const exactResponse = await axiosClient.get<unknown>(
      `${BASE}/wallets/${encodeURIComponent(walletId)}/ledger${pageQuery(page, limit)}`,
      signal ? { signal } : undefined,
    );
    const exactLedger = readCorePage(exactResponse.data, (value) =>
      readWalletLedger(value, { walletId }),
    );
    assertSameLedgerPage(tenantLedger, exactLedger);
    return exactLedger;
  },

  previewWalletAdjustment: async (
    tenantId: string,
    dto: PreviewWalletAdjustmentDto,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<unknown>(
      tenantPath(tenantId, "/wallet/adjustments/preview"),
      dto,
      keyed(idempotencyKey),
    );
    return readCoreData(response.data, readWalletAdjustmentPreview);
  },

  confirmWalletAdjustment: async (
    tenantId: string,
    quoteId: string,
    note: string,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<unknown>(
      tenantPath(tenantId, "/wallet/adjustments"),
      { quoteId, note: note.trim() },
      keyed(idempotencyKey),
    );
    return readCoreData(response.data, readWalletLedger);
  },

  getPayments: async (
    tenantId: string,
    page = 1,
    limit = 20,
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.get<unknown>(
      `${tenantPath(tenantId, "/payments")}${pageQuery(page, limit)}`,
      signal ? { signal } : undefined,
    );
    return readCorePage(response.data, readPayment);
  },

  getBillingSummary: async (tenantId: string, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      tenantPath(tenantId, "/billing-summary"),
      signal ? { signal } : undefined,
    );
    return readCoreData(response.data, readBillingSummary);
  },

  recordOfflinePayment: async (
    invoiceId: string,
    dto: OfflinePaymentDto,
    idempotencyKey: string,
  ) => {
    const body = {
      amount: dto.amount.trim(),
      currencyCode: dto.currencyCode.trim().toUpperCase(),
      reference: dto.reference.trim(),
      ...(dto.note?.trim() ? { note: dto.note.trim() } : {}),
    };
    const response = await axiosClient.post<unknown>(
      `${BASE}/invoices/${encodeURIComponent(invoiceId)}/offline-payments`,
      body,
      keyed(idempotencyKey),
    );
    return readCoreData(response.data, readPayment);
  },

  refundPayment: async (
    paymentId: string,
    note: string | undefined,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<unknown>(
      `${BASE}/payments/${encodeURIComponent(paymentId)}/refunds`,
      note?.trim() ? { note: note.trim() } : {},
      keyed(idempotencyKey),
    );
    return readCoreData(response.data, readPayment);
  },

  getReconciliationCase: async (paymentId: string, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${BASE}/payments/${encodeURIComponent(paymentId)}/reconciliations`,
      signal ? { signal } : undefined,
    );
    return readCoreData(response.data, readReconciliationCase);
  },

  proposeReconciliation: async (
    paymentId: string,
    dto: {
      action: PaymentReconciliationAction;
      evidenceReference: string;
      providerOutcomeReference?: string;
      note: string;
    },
    idempotencyKey: string,
  ) => {
    const body = {
      action: dto.action,
      evidenceReference: dto.evidenceReference.trim(),
      ...(dto.action === "CONFIRM_REFUNDED" &&
      dto.providerOutcomeReference?.trim()
        ? { providerOutcomeReference: dto.providerOutcomeReference.trim() }
        : {}),
      note: dto.note.trim(),
    };
    const response = await axiosClient.post<unknown>(
      `${BASE}/payments/${encodeURIComponent(paymentId)}/reconciliations`,
      body,
      keyed(idempotencyKey),
    );
    return readCoreData(response.data, readReconciliation);
  },

  decideReconciliation: async (
    paymentId: string,
    reconciliationId: string,
    decision: "APPROVE" | "REJECT",
    note: string,
    idempotencyKey: string,
  ) => {
    const response = await axiosClient.post<unknown>(
      `${BASE}/payments/${encodeURIComponent(paymentId)}/reconciliations/${encodeURIComponent(reconciliationId)}/decision`,
      { decision, note: note.trim() },
      keyed(idempotencyKey),
    );
    return readCoreData(response.data, readReconciliation);
  },
};

function assertSameSubscriptionItems(
  embedded: readonly SubscriptionItemView[],
  exact: readonly SubscriptionItemView[],
) {
  const fingerprint = (items: typeof embedded) =>
    items
      .map((item) =>
        [
          item.id,
          item.subscriptionId,
          item.moduleId,
          item.tierId,
          item.seats,
          item.lineTotal,
        ].join("|"),
      )
      .sort()
      .join("\n");
  if (fingerprint(embedded) !== fingerprint(exact)) {
    throw new Error("SUBSCRIPTION_ITEMS_PROJECTION_DRIFT");
  }
}

function assertSameLedgerPage(
  tenantLedger: PageView<WalletLedgerView>,
  exactLedger: PageView<WalletLedgerView>,
) {
  if (
    JSON.stringify(tenantLedger.meta) !== JSON.stringify(exactLedger.meta) ||
    tenantLedger.items.map((item) => item.id).join("|") !==
      exactLedger.items.map((item) => item.id).join("|")
  ) {
    throw new Error("WALLET_LEDGER_PROJECTION_DRIFT");
  }
}
