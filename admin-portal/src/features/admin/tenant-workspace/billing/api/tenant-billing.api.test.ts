import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, post: postMock },
}));

vi.mock("../model/readers", () => ({
  readCoreData: (
    payload: { data: unknown },
    reader: (value: unknown) => unknown,
  ) => reader(payload.data),
  readCorePage: (
    payload: { data: unknown[]; meta: unknown },
    reader: (value: unknown) => unknown,
  ) => ({ items: payload.data.map(reader), meta: payload.meta }),
  readSubscriptionView: (value: unknown) => value,
  readSubscriptionItems: (value: unknown) => value,
  readCancellationResult: (value: unknown) => value,
  readWallet: (value: unknown) => value,
  readWalletInputCurrencies: (value: unknown) => value,
  readWalletLedger: (value: unknown) => value,
  readWalletAdjustmentPreview: (value: unknown) => value,
  readPayment: (value: unknown) => value,
  readBillingSummary: (value: unknown) => value,
  readReconciliationCase: (value: unknown) => value,
  readReconciliation: (value: unknown) => value,
}));

import { commercialFixture, commercialIds, commercialPreviewFixture, commercialReceiptFixture } from "../model/subscription-commercial-fixtures";
import { addonEnvelope } from "../../../applications/lib/addon-test-fixtures";
import { initialCommercialApi } from "../../../subscriptions/initial-commercial/initial-commercial.api";
import { initialQuoteFixture, initialReceiptFixture, initialRequestFixture, initialResponse, initialId } from "../../../subscriptions/initial-commercial/initial-commercial.fixture";
import { buildInitialSeedRequest } from "../../../subscriptions/initial-commercial/initial-commercial-request";
import { commercialChangeApi } from "@/features/admin/subscriptions/commercial-change/commercial-change.api";
import { tenantBillingApi } from "./tenant-billing.api";

const tenantId = "019f0000-0000-7000-8000-000000000001";
const paymentId = "019f0000-0000-7000-8000-000000000003";
const previewId = "019f0000-0000-7000-8000-000000000004";
const reconciliationId = "019f0000-0000-7000-8000-000000000005";
const key = "019f0000-0000-7000-8000-000000000006";

const envelope = (data: unknown, meta?: unknown) => ({ data: { data, meta } });

