// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantCreateResult, TenantSubscriptionQuote } from "../types";

const {
  axiosGetMock,
  clearPendingCreateMock,
  createMock,
  getIdempotencyKeyMock,
  listCandidateApplicationsMock,
  listDatabasePlacementOptionsMock,
  persistPendingCreateMock,
  previewProvisioningPlanMock,
  pushMock,
  quoteMock,
  resetKeyMock,
  toastMock,
  validateIdentityMock,
} = vi.hoisted(() => ({
  axiosGetMock: vi.fn(),
  clearPendingCreateMock: vi.fn(),
  createMock: vi.fn(),
  getIdempotencyKeyMock: vi.fn(),
  listCandidateApplicationsMock: vi.fn(),
  listDatabasePlacementOptionsMock: vi.fn(),
  persistPendingCreateMock: vi.fn(),
  previewProvisioningPlanMock: vi.fn(),
  pushMock: vi.fn(),
  quoteMock: vi.fn(),
  resetKeyMock: vi.fn(),
  toastMock: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  validateIdentityMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", t: {} }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: {}, isLoading: false }),
}));

vi.mock("@/lib/auth/rbac", () => ({
  adminCan: () => true,
}));

vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => toastMock,
}));

vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => ({
    getIdempotencyKey: getIdempotencyKeyMock,
    resetKey: resetKeyMock,
  }),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: axiosGetMock },
  getAdminAuthHandling: (error: unknown) =>
    typeof error === "object" && error !== null && "adminAuthHandling" in error
      ? (error as { adminAuthHandling?: unknown }).adminAuthHandling
      : undefined,
  getApiRequestOutcome: (error: unknown) =>
    typeof error === "object" && error !== null && "requestOutcome" in error
      ? (error as { requestOutcome?: unknown }).requestOutcome
      : undefined,
}));

vi.mock("../api/tenant-registration.api", () => ({
  tenantRegistrationApi: {
    create: createMock,
    findCreateStatus: vi.fn(),
    listCandidateApplications: listCandidateApplicationsMock,
    listDatabasePlacementOptions: listDatabasePlacementOptionsMock,
    previewProvisioningPlan: previewProvisioningPlanMock,
    quote: quoteMock,
    validateIdentity: validateIdentityMock,
  },
}));

vi.mock("../lib/tenant-create-recovery", () => ({
  clearPendingTenantCreateStatusAttempt: clearPendingCreateMock,
  isTenantCreateDraftCurrent: (submitted: string, current: string) =>
    submitted === current,
  persistPendingTenantCreateStatusAttempt: persistPendingCreateMock,
  readPendingTenantCreateStatusAttempt: () => null,
  shouldRetainTenantCreateIntent: () => false,
}));

import { useRegisterTenant } from "./useRegisterTenant";

const applicationId = "019f0000-0000-7000-8000-000000000001";
const tierId = "019f0000-0000-7000-8000-000000000002";
const databaseId = "019f0000-0000-7000-8000-000000000003";
const storageId = "019f0000-0000-7000-8000-000000000004";
const quoteId = "019f0000-0000-7000-8000-000000000005";
const tenantId = "019f0000-0000-7000-8000-000000000006";
const idempotencyKey = "019f0000-0000-7000-8000-000000000007";

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function submitEvent(): React.FormEvent {
  return { preventDefault: vi.fn() } as unknown as React.FormEvent;
}

function adminAuthError(
  status: number,
  adminAuthHandling?: "session-ended" | "permission-denied" | "repair-degraded",
) {
  return {
    ...(adminAuthHandling ? { adminAuthHandling } : {}),
    response: {
      status,
      data: {
        message: "Authorization could not be restored.",
        errorCode:
          status === 403 ? "AUTH_CSRF_INVALID" : "COMMON.AUTH.MISSING_TOKEN",
        correlationId: "019f-auth-repair",
      },
    },
  };
}

