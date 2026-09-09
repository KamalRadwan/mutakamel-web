// @vitest-environment jsdom

import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantBillingPermissions } from "../types";

const api = vi.hoisted(() => ({
  getSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  getWallet: vi.fn(),
  getInputCurrencies: vi.fn(),
  getLedger: vi.fn(),
  previewWalletAdjustment: vi.fn(),
  confirmWalletAdjustment: vi.fn(),
  getPayments: vi.fn(),
  getBillingSummary: vi.fn(),
  recordOfflinePayment: vi.fn(),
  refundPayment: vi.fn(),
  getReconciliationCase: vi.fn(),
  proposeReconciliation: vi.fn(),
  decideReconciliation: vi.fn(),
}));

const commercialApi = vi.hoisted(() => ({ prepare: vi.fn(), preview: vi.fn(), apply: vi.fn(), getOperation: vi.fn(), getReceipt: vi.fn(), recover: vi.fn() }));
vi.mock("@/features/admin/subscriptions/commercial-change/commercial-change.api", () => ({ commercialChangeApi: commercialApi }));
const permissionState = vi.hoisted(() => ({
  current: {} as TenantBillingPermissions,
}));
const authState = vi.hoisted(() => ({
  current: { user: { id: "admin", permissions: [] as string[] }, isLoading: false },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authState.current,
}));
vi.mock("../api/tenant-billing.api", () => ({ tenantBillingApi: api }));
vi.mock("../model/permissions", () => ({
  readTenantBillingPermissions: () => permissionState.current,
}));

import { useTenantBillingWorkspace } from "./useTenantBillingWorkspace";
import { useCommercialChangeWorkspace } from "@/features/admin/subscriptions/commercial-change/hooks/useCommercialChangeWorkspace";
import { commercialFixture, commercialOperationFixture, commercialPreviewFixture } from "../model/subscription-commercial-fixtures";
import { adaptSubscriptionCommercial } from "../model/subscription-commercial";

const NONE: TenantBillingPermissions = {
  canReadSubscription: false,
  canCreateSubscription: false,
  canUpdateSubscription: false,
  canApplySubscriptionUpdate: false,
  canCancelSubscription: false,
  canReadWallet: false,
  canPreviewWalletAdjustment: false,
  canConfirmWalletAdjustment: false,
  canReadBillingSummary: false,
  canRecordOfflinePayment: false,
  canRefundPayment: false,
  canReconcilePayment: false,
  canDecideReconciliation: false,
};

const tenantId = "019f0000-0000-7000-8000-000000000001";

