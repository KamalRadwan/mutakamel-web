// @vitest-environment jsdom

import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantBillingPermissions } from "../types";

const api = vi.hoisted(() => ({
  getSubscription: vi.fn(),
  seedSubscription: vi.fn(),
  previewPlanChange: vi.fn(),
  applyPlanChange: vi.fn(),
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
    permissionState.current = {
      ...NONE,
      canReadSubscription: true,
      canUpdateSubscription: true,
    };
    api.getSubscription.mockResolvedValue({
      subscription: { id: "subscription-1", status: "ACTIVE" },
      items: [],
    });
    api.previewPlanChange
      .mockRejectedValueOnce(normalizedError(503, "HTTP_503"))
      .mockRejectedValueOnce(normalizedError(422, "PLAN_INVALID"))
      .mockRejectedValueOnce(normalizedError(503, "HTTP_503"));

    const { result } = renderHook(() => useTenantBillingWorkspace(tenantId));
    await waitFor(() => expect(result.current.subscriptionState).toBe("ready"));

    await act(async () => {
      await result.current.previewPlanChange({
        operation: "ADD",
        moduleKey: "crm",
        tierKey: "basic",
        seats: 1,
      });
    });
    const ambiguousKey = api.previewPlanChange.mock.calls[0]?.[2];

    await act(async () => {
      await result.current.previewPlanChange({
        operation: "ADD",
        moduleKey: "crm",
        tierKey: "basic",
        seats: 1,
      });
    });
    expect(api.previewPlanChange.mock.calls[1]?.[2]).toBe(ambiguousKey);

    await act(async () => {
      await result.current.previewPlanChange({
        operation: "ADD",
        moduleKey: "crm",
        tierKey: "basic",
        seats: 1,
      });
    });
    expect(api.previewPlanChange.mock.calls[2]?.[2]).not.toBe(ambiguousKey);
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
    permissionState.current = {
      ...NONE,
      canReadSubscription: true,
      canUpdateSubscription: true,
    };
    api.getSubscription.mockImplementation(async (id: string) => ({
      subscription: { id: `subscription-${id}`, status: "ACTIVE" },
      items: [],
    }));
    const preview = deferred<Record<string, unknown>>();
    api.previewPlanChange.mockReturnValue(preview.promise);

    const { result, rerender } = renderHook(
      ({ id }) => useTenantBillingWorkspace(id),
      { initialProps: { id: "tenant-a" } },
    );
    await waitFor(() => expect(result.current.subscription?.subscription.id).toBe("subscription-tenant-a"));

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.previewPlanChange({
        operation: "ADD",
        moduleKey: "crm",
        tierKey: "basic",
        seats: 1,
      });
    });
    rerender({ id: "tenant-b" });
    await waitFor(() => expect(result.current.subscription?.subscription.id).toBe("subscription-tenant-b"));
    rerender({ id: "tenant-a" });
    await waitFor(() => expect(result.current.subscription?.subscription.id).toBe("subscription-tenant-a"));

    preview.resolve({
      previewId: "late-preview",
      expiresAt: "2099-01-01T00:00:00.000Z",
      financial: { canApply: true },
    });
    await act(async () => {
      await pending;
    });
    expect(result.current.planPreview).toBeNull();
  });

  it("keeps a newer preview when an older same-scope response arrives late", async () => {
    permissionState.current = {
      ...NONE,
      canReadSubscription: true,
      canUpdateSubscription: true,
    };
    api.getSubscription.mockResolvedValue({
      subscription: { id: "subscription", status: "ACTIVE" },
      items: [],
    });
    const older = deferred<Record<string, unknown>>();
    const newer = deferred<Record<string, unknown>>();
    api.previewPlanChange
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    const { result } = renderHook(() => useTenantBillingWorkspace(tenantId));
    await waitFor(() => expect(result.current.subscriptionState).toBe("ready"));
    let olderRequest!: Promise<unknown>;
    let newerRequest!: Promise<unknown>;
    act(() => {
      olderRequest = result.current.previewPlanChange({
        operation: "ADD",
        moduleKey: "crm",
        tierKey: "basic",
        seats: 1,
      });
      newerRequest = result.current.previewPlanChange({
        operation: "ADD",
        moduleKey: "crm",
        tierKey: "growth",
        seats: 2,
      });
    });
    newer.resolve({
      previewId: "newer-preview",
      expiresAt: "2099-01-01T00:00:00.000Z",
      financial: { canApply: true },
    });
    await act(async () => {
      await newerRequest;
    });
    expect(result.current.planPreview?.previewId).toBe("newer-preview");

    older.resolve({
      previewId: "older-preview",
      expiresAt: "2099-01-01T00:00:00.000Z",
      financial: { canApply: true },
    });
    await act(async () => {
      await olderRequest;
    });
    expect(result.current.planPreview?.previewId).toBe("newer-preview");
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
    permissionState.current = {
      ...NONE,
      canReadSubscription: true,
      canUpdateSubscription: true,
      canApplySubscriptionUpdate: true,
    };
    api.getSubscription.mockResolvedValue({
      subscription: { id: "subscription", status: "PAST_DUE" },
      items: [],
    });

    const { result } = renderHook(() => useTenantBillingWorkspace(tenantId));
    await waitFor(() => expect(result.current.subscriptionState).toBe("ready"));
    await act(async () => {
      await result.current.previewPlanChange({ operation: "REMOVE", itemId: "item" });
    });
    expect(api.previewPlanChange).not.toHaveBeenCalled();
    expect(result.current.mutation.error?.errorCode).toBe("SUBSCRIPTION_UPDATE_NOT_ALLOWED");
  });

  it("refuses to apply an expired server-priced plan preview", async () => {
    permissionState.current = {
      ...NONE,
      canReadSubscription: true,
      canUpdateSubscription: true,
      canApplySubscriptionUpdate: true,
    };
    api.getSubscription.mockResolvedValue({
      subscription: { id: "subscription", status: "ACTIVE" },
      items: [],
    });
    api.previewPlanChange.mockResolvedValue({
      previewId: "019f0000-0000-7000-8000-000000000020",
      expiresAt: "2000-01-01T00:00:00.000Z",
      financial: { canApply: true },
    });

    const { result } = renderHook(() => useTenantBillingWorkspace(tenantId));
    await waitFor(() => expect(result.current.subscriptionState).toBe("ready"));
    await act(async () => {
      await result.current.previewPlanChange({
        operation: "REMOVE",
        itemId: "019f0000-0000-7000-8000-000000000021",
      });
    });
    expect(result.current.planPreview?.previewId).toBe(
      "019f0000-0000-7000-8000-000000000020",
    );

    await act(async () => {
      await result.current.applyPlanChange();
    });
    expect(api.applyPlanChange).not.toHaveBeenCalled();
    expect(result.current.planPreview).toBeNull();
    expect(result.current.mutation.error?.errorCode).toBe(
      "SUBSCRIPTION_PREVIEW_EXPIRED",
    );
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

  /**
   * UI-018. The preview commit had no generation, so a preview requested for an
   * earlier draft could land after the operator edited the draft - and then sat
   * there confirmable, priced against terms it never saw. Clearing the preview
   * is what the panel does on an edit, so it has to disown whatever is still in
   * flight as well.
   */
  it("drops a plan preview that lands after the draft was cleared", async () => {
    permissionState.current = {
      ...NONE,
      canReadSubscription: true,
      canUpdateSubscription: true,
    };
    api.getSubscription.mockResolvedValue({
      subscription: { id: "subscription", status: "ACTIVE" },
      items: [],
    });
    let resolveStale: ((value: unknown) => void) | undefined;
    api.previewPlanChange.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
    );

    const { result } = renderHook(() => useTenantBillingWorkspace(tenantId));
    await waitFor(() => expect(result.current.subscriptionState).toBe("ready"));

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.previewPlanChange({
        operation: "ADD",
        moduleKey: "crm",
        tierKey: "basic",
        seats: 1,
      });
    });

    // The operator edits the draft; the panel clears the preview.
    act(() => result.current.clearPlanPreview());

    await act(async () => {
      resolveStale?.({ id: "stale-preview" });
      await pending;
    });

    expect(result.current.planPreview).toBeNull();
  });

});

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
