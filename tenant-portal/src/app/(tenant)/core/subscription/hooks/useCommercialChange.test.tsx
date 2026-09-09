// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { CommercialPreview } from "../commercial-preview";
import type { CommercialOperationReceipt } from "../commercial-operation";
import { createSubscriptionFixture } from "../subscription-read.fixture";
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), preview: vi.fn(), apply: vi.fn(), recover: vi.fn(), onApplied: vi.fn(), retryBootstrap: vi.fn() }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: "018ef54e-2222-7777-8888-000000000010", isTenantOwner: true },
  isAuthenticated: true, authState: "AUTHENTICATED", realtimeAuthGeneration: "session-one", retryBootstrap: mocks.retryBootstrap }) }));
vi.mock("../commercial-command-api", () => ({ prepareCommercialChange: mocks.prepare, previewCommercialChange: mocks.preview, applyCommercialChange: mocks.apply, recoverCommercialOperation: mocks.recover }));
const { useCommercialChange } = await import("./useCommercialChange");
const view = createSubscriptionFixture().data, item = view.baseItems[0];
const operation: CommercialOperationReceipt = { operationId: "018ef54e-2222-7777-8888-000000000011", operationRevision: "2", intentKind: "COMMERCIAL_CHANGE", state: "READY", phase: "READY",
  createdAt: "2026-09-07T19:00:00.000Z", updatedAt: "2026-09-07T19:01:00.000Z", terminalAt: null, safeReasonCode: null, retryAfterSeconds: null, relatedPreviewId: null, committedReceiptRef: null, projectionState: "NOT_REQUIRED" };
const request = { expectedSubscriptionRevision: view.subscriptionRevision, changes: [{ sourceKind: "APPLICATION" as const, operation: "CHANGE" as const,
  selectionKey: "018ef54e-2222-7777-8888-000000000012", itemId: item.id, seats: 11 }] };
const preview: CommercialPreview = { previewId: "018ef54e-2222-7777-8888-000000000013", operationId: "018ef54e-2222-7777-8888-000000000014",
  subscriptionId: view.subscription.id, subscriptionRevision: view.subscriptionRevision, actorBindingDigest: "a".repeat(64), targetSetDigest: "b".repeat(64),
  currencyCode: "USD", billingCycle: "MONTHLY", pricedAt: "2026-09-07T19:00:00.000Z", expiresAt: "2026-09-07T19:05:00.000Z", preparation: { preparationId: operation.operationId },
  changes: [{ ordinal: 1, selectionKey: request.changes[0].selectionKey, sourceKind: "APPLICATION", operation: "CHANGE", applicationId: item.applicationId, itemId: item.id,
    addonId: null, addonSelectionId: null, parentItemId: null, parentSelectionKey: null, fromSeats: 10, toSeats: 11, fromTierId: item.tierId, toTierId: item.tierId,
    fromDefinitionVersionId: null, toDefinitionVersionId: null, acceptedPricingBefore: item.acceptedPricing,
    acceptedPricingAfter: { ...item.acceptedPricing, recurringAmountUsd: "110.0000", breakdown: [{ ...item.acceptedPricing.breakdown[0], chargedUsers: 11, amountUsd: "110.0000" }] },
    previousAmountUsd: "100.0000", nextAmountUsd: "110.0000", fullPeriodDeltaUsd: "10.0000", proratedAllocationUsd: "0.1000" }],
  financial: { previousRecurringUsd: "115.0000", nextRecurringUsd: "125.0000", fullPeriodDeltaUsd: "10.0000", direction: "DEBIT", proratedAmountUsd: "0.1000",
    walletAvailableUsd: "5.0000", walletShortfallUsd: "0.0000", walletStatus: "ACTIVE", canApply: true } };
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); mocks.prepare.mockResolvedValue(operation);
  const pricedAt = Date.now();
  mocks.preview.mockResolvedValue({ ...preview, pricedAt: new Date(pricedAt).toISOString(), expiresAt: new Date(pricedAt + 300_000).toISOString() }); });
afterEach(cleanup);

describe("canonical plan-change admission", () => {
  it("never sends preparation, preview or apply while the coherent workspace disables changes", async () => {
    const { result } = renderHook(() => useCommercialChange(view, mocks.onApplied, false));
    await waitFor(() => expect(result.current.state?.phase).toBe("idle"));
    await act(async () => { await result.current.start(request); await result.current.quote(); await result.current.apply(); });
    expect(result.current.state?.intent).toBeNull(); expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.preview).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("prepares and quotes the supported seat increase with existing Addons retained", async () => {
    const { result } = renderHook(() => useCommercialChange(view, mocks.onApplied, true));
    await waitFor(() => expect(result.current.canStart).toBe(true));
    await act(async () => result.current.start(request));
    expect(mocks.prepare).toHaveBeenCalledWith(request, expect.stringMatching(/^[0-9a-f-]{14}7[0-9a-f-]{21}$/u), expect.any(AbortSignal));
    await act(async () => result.current.quote());
    expect(mocks.preview).toHaveBeenCalledWith(view.subscription.id, { ...request, preparationId: operation.operationId }, expect.stringMatching(/^[0-9a-f-]{14}7[0-9a-f-]{21}$/u), expect.any(AbortSignal));
    expect(result.current.state?.preview?.previewId).toBe(preview.previewId); expect(result.current.state?.phase).toBe("saved");
  });
  it("withdraws a prepared fresh action when a collection hold appears and retains the original intent", async () => {
    const { result, rerender } = renderHook(({ subscription }) => useCommercialChange(subscription, mocks.onApplied), { initialProps: { subscription: view } });
    await waitFor(() => expect(result.current.canStart).toBe(true));
    await act(async () => result.current.start(request)); await act(async () => result.current.quote());
    const original = result.current.state?.intent;
    rerender({ subscription: { ...view, subscription: { ...view.subscription, currentCollectionInvoiceId: "018ef54e-2222-7777-8888-000000000015" } } });
    expect(result.current.canQuote).toBe(false); expect(result.current.canApply).toBe(false); expect(result.current.state?.intent).toEqual(original);
    await act(async () => expect(await result.current.apply()).toBe(false));
    expect(mocks.apply).not.toHaveBeenCalled(); expect(mocks.onApplied).not.toHaveBeenCalled();
  });
});