function subscriptionQuote(): TenantSubscriptionQuote {
  return {
    quoteId,
    requestHash: "request-hash",
    pricingRevision: "1",
    billingCycle: "MONTHLY",
    currencyCode: "USD",
    total: "10.00",
    totalUsd: "10.00",
    items: [
      {
        moduleId: applicationId,
        tierId,
        seats: 1,
        lineTotal: "10.00",
        lineTotalUsd: "10.00",
      },
    ],
    expiresAt: "2030-01-01T00:00:00.000Z",
  };
}

async function renderReadyRegistration() {
  const rendered = renderHook(() => useRegisterTenant());

  await waitFor(() => {
    expect(rendered.result.current.applicationState).toBe("ready");
    expect(rendered.result.current.storagePlacementState).toBe("ready");
  });

  act(() => {
    rendered.result.current.selectCountry("EG");
    rendered.result.current.setFormData((current) => ({
      ...current,
      name: "acme",
      companyName: "Acme LLC",
      ownerEmail: "owner@example.com",
      ownerFirstName: "Ada",
      ownerLastName: "Lovelace",
      ownerPhone: "1000000000",
      ownerJobTitle: "Owner",
      storageServerId: storageId,
    }));
    rendered.result.current.toggleApplication("crm", true);
  });

  await waitFor(() => {
    expect(rendered.result.current.databasePlacementState).toBe("ready");
    expect(rendered.result.current.provisioningPreviewState).toBe("ready");
  });

  act(() => {
    rendered.result.current.setFormData((current) => ({
      ...current,
      databaseServerId: databaseId,
    }));
  });

  await act(async () => {
    await rendered.result.current.handleValidateIdentity();
  });

  await waitFor(() => {
    expect(rendered.result.current.hasValidIdentityEvidence).toBe(true);
    expect(rendered.result.current.hasValidApplicationSelection).toBe(true);
    expect(rendered.result.current.hasValidDatabaseSelection).toBe(true);
    expect(rendered.result.current.hasValidStorageSelection).toBe(true);
  });

  return rendered;
}