describe("tenant billing API contract", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockResolvedValue(
      envelope([], {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      }),
    );
    postMock.mockResolvedValue(envelope({}));
  });

  it("uses canonical subscription reads and the reviewed initial seed command", async () => {
    const detail = commercialFixture();
    const items = { subscriptionId: detail.subscription.id, subscriptionRevision: detail.subscriptionRevision,
      baseItems: detail.baseItems, addonSelections: detail.addonSelections };
    getMock.mockResolvedValueOnce(addonEnvelope(detail)).mockResolvedValueOnce(addonEnvelope(items));
    await tenantBillingApi.getSubscription(commercialIds.tenant);
    const quote = initialQuoteFixture(), dto = buildInitialSeedRequest(quote, initialRequestFixture());
    postMock.mockResolvedValueOnce(initialResponse(initialReceiptFixture()));
    await initialCommercialApi.seed(initialId(2), dto, quote, key);

    expect(getMock).toHaveBeenNthCalledWith(1,
      `/api/admin/core/v1/tenants/${commercialIds.tenant}/subscription`, { cache: "no-store", signal: undefined });
    expect(getMock).toHaveBeenNthCalledWith(2,
      `/api/admin/core/v1/tenants/${commercialIds.tenant}/subscription/items`, { cache: "no-store", signal: undefined });
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(postMock).toHaveBeenCalledWith(`/api/admin/core/v1/tenants/${initialId(2)}/subscription`,
      dto, { headers: { "x-idempotency-key": key }, replayAfterRefresh: true, cache: "no-store" });
  });

  it("reconciles a non-empty tenant ledger through the exact wallet-id route", async () => {
    const walletId = "019f0000-0000-7000-8000-000000000009";
    const row = { id: key, walletId };
    const meta = {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    };
    getMock
      .mockResolvedValueOnce(envelope([row], meta))
      .mockResolvedValueOnce(envelope([row], meta));

    await expect(tenantBillingApi.getLedger(tenantId)).resolves.toEqual({
      items: [row],
      meta,
    });
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/core/v1/wallets/${walletId}/ledger?page=1&limit=20`,
      undefined,
    );
  });

  it("uses preview/apply and the non-nested canonical cancellation route", async () => {
    const preview = commercialPreviewFixture();
    const dto = { expectedSubscriptionRevision: preview.subscriptionRevision, preparationId: preview.preparation.preparationId,
      changes: [{ selectionKey: preview.changes[0].selectionKey, sourceKind: "APPLICATION" as const, operation: "CHANGE" as const,
        itemId: commercialIds.item, tierId: commercialIds.tier, seats: 31 }] };
    postMock.mockResolvedValueOnce({ ...addonEnvelope(preview), status: 201 }).mockResolvedValueOnce(addonEnvelope(commercialReceiptFixture()));
    await commercialChangeApi.preview(commercialIds.subscription, dto, key);
    await commercialChangeApi.apply(commercialIds.subscription, preview, key);
    await tenantBillingApi.cancelSubscription(tenantId, key);
    expect(postMock).toHaveBeenNthCalledWith(1,
      `/api/admin/core/v1/subscriptions/${commercialIds.subscription}/plan-change-previews`, dto,
      { headers: { "x-idempotency-key": key }, replayAfterRefresh: true });
    expect(postMock).toHaveBeenNthCalledWith(2,
      `/api/admin/core/v1/subscriptions/${commercialIds.subscription}/plan-change-previews/${preview.previewId}/apply`, {},
      { headers: { "x-idempotency-key": key }, replayAfterRefresh: true });
    expect(postMock).toHaveBeenNthCalledWith(3, `/api/admin/core/v1/subscriptions/${tenantId}/cancel`, undefined, { headers: { "x-idempotency-key": key } });
  });

  it("uses wallet preview and confirmation instead of nonexistent credit/debit routes", async () => {
    const dto = {
      direction: "CREDIT" as const,
      sourceAmount: "100.0000",
      sourceCurrencyCode: "EGP",
      reasonCode: "MANUAL_CREDIT" as const,
    };
    await tenantBillingApi.getWallet(tenantId);
    await tenantBillingApi.getInputCurrencies();
    await tenantBillingApi.getLedger(tenantId, 2, 25);
    await tenantBillingApi.previewWalletAdjustment(tenantId, dto, key);
    await tenantBillingApi.confirmWalletAdjustment(
      tenantId,
      previewId,
      "Reviewed",
      key,
    );

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/core/v1/tenants/${tenantId}/wallet`,
      undefined,
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/core/v1/wallet/input-currencies",
      undefined,
    );
    expect(getMock).toHaveBeenNthCalledWith(
      3,
      `/api/admin/core/v1/tenants/${tenantId}/wallet/ledger?page=2&limit=25`,
      undefined,
    );
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/core/v1/tenants/${tenantId}/wallet/adjustments/preview`,
      dto,
      { headers: { "x-idempotency-key": key } },
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/core/v1/tenants/${tenantId}/wallet/adjustments`,
      { quoteId: previewId, note: "Reviewed" },
      { headers: { "x-idempotency-key": key } },
    );
    expect(postMock.mock.calls.flat().join(" ")).not.toContain("/credit");
    expect(postMock.mock.calls.flat().join(" ")).not.toContain("/debit");
  });

  it("records an offline payment on the current invoice with a caller-owned key", async () => {
    await tenantBillingApi.recordOfflinePayment(
      previewId,
      {
        amount: " 125.5000 ",
        currencyCode: "egp",
        reference: " counter-receipt-42 ",
        note: " received by finance ",
      },
      key,
    );

    expect(postMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/invoices/${previewId}/offline-payments`,
      {
        amount: "125.5000",
        currencyCode: "EGP",
        reference: "counter-receipt-42",
        note: "received by finance",
      },
      { headers: { "x-idempotency-key": key } },
    );
  });

  it("covers payment history, collection summary, refund, and reconciliation commands", async () => {
    await tenantBillingApi.getPayments(tenantId, 3, 10);
    await tenantBillingApi.getBillingSummary(tenantId);
    await tenantBillingApi.refundPayment(paymentId, "duplicate payment", key);
    await tenantBillingApi.getReconciliationCase(paymentId);
    const proposal = {
      action: "CONFIRM_FAILED" as const,
      evidenceReference: "case-42",
      note: "Provider evidence reviewed by finance.",
    };
    await tenantBillingApi.proposeReconciliation(paymentId, proposal, key);
    await tenantBillingApi.decideReconciliation(
      paymentId,
      reconciliationId,
      "APPROVE",
      "Independent evidence review complete.",
      key,
    );

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/core/v1/tenants/${tenantId}/payments?page=3&limit=10`,
      undefined,
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/core/v1/tenants/${tenantId}/billing-summary`,
      undefined,
    );
    expect(getMock).toHaveBeenNthCalledWith(
      3,
      `/api/admin/core/v1/payments/${paymentId}/reconciliations`,
      undefined,
    );
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/core/v1/payments/${paymentId}/refunds`,
      { note: "duplicate payment" },
      { headers: { "x-idempotency-key": key } },
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/core/v1/payments/${paymentId}/reconciliations`,
      proposal,
      { headers: { "x-idempotency-key": key } },
    );
    expect(postMock).toHaveBeenNthCalledWith(
      3,
      `/api/admin/core/v1/payments/${paymentId}/reconciliations/${reconciliationId}/decision`,
      { decision: "APPROVE", note: "Independent evidence review complete." },
      { headers: { "x-idempotency-key": key } },
    );
  });
});
