import { axiosClient } from "@/lib/api/axiosClient";
import { contractFailure, readCommercialResponse } from "@/shared/api/commercial-contract";
import { adaptSubscriptionCommercial, readSubscriptionCommercial, readSubscriptionItems } from "../model/subscription-commercial";
import {
  readBillingSummary,
  readCancellationResult,
  readCoreData,
  readCorePage,
  readPayment,
  readReconciliation,
  readReconciliationCase,
  readWallet,
  readWalletAdjustmentPreview,
  readWalletInputCurrencies,
  readWalletLedger,
} from "../model/readers";
import type {
  OfflinePaymentDto,
  PaymentReconciliationAction,
  PreviewWalletAdjustmentDto,
  PageView,
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
    const config = { cache: "no-store" as const, signal };
    const [detailResponse, itemsResponse] = await Promise.all([
      axiosClient.get<unknown>(tenantPath(tenantId, "/subscription"), config),
      axiosClient.get<unknown>(tenantPath(tenantId, "/subscription/items"), config),
    ]);
    const detail = readCommercialResponse(detailResponse, value => {
      const next = readSubscriptionCommercial(value);
      if (next.subscription.tenantId !== tenantId) contractFailure();
      return next;
    }, false, 4 * 1024 * 1024 + 256);
    readCommercialResponse(itemsResponse, value => {
      const items = readSubscriptionItems(value);
      if (items.subscriptionId !== detail.subscription.id || items.subscriptionRevision !== detail.subscriptionRevision
        || JSON.stringify(items.baseItems) !== JSON.stringify(detail.baseItems) || JSON.stringify(items.addonSelections) !== JSON.stringify(detail.addonSelections)) contractFailure();
      return items;
    }, false, 4 * 1024 * 1024 + 256);
    return adaptSubscriptionCommercial(detail);
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