describe("useRegisterTenant silent quote recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIdempotencyKeyMock.mockReturnValue(idempotencyKey);
    listCandidateApplicationsMock.mockResolvedValue([
      {
        applicationId,
        key: "crm",
        name: "CRM",
        description: null,
        rank: 1,
        commercialMode: "SUBSCRIPTION",
        technicalDefinitionRevision: "1",
        selectionAllowed: true,
        selectionBlockers: [],
        readinessReasons: [],
        catalogueReasons: [],
        tiers: [{ id: tierId, key: "business", name: "Business", rank: 1 }],
      },
    ]);
    listDatabasePlacementOptionsMock.mockResolvedValue([
      {
        id: databaseId,
        name: "Primary database",
        status: "ACTIVE",
        currentTenants: 0,
        maxTenants: 100,
      },
    ]);
    previewProvisioningPlanMock.mockResolvedValue({
      contractVersion: 1,
      selectedApplicationKeys: ["crm"],
      selectionDigest: "a".repeat(64),
      components: [],
      steps: [],
    });
    axiosGetMock.mockResolvedValue({
      data: {
        data: {
          items: [
            {
              id: storageId,
              code: "primary",
              name: "Primary storage",
              region: "eg-cairo-1",
              status: "ACTIVE",
              maxTenants: 100,
              assignedTenants: 0,
            },
          ],
          total: 1,
        },
      },
    });
    validateIdentityMock.mockResolvedValue({
      valid: true,
      fields: {
        name: { valid: true, available: true, message: "Available" },
        companyName: { valid: true, available: true, message: "Available" },
      },
      message: "Identity is available.",
    });
  });

  it("stays locked without an error toast while quote auth repair is pending, then creates and redirects once", async () => {
    const quote = deferred<TenantSubscriptionQuote>();
    const create = deferred<TenantCreateResult>();
    quoteMock.mockReturnValueOnce(quote.promise);
    createMock.mockReturnValueOnce(create.promise);
    const { result, unmount } = await renderReadyRegistration();

    let submission!: Promise<void>;
    act(() => {
      submission = result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(true));
    expect(quoteMock).toHaveBeenCalledOnce();
    expect(createMock).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });
    expect(quoteMock).toHaveBeenCalledOnce();
    expect(result.current.isSubmitting).toBe(true);

    act(() => {
      quote.resolve({
        quoteId,
        requestHash: "request-hash",
        pricingRevision: "1",
        billingCycle: "MONTHLY",
        currencyCode: "USD",
        total: "10.00",
        totalUsd: "10.00",
        items: [
          {
            moduleId: applicationId,
            tierId,
            seats: 1,
            lineTotal: "10.00",
            lineTotalUsd: "10.00",
          },
        ],
        expiresAt: "2030-01-01T00:00:00.000Z",
      });
    });

    await waitFor(() => expect(createMock).toHaveBeenCalledOnce());
    expect(result.current.isSubmitting).toBe(true);
    expect(toastMock.error).not.toHaveBeenCalled();

    act(() => {
      create.resolve({ id: tenantId, status: "PROVISIONING" });
    });
    await act(async () => {
      await submission;
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(quoteMock).toHaveBeenCalledOnce();
    expect(createMock).toHaveBeenCalledOnce();
    expect(persistPendingCreateMock).toHaveBeenCalledOnce();
    expect(clearPendingCreateMock).toHaveBeenCalledOnce();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(
      toastMock.success.mock.calls.filter(([title]) => title === "Created"),
    ).toHaveLength(1);
    expect(pushMock).toHaveBeenCalledOnce();
    expect(pushMock).toHaveBeenCalledWith(`/tenants/${tenantId}`);

    unmount();
  });

  it("aborts an in-flight recovered quote on unmount without creating or notifying", async () => {
    let quoteSignal: AbortSignal | undefined;
    quoteMock.mockImplementationOnce(
      (
        _lines: unknown,
        _billingCycle: unknown,
        signal: AbortSignal | undefined,
      ) =>
        new Promise<TenantSubscriptionQuote>((_resolve, reject) => {
          quoteSignal = signal;
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    const { result, unmount } = await renderReadyRegistration();

    let submission!: Promise<void>;
    act(() => {
      submission = result.current.handleSubmit(submitEvent());
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));

    expect(quoteSignal?.aborted).toBe(false);
    unmount();
    expect(quoteSignal?.aborted).toBe(true);
    await submission;

    expect(quoteMock).toHaveBeenCalledOnce();
    expect(createMock).not.toHaveBeenCalled();
    expect(persistPendingCreateMock).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("preserves recovery evidence and suppresses completion UI when unmounted during create", async () => {
    let submissionSignal: AbortSignal | undefined;
    quoteMock.mockImplementationOnce(
      (
        _lines: unknown,
        _billingCycle: unknown,
        signal: AbortSignal | undefined,
      ) => {
        submissionSignal = signal;
        return Promise.resolve({
          quoteId,
          requestHash: "request-hash",
          pricingRevision: "1",
          billingCycle: "MONTHLY",
          currencyCode: "USD",
          total: "10.00",
          totalUsd: "10.00",
          items: [
            {
              moduleId: applicationId,
              tierId,
              seats: 1,
              lineTotal: "10.00",
              lineTotalUsd: "10.00",
            },
          ],
          expiresAt: "2030-01-01T00:00:00.000Z",
        } satisfies TenantSubscriptionQuote);
      },
    );
    const create = deferred<TenantCreateResult>();
    createMock.mockReturnValueOnce(create.promise);
    const { result, unmount } = await renderReadyRegistration();

    let submission!: Promise<void>;
    act(() => {
      submission = result.current.handleSubmit(submitEvent());
    });
    await waitFor(() => expect(createMock).toHaveBeenCalledOnce());
    expect(persistPendingCreateMock).toHaveBeenCalledOnce();
    expect(result.current.pendingCreateRecovery).not.toBeNull();
    expect(result.current.isSubmitting).toBe(true);

    unmount();
    expect(submissionSignal?.aborted).toBe(true);
    act(() => {
      create.resolve({ id: tenantId, status: "PROVISIONING" });
    });
    await submission;

    expect(createMock).toHaveBeenCalledOnce();
    expect(persistPendingCreateMock).toHaveBeenCalledOnce();
    expect(clearPendingCreateMock).not.toHaveBeenCalled();
    expect(resetKeyMock).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(
      toastMock.success.mock.calls.filter(([title]) => title === "Created"),
    ).toHaveLength(0);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("surfaces one phase-aware error when retained auth repair is exhausted", async () => {
    quoteMock.mockRejectedValueOnce(adminAuthError(401, "repair-degraded"));
    const { result, unmount } = await renderReadyRegistration();

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledOnce();
    expect(toastMock.error).toHaveBeenCalledWith(
      "Quote request failed",
      expect.stringContaining("Your session was kept; try again."),
    );
    unmount();
  });

  it.each([
    { status: 401, handling: "session-ended" as const },
    { status: 403, handling: "permission-denied" as const },
  ])(
    "does not duplicate globally handled $handling UI",
    async ({ status, handling }) => {
      quoteMock.mockRejectedValueOnce(adminAuthError(status, handling));
      const { result, unmount } = await renderReadyRegistration();

      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(createMock).not.toHaveBeenCalled();
      expect(toastMock.error).not.toHaveBeenCalled();
      unmount();
    },
  );

  it("does not silently swallow an unhandled 401", async () => {
    quoteMock.mockRejectedValueOnce(adminAuthError(401));
    const { result, unmount } = await renderReadyRegistration();

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(toastMock.error).toHaveBeenCalledOnce();
    expect(toastMock.error).toHaveBeenCalledWith(
      "Quote request failed",
      expect.stringContaining("COMMON.AUTH.MISSING_TOKEN"),
    );
    unmount();
  });

  it("retains create recovery evidence when a settled response is discarded after a session switch", async () => {
    quoteMock.mockResolvedValueOnce(subscriptionQuote());
    const create = deferred<TenantCreateResult>();
    createMock.mockReturnValueOnce(create.promise);
    const { result, unmount } = await renderReadyRegistration();

    let submission!: Promise<void>;
    act(() => {
      submission = result.current.handleSubmit(submitEvent());
    });
    await waitFor(() => expect(createMock).toHaveBeenCalledOnce());
    create.reject({
      requestOutcome: "settled-before-session-change",
      response: {
        status: 409,
        data: {
          message: "The active session changed.",
          errorCode: "AUTH_SESSION_CHANGED",
          correlationId: "019f-session-change",
        },
      },
    });
    await act(async () => {
      await submission;
    });

    expect(persistPendingCreateMock).toHaveBeenCalledOnce();
    expect(clearPendingCreateMock).not.toHaveBeenCalled();
    expect(resetKeyMock).not.toHaveBeenCalled();
    expect(result.current.pendingCreateRecovery).not.toBeNull();
    expect(toastMock.error).toHaveBeenCalledWith(
      "Tenant creation failed",
      expect.stringContaining("AUTH_SESSION_CHANGED"),
    );
    expect(pushMock).not.toHaveBeenCalled();
    unmount();
  });

  it("clears a false create marker when auth repair exhausts before command execution", async () => {
    quoteMock.mockResolvedValueOnce(subscriptionQuote());
    createMock.mockRejectedValueOnce(adminAuthError(502, "repair-degraded"));
    const { result, unmount } = await renderReadyRegistration();

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(createMock).toHaveBeenCalledOnce();
    expect(persistPendingCreateMock).toHaveBeenCalledOnce();
    expect(clearPendingCreateMock).toHaveBeenCalledOnce();
    expect(resetKeyMock).toHaveBeenCalledOnce();
    expect(result.current.pendingCreateRecovery).toBeNull();
    expect(toastMock.error).toHaveBeenCalledWith(
      "Tenant creation failed",
      expect.stringContaining("Your session was kept; try again."),
    );
    expect(pushMock).not.toHaveBeenCalled();
    unmount();
  });
});