describe("useTenantBillingWorkspace", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    Object.values(commercialApi).forEach((mock) => mock.mockReset());
    window.sessionStorage.clear();
    permissionState.current = { ...NONE };
    authState.current = {
      user: { id: "admin", permissions: [] },
      isLoading: false,
    };
  });

  it("does no I/O while the billing tab is disabled", async () => {
    renderHook(() => useTenantBillingWorkspace(tenantId, { enabled: false }));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 5));
    });
    expect(api.getSubscription).not.toHaveBeenCalled();
    expect(api.getWallet).not.toHaveBeenCalled();
    expect(api.getPayments).not.toHaveBeenCalled();
  });

  it("keeps whole-subscription cancellation available independently of aggregate changes", async () => {
    permissionState.current = { ...NONE, canReadSubscription: true, canCancelSubscription: true, canUpdateSubscription: true, canApplySubscriptionUpdate: true };
    api.getSubscription.mockResolvedValue(adaptSubscriptionCommercial(commercialFixture()));
    const receipt = { status: "ACTIVE", scheduled: true, changed: true };
    api.cancelSubscription.mockResolvedValue(receipt);
    const { result } = renderHook(() => useTenantBillingWorkspace(tenantId));
    await waitFor(() => expect(result.current.subscriptionState).toBe("ready"));
    expect("previewPlanChange" in result.current).toBe(false);
    await act(async () => { expect(await result.current.cancelSubscription()).toEqual(receipt); });
    expect(api.cancelSubscription).toHaveBeenCalledWith(tenantId, expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
    expect(api.getSubscription).toHaveBeenCalledTimes(2);
  });

  it.each(["permission", "already scheduled", "cancelled"])('does not bypass cancellation eligibility for addons: %s', async reason => {
    permissionState.current = { ...NONE, canReadSubscription: true, canCancelSubscription: reason !== "permission" };
    const value = commercialFixture();
    if (reason === "already scheduled") value.subscription.cancelAt = "2026-10-01T00:00:00.000Z";
    if (reason === "cancelled") value.subscription.status = "CANCELLED";
    api.getSubscription.mockResolvedValue(adaptSubscriptionCommercial(value));
    const { result } = renderHook(() => useTenantBillingWorkspace(tenantId));
    await waitFor(() => expect(result.current.subscriptionState).toBe("ready"));
    await act(async () => { expect(await result.current.cancelSubscription()).toBeNull(); });
    expect(api.cancelSubscription).not.toHaveBeenCalled();
  });

  it("fails closed by resource permission without issuing requests", async () => {
    const { result } = renderHook(() => useTenantBillingWorkspace(tenantId));
    await waitFor(() => expect(result.current.subscriptionState).toBe("forbidden"));
    expect(result.current.walletState).toBe("forbidden");
    expect(result.current.billingSummaryState).toBe("forbidden");
    expect(Object.values(api).some((mock) => mock.mock.calls.length > 0)).toBe(false);
  });

  it("deduplicates the initial permitted reads under React Strict Mode", async () => {
    permissionState.current = { ...NONE, canReadSubscription: true };
    api.getSubscription.mockResolvedValue({
      subscription: { id: "subscription", status: "ACTIVE" },
      items: [],
    });

    const { result } = renderHook(() => useTenantBillingWorkspace(tenantId), {
      wrapper: StrictMode,
    });

    await waitFor(() => expect(result.current.subscriptionState).toBe("ready"));
    expect(api.getSubscription).toHaveBeenCalledOnce();
    expect(api.getWallet).not.toHaveBeenCalled();
    expect(api.getBillingSummary).not.toHaveBeenCalled();
  });

  it("reuses an ambiguous command key and rotates it after a definitive outcome", async () => {
    allowCommercial();
    commercialApi.prepare.mockRejectedValueOnce(normalizedError(503, "HTTP_503"))
      .mockRejectedValueOnce(normalizedError(422, "COMMERCIAL_TARGET_INVALID"))
      .mockRejectedValueOnce(normalizedError(503, "HTTP_503"));
    const { result } = await commercialHook();
    await act(async () => { await result.current.prepare(); });
    const key = commercialApi.prepare.mock.calls[0]?.[2];
    expect(result.current.journal.pending?.key).toBe(key);
    await act(async () => { await result.current.retry(); });
    expect(commercialApi.prepare.mock.calls[1]?.[2]).toBe(key);
    expect(result.current.journal.pending).toBeNull();
    await act(async () => { await result.current.prepare(); });
    expect(commercialApi.prepare.mock.calls[2]?.[2]).not.toBe(key);
  });

  it("ignores a late reconciliation response for a previously selected payment", async () => {
    permissionState.current = {
      ...NONE,
      canReadWallet: true,
      canReconcilePayment: true,
    };
    api.getWallet.mockResolvedValue({ id: "wallet" });
    api.getInputCurrencies.mockResolvedValue({ currencies: [] });
    api.getLedger.mockResolvedValue(emptyPage());
    api.getPayments.mockResolvedValue(emptyPage());

    const first = deferred<Record<string, unknown>>();
    const second = deferred<Record<string, unknown>>();
    api.getReconciliationCase
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useTenantBillingWorkspace(tenantId));
    await waitFor(() => expect(result.current.walletState).toBe("ready"));

    let firstRequest!: Promise<unknown>;
    let secondRequest!: Promise<unknown>;
    act(() => {
      firstRequest = result.current.selectPayment("payment-a");
      secondRequest = result.current.selectPayment("payment-b");
    });
    second.resolve({
      payment: { paymentId: "payment-b", tenantId },
      eligibleActions: [],
      reconciliations: [],
    });
    await act(async () => {
      await secondRequest;
    });
    expect(result.current.reconciliationCase).toMatchObject({
      payment: { paymentId: "payment-b" },
    });

    first.resolve({
      payment: { paymentId: "payment-a", tenantId },
      eligibleActions: [],
      reconciliations: [],
    });
    await act(async () => {
      await firstRequest;
    });
    expect(result.current.reconciliationCase).toMatchObject({
      payment: { paymentId: "payment-b" },
    });
  });

  it("hides tenant-owned data synchronously when the route or principal changes", async () => {
    permissionState.current = { ...NONE, canReadSubscription: true };
    api.getSubscription.mockImplementation(async (id: string) => ({
      subscription: { id: `subscription-${id}`, status: "ACTIVE" },
      items: [],
    }));

    const { result, rerender } = renderHook(
      ({ id }) => useTenantBillingWorkspace(id),
      { initialProps: { id: "tenant-a" } },
    );
    await waitFor(() => expect(result.current.subscription?.subscription.id).toBe("subscription-tenant-a"));

    rerender({ id: "tenant-b" });
    expect(result.current.subscription).toBeNull();

    await waitFor(() => expect(result.current.subscription?.subscription.id).toBe("subscription-tenant-b"));
    authState.current = {
      user: { id: "different-admin", permissions: [] },
      isLoading: false,
    };
    permissionState.current = { ...NONE };
    rerender({ id: "tenant-b" });
    expect(result.current.subscription).toBeNull();
    expect(result.current.subscriptionState).toBe("forbidden");
  });

  it("rejects a late write result after an A to B to A ownership transition", async () => {
    allowCommercial();
    const pendingResult = deferred<ReturnType<typeof commercialOperationFixture>>();
    commercialApi.prepare.mockReturnValueOnce(pendingResult.promise);
    const first = await commercialHook();
    let pending!: Promise<unknown>;
    act(() => { pending = first.result.current.prepare(); });
    first.unmount();
    authState.current.user.id = "different-admin";
    const second = await commercialHook();
    expect(second.result.current.journal.pending).toBeNull();
    second.unmount();
    authState.current.user.id = "admin";
    const returned = await commercialHook(false);
    expect(returned.result.current.journal.pending?.kind).toBe("PREPARE");
    await act(async () => { pendingResult.resolve(commercialOperationFixture()); await pending; });
    expect(returned.result.current.operation).toBeNull();
    expect(returned.result.current.preview).toBeNull();
  });

  it("serializes priced previews so a late response cannot overwrite another intent", async () => {
    allowCommercial();
    commercialApi.prepare.mockResolvedValueOnce(commercialOperationFixture());
    const pendingResult = deferred<ReturnType<typeof commercialPreviewFixture>>();
    commercialApi.preview.mockReturnValueOnce(pendingResult.promise);
    const { result } = await commercialHook();
    await act(async () => { await result.current.prepare(); });
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.price(); });
    await act(async () => { await result.current.price(); });
    expect(commercialApi.preview).toHaveBeenCalledTimes(1);
    await act(async () => { pendingResult.resolve(commercialPreviewFixture()); await pending; });
    expect(result.current.preview?.previewId).toBe(commercialPreviewFixture().previewId);
    expect(result.current.reviewed).toBe(false);
  });

  it("keeps the wallet available when optional currency and ledger reads fail", async () => {
    permissionState.current = { ...NONE, canReadWallet: true };
    api.getWallet.mockResolvedValue({ status: "ACTIVE" });
    api.getInputCurrencies.mockRejectedValue(normalizedError(503, "CURRENCY_UNAVAILABLE"));
    api.getLedger.mockRejectedValue(normalizedError(503, "LEDGER_UNAVAILABLE"));
    api.getPayments.mockResolvedValue(emptyPage());

    const { result } = renderHook(() => useTenantBillingWorkspace(tenantId));
    await waitFor(() => expect(result.current.walletState).toBe("ready"));
    await waitFor(() => expect(result.current.inputCurrenciesState).toBe("error"));
    expect(result.current.wallet).toMatchObject({ status: "ACTIVE" });
    expect(result.current.ledgerState).toBe("error");
    expect(result.current.inputCurrenciesError?.errorCode).toBe("CURRENCY_UNAVAILABLE");
    expect(result.current.ledgerError?.errorCode).toBe("LEDGER_UNAVAILABLE");
  });

  it("blocks lifecycle-invalid financial commands before I/O", async () => {
    allowCommercial();
    const source = commercialFixture(); source.subscription.status = "PAST_DUE";
    const { result } = renderHook(() => useCommercialChangeWorkspace({ source, lang: "en", onCommitted: vi.fn() }));
    await waitFor(() => expect(result.current.journalReady).toBe(true));
    act(() => result.current.updateTarget(result.current.targets[0].selectionKey, { seats: 31 }));
    await act(async () => { await result.current.prepare(); });
    expect(commercialApi.prepare).not.toHaveBeenCalled();
    expect(result.current.lifecycleAllowsChange).toBe(false);
  });

  it("refuses to apply an expired server-priced plan preview", async () => {
    allowCommercial();
    commercialApi.prepare.mockResolvedValueOnce(commercialOperationFixture());
    const preview = commercialPreviewFixture(); preview.pricedAt = "1999-12-31T23:55:00.000Z"; preview.expiresAt = "2000-01-01T00:00:00.000Z";
    commercialApi.preview.mockResolvedValueOnce(preview);
    const { result } = await commercialHook();
    await act(async () => { await result.current.prepare(); });
    await act(async () => { await result.current.price(); });
    act(() => result.current.setReviewed(true));
    await act(async () => { await result.current.apply(); });
    expect(commercialApi.apply).not.toHaveBeenCalled();
    expect(result.current.expired).toBe(true);
    expect(result.current.preview?.previewId).toBe(preview.previewId);
  });

  it("records a normalized offline payment only for the authoritative open invoice", async () => {
    permissionState.current = {
      ...NONE,
      canReadBillingSummary: true,
      canRecordOfflinePayment: true,
    };
    api.getBillingSummary.mockResolvedValue({
      tenantId,
      subscriptionId: "019f0000-0000-7000-8000-000000000010",
      currentCollectionInvoice: {
        id: "019f0000-0000-7000-8000-000000000011",
        status: "ISSUED",
      },
    });
    api.recordOfflinePayment.mockResolvedValue({
      paymentId: "019f0000-0000-7000-8000-000000000012",
      invoiceId: "019f0000-0000-7000-8000-000000000011",
    });

    const { result } = renderHook(() => useTenantBillingWorkspace(tenantId));
    await waitFor(() => expect(result.current.billingSummaryState).toBe("ready"));
    await act(async () => {
      await result.current.recordOfflinePayment({
        amount: " 125.5000 ",
        currencyCode: "egp",
        reference: " receipt-42 ",
        note: " collected by finance ",
      });
    });

    expect(api.recordOfflinePayment).toHaveBeenCalledWith(
      "019f0000-0000-7000-8000-000000000011",
      {
        amount: "125.5000",
        currencyCode: "EGP",
        reference: "receipt-42",
        note: "collected by finance",
      },
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
  });

  // The canonical intent locks the draft before preparation begins.
  it("keeps the prepared draft locked while its preview is in flight", async () => {
    allowCommercial();
    commercialApi.prepare.mockResolvedValueOnce(commercialOperationFixture());
    const pendingResult = deferred<ReturnType<typeof commercialPreviewFixture>>();
    commercialApi.preview.mockReturnValueOnce(pendingResult.promise);
    const { result } = await commercialHook();
    await act(async () => { await result.current.prepare(); });
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.price(); });
    act(() => { result.current.updateTarget(result.current.targets[0].selectionKey, { seats: 50 }); result.current.reset(); });
    expect(result.current.targets[0].seats).toBe(31);
    expect(result.current.journal.request?.changes[0]).toMatchObject({ seats: 31 });
    await act(async () => { pendingResult.resolve(commercialPreviewFixture()); await pending; });
    expect(result.current.reviewed).toBe(false);
    expect(result.current.preview?.changes[0].toSeats).toBe(31);
  });

});

function allowCommercial() {
  authState.current.user.permissions = ["admin.subscriptions.read", "admin.subscriptions.update", "admin.subscriptions.critical"];
}
async function commercialHook(edit = true) {
  const source = commercialFixture(); const onCommitted = vi.fn();
  const hook = renderHook(() => useCommercialChangeWorkspace({ source, lang: "en", onCommitted }));
  await waitFor(() => expect(hook.result.current.journalReady).toBe(true));
  if (edit) act(() => hook.result.current.updateTarget(hook.result.current.targets[0].selectionKey, { seats: 31 }));
  return hook;
}

function normalizedError(httpStatus: number, errorCode: string) {
  return {
    isNormalized: true as const,
    httpStatus,
    errorCode,
    message: errorCode,
  };
}

function emptyPage() {
  return {
    items: [],
    meta: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
