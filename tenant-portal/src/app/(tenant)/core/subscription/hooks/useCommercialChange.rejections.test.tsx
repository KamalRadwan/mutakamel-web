// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { commercialErrorMessage } from "../commercial-error-messages";
import { readCommercialIntent, retainCommercialIntent, type CommercialIntent } from "../commercial-intent";
import { createSubscriptionFixture } from "../subscription-read.fixture";
import { useCommercialChange } from "./useCommercialChange";

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), preview: vi.fn(), onApplied: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({
  user: { id: "018ef54e-2222-7777-8888-000000000010", isTenantOwner: true },
  isAuthenticated: true, authState: "AUTHENTICATED", realtimeAuthGeneration: "session-one",
}) }));
vi.mock("../commercial-command-api", () => ({
  prepareCommercialChange: mocks.prepare, previewCommercialChange: mocks.preview,
  previewDefinitionAdoptionChange: mocks.preview, applyCommercialChange: vi.fn(), recoverCommercialOperation: vi.fn(),
}));

const actorId = "018ef54e-2222-7777-8888-000000000010";
const view = createSubscriptionFixture().data;
const selectionKey = "018ef54e-2222-7777-8888-000000000012";
const addonSelectionId = "018ef54e-2222-7777-8888-000000000013";
const sources = [{ selectionKey, addonSelectionId, fromDefinitionVersionId: "018ef54e-2222-7777-8888-000000000014" }];
const cases = [
  { purpose: "PURCHASE" as const, storageKey: `tenant-commercial-intent:${actorId}`, sources: [],
    request: { expectedSubscriptionRevision: view.subscriptionRevision,
      changes: [{ sourceKind: "APPLICATION" as const, operation: "CHANGE" as const, selectionKey, itemId: view.baseItems[0].id, seats: 11 }] } },
  { purpose: "ADOPTION" as const, storageKey: `tenant-definition-adoption-intent:${actorId}`, sources,
    request: { expectedSubscriptionRevision: view.subscriptionRevision,
      changes: [{ sourceKind: "ADDON" as const, operation: "ADOPT_DEFINITION" as const, selectionKey,
        addonSelectionId, targetDefinitionVersionId: "018ef54e-2222-7777-8888-000000000015" }] } },
];
const rejections = [
  { status: 400, code: "COMMERCIAL_CONTRACT_INVALID", message: "unknown" as const },
  { status: 409, code: "COMMERCIAL_TARGET_INCOMPATIBLE", message: "targetIncompatible" as const },
  { status: 422, code: "COMMERCIAL_PRICE_UNAVAILABLE", message: "priceUnavailable" as const },
  { status: 409, code: "COMMERCIAL_CAPACITY_OCCUPIED", message: "capacityOccupied" as const },
  { status: 409, code: "ADDON_PREPARATION_STALE", message: "preparationStale" as const },
];
function failure(status: number, code: string) {
  return new TenantApiClientError("Private server detail", { status, statusText: "Rejected", headers: new Headers(),
    data: { code, message: "Private server detail", correlationId: "support-reference" } });
}

beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe.each(cases)("$purpose preparation rejections", ({ purpose, storageKey, request, sources: adoptionSources }) => {
  const renderChange = () => renderHook(() => useCommercialChange(
    purpose === "PURCHASE" ? view : null, mocks.onApplied, true,
    purpose === "ADOPTION" ? view.subscriptionRevision : undefined,
  ));

  it.each(rejections)("releases a first $status $code and keeps its mapped error", async ({ status, code, message }) => {
    mocks.prepare.mockRejectedValue(failure(status, code));
    const { result } = renderChange();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    await act(async () => result.current.start(request, adoptionSources));
    const originalKey = mocks.prepare.mock.calls[0][1];
    expect(result.current.state).toMatchObject({ phase: "idle", intent: null,
      error: { status, code, correlationId: "support-reference" } });
    expect(sessionStorage.getItem(storageKey)).toBeNull();
    expect(result.current.canStart).toBe(true);
    expect(result.current.canRetry).toBe(false);
    for (const dictionary of [en, ar]) {
      expect(commercialErrorMessage(dictionary.commercialPurchase, result.current.state?.error))
        .toBe(dictionary.commercialPurchase.errors[message]);
    }
    expect(mocks.onApplied).not.toHaveBeenCalled();
    await act(async () => result.current.start(request, adoptionSources));
    expect(mocks.prepare.mock.calls[1][1]).not.toBe(originalKey);
  });

  it.each(rejections)("retains a restored intent after $status $code", async ({ status, code }) => {
    const prepareKey = "018ef54e-2222-7777-8888-000000000016";
    const intent: CommercialIntent = { actorId, purpose, adoptionSources,
      subscriptionId: purpose === "PURCHASE" ? view.subscription.id : null, request, prepareKey,
      operationId: null, preview: null, expiredApplies: [], unresolvedPreviews: [], rejectedRecoveries: [],
      pending: { kind: "PREPARE", key: prepareKey } };
    retainCommercialIntent(actorId, null, intent);
    const saved = sessionStorage.getItem(storageKey);
    mocks.prepare.mockRejectedValue(failure(status, code));
    const { result } = renderChange();
    await waitFor(() => expect(result.current.canRetry).toBe(true));
    await act(async () => result.current.retry());
    expect(mocks.prepare).toHaveBeenCalledWith(request, prepareKey, expect.any(AbortSignal));
    expect(result.current.state?.phase).toBe("uncertain");
    expect(result.current.state?.intent).toEqual(intent);
    expect(sessionStorage.getItem(storageKey)).toBe(saved);
    expect(result.current.canStart).toBe(false);
  });

  it.each([
    { name: "network", error: new Error("Network failure") },
    { name: "5xx with a listed code", error: failure(500, "ADDON_PREPARATION_STALE") },
    { name: "unavailable", error: failure(503, "COMMERCIAL_COMMAND_UNAVAILABLE") },
    { name: "unknown conflict", error: failure(409, "UNRECOGNIZED_CONFLICT") },
    { name: "different status", error: failure(409, "COMMERCIAL_CONTRACT_INVALID") },
  ])("retains a first $name outcome and a later definite replay rejection", async ({ error }) => {
    mocks.prepare.mockRejectedValueOnce(error).mockRejectedValue(failure(409, "ADDON_PREPARATION_STALE"));
    const { result } = renderChange();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    await act(async () => result.current.start(request, adoptionSources));
    const intent = readCommercialIntent(actorId, purpose);
    const saved = sessionStorage.getItem(storageKey);
    expect(intent).not.toBeNull();
    expect(result.current.state?.phase).toBe("uncertain");
    expect(result.current.canRetry).toBe(true);
    expect(result.current.canStart).toBe(false);
    await act(async () => result.current.retry());
    expect(mocks.prepare).toHaveBeenNthCalledWith(1, request, intent!.prepareKey, expect.any(AbortSignal));
    expect(mocks.prepare).toHaveBeenNthCalledWith(2, request, intent!.prepareKey, expect.any(AbortSignal));
    expect(result.current.state?.phase).toBe("uncertain");
    expect(result.current.state?.intent).toEqual(intent);
    expect(sessionStorage.getItem(storageKey)).toBe(saved);
    expect(mocks.onApplied).not.toHaveBeenCalled();
  });

  it("retains an accepted preparation when a subsequent preview gets a listed rejection", async () => {
    const operationId = "018ef54e-2222-7777-8888-000000000016";
    mocks.prepare.mockResolvedValue({ operationId, operationRevision: "2", intentKind: "COMMERCIAL_CHANGE",
      state: "READY", phase: "READY", createdAt: "2026-10-29T10:00:00.000Z", updatedAt: "2026-10-29T10:00:00.000Z",
      terminalAt: null, safeReasonCode: null, retryAfterSeconds: null, relatedPreviewId: null,
      committedReceiptRef: null, projectionState: "NOT_REQUIRED" });
    mocks.preview.mockRejectedValue(failure(409, "ADDON_PREPARATION_STALE"));
    const { result } = renderChange();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    await act(async () => result.current.start(request, adoptionSources));
    expect(result.current.canQuote).toBe(true);
    await act(async () => result.current.quote());
    const intent = readCommercialIntent(actorId, purpose);
    expect(intent).toMatchObject({ operationId, request, pending: { kind: "PREVIEW" } });
    expect(result.current.state?.intent).toEqual(intent);
    expect(result.current.state?.phase).toBe("uncertain");
    expect(result.current.canStart).toBe(false);
    expect(result.current.canRetry).toBe(true);
  });

  it("keeps the journal and blocks new changes when storage removal fails", async () => {
    mocks.prepare.mockRejectedValue(failure(409, "ADDON_PREPARATION_STALE"));
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    const { result } = renderChange();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    await act(async () => result.current.start(request, adoptionSources));
    expect(result.current.state?.phase).toBe("storage");
    expect(readCommercialIntent(actorId, purpose)).toEqual(result.current.state?.intent);
    expect(result.current.state?.intent).not.toBeNull();
    expect(result.current.canStart).toBe(false);
  });
});
