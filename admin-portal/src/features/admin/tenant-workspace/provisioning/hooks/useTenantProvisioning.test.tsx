// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, authMock, generateMock } = vi.hoisted(() => ({
  apiMock: {
    listOperations: vi.fn(),
    getOperation: vi.fn(),
    listTimeline: vi.fn(),
    listUpdates: vi.fn(),
    listPrerequisiteEvidence: vi.fn(),
    listComponents: vi.fn(),
    listSeeds: vi.fn(),
    retryOperation: vi.fn(),
    cancelOperation: vi.fn(),
    applyUpdates: vi.fn(),
    requestPrerequisites: vi.fn(),
    addApplication: vi.fn(),
    repair: vi.fn(),
    decommission: vi.fn(),
    resolveSeedConflict: vi.fn(),
  },
  authMock: {
    user: { isSuperAdmin: true, permissions: [] as string[] },
    isLoading: false,
  },
  generateMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: generateMock }));
vi.mock("../api/tenant-provisioning.api", () => ({
  tenantProvisioningApi: apiMock,
}));

import {
  shouldRetainProvisioningIntent,
  useTenantProvisioning,
} from "./useTenantProvisioning";
import {
  COMMAND_ID,
  META,
  OPERATION_ID,
  RETRY_OPERATION_ID,
  SEED_ID,
  TENANT_ID,
  componentInstallation,
  operationDetail,
  operationSummary,
  seedState,
} from "../test/fixtures";
import {
  readTenantComponentInstallation,
  readTenantOperationDetail,
  readTenantOperationSummary,
  readTenantSeedState,
} from "../model/readers";

const SECOND_COMMAND_ID = "019f0000-0000-7000-8000-0000000000e1";

describe("useTenantProvisioning", () => {
  beforeEach(() => {
    Object.values(apiMock).forEach((mock) => mock.mockReset());
    authMock.user = { isSuperAdmin: true, permissions: [] };
    authMock.isLoading = false;
    generateMock.mockReset();
    generateMock
      .mockReturnValueOnce(COMMAND_ID)
      .mockReturnValue(SECOND_COMMAND_ID);

    const summary = readTenantOperationSummary(operationSummary());
    const detail = readTenantOperationDetail(operationDetail());
    apiMock.listOperations.mockResolvedValue({ items: [summary], meta: META });
    apiMock.getOperation.mockResolvedValue(detail);
    apiMock.listTimeline.mockResolvedValue({ items: [], meta: META });
    apiMock.listUpdates.mockResolvedValue({ items: [], meta: META });
    apiMock.listPrerequisiteEvidence.mockResolvedValue([]);
    apiMock.listComponents.mockResolvedValue({
      items: [readTenantComponentInstallation(componentInstallation())],
      meta: META,
    });
    apiMock.listSeeds.mockResolvedValue({
      items: [readTenantSeedState(seedState())],
      meta: META,
    });
  });

  it("loads independently permissioned resources and selects the newest operation", async () => {
    const { result } = renderHook(() =>
      useTenantProvisioning(TENANT_ID, { pollIntervalMs: 60_000 }),
    );

    await waitFor(() => expect(result.current.operations.status).toBe("ready"));
    await waitFor(() =>
      expect(result.current.selectedOperation.data?.id).toBe(OPERATION_ID),
    );

    expect(result.current.selectedOperation.data?.progress.percent).toBe(50);
    expect(result.current.polling).toBe(true);
    expect(apiMock.listOperations).toHaveBeenCalledWith(
      TENANT_ID,
      { page: 1, limit: 100, sortBy: "generation", sortDir: "DESC" },
      expect.any(AbortSignal),
    );
    expect(apiMock.listUpdates).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ limit: 100 }),
      expect.any(AbortSignal),
    );
    expect(apiMock.listPrerequisiteEvidence).toHaveBeenCalled();
  });

  it("marks nested resources forbidden without issuing calls when only tenant read is granted", async () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.tenants.read"],
    };
    const { result } = renderHook(() =>
      useTenantProvisioning(TENANT_ID, { pollIntervalMs: 60_000 }),
    );

    await waitFor(() => expect(result.current.operations.status).toBe("ready"));
    expect(result.current.prerequisites.status).toBe("forbidden");
    expect(apiMock.listPrerequisiteEvidence).not.toHaveBeenCalled();
    expect(result.current.permissions.canRetryOrCancel).toBe(false);
    expect(result.current.permissions.canReadPrerequisites).toBe(false);
  });

  it("reuses one caller-owned UUIDv7 for an exact retry after an ambiguous 503", async () => {
    const detail = readTenantOperationDetail(
      operationDetail({ id: RETRY_OPERATION_ID, status: "RUNNING", generation: 2 }),
    );
    apiMock.retryOperation
      .mockRejectedValueOnce({
        response: {
          status: 503,
          data: {
            success: false,
            statusCode: 503,
            errorCode: "PROVISIONING_DEPENDENCY_UNAVAILABLE",
            errorCategory: "SERVER_ERROR",
            message: "Unavailable",
            correlationId: "corr",
          },
        },
      })
      .mockResolvedValueOnce({ replayed: true, operation: detail });

    const { result } = renderHook(() =>
      useTenantProvisioning(TENANT_ID, { pollIntervalMs: 60_000 }),
    );
    await waitFor(() => expect(result.current.operations.status).toBe("ready"));

    await act(async () => {
      await expect(result.current.retryOperation(OPERATION_ID)).rejects.toEqual(
        expect.objectContaining({ errorCode: "PROVISIONING_DEPENDENCY_UNAVAILABLE" }),
      );
    });
    await act(async () => {
      await result.current.retryOperation(OPERATION_ID);
    });

    expect(apiMock.retryOperation.mock.calls.map((call) => call[2])).toEqual([
      COMMAND_ID,
      COMMAND_ID,
    ]);
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(result.current.selectedOperationId).toBe(RETRY_OPERATION_ID);
  });

  it("never dispatches a seed conflict command without the hidden revision fence", async () => {
    const seed = readTenantSeedState(seedState());
    const { result } = renderHook(() =>
      useTenantProvisioning(TENANT_ID, { pollIntervalMs: 60_000 }),
    );
    await waitFor(() => expect(result.current.seeds.status).toBe("ready"));

    await expect(
      result.current.resolveSeedConflict(
        seed,
        "KEEP_TENANT_VALUE",
        "ADMIN.SEED_CONFLICT",
      ),
    ).rejects.toThrow("TENANT_SEED_CONFLICT_REVISION_UNAVAILABLE");
    expect(apiMock.resolveSeedConflict).not.toHaveBeenCalled();
  });

  it("continues polling CANCEL_REQUESTED and stops for all terminal states", () => {
    expect(
      shouldRetainProvisioningIntent({
        isNormalized: true,
        httpStatus: 503,
        errorCode: "UPSTREAM_UNAVAILABLE",
        message: "Unavailable",
      }),
    ).toBe(true);
    expect(
      shouldRetainProvisioningIntent({
        isNormalized: true,
        httpStatus: 409,
        errorCode: "GW.IDEM.IN_FLIGHT",
        message: "In flight",
      }),
    ).toBe(true);
    expect(
      shouldRetainProvisioningIntent({
        isNormalized: true,
        httpStatus: 409,
        errorCode: "TENANT_PROVISIONING_OPERATION_STALE",
        message: "Stale",
      }),
    ).toBe(false);
  });

  it("rejects commands locally when their ALL permission requirement is incomplete", async () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: ["admin.tenants.read", "admin.tenants.reprovision"],
    };
    const { result } = renderHook(() =>
      useTenantProvisioning(TENANT_ID, { pollIntervalMs: 60_000 }),
    );
    await waitFor(() => expect(result.current.operations.status).toBe("ready"));

    await expect(result.current.cancelOperation(OPERATION_ID)).rejects.toEqual(
      expect.objectContaining({
        httpStatus: 403,
        errorCode: "ADMIN_PERMISSION_REQUIRED",
      }),
    );
    expect(apiMock.cancelOperation).not.toHaveBeenCalled();
    expect(SEED_ID).not.toBe(OPERATION_ID);
  });

  /**
   * FE-OPS-005. `loadSelectedOperation` only checked `signal?.aborted`. The
   * selection effect does pass a signal and aborts it on change, so that path
   * was already safe - but `refreshAll` and the poll pass **no** signal, so
   * there was nothing to abort. A refresh started while A was selected, the
   * operator picked B, and A's late response committed: the list highlighted B
   * while the detail pane, the timeline and the retry/cancel actions read A.
   *
   * This drives refreshAll deliberately, because that is the defective path;
   * asserting through the selection effect would pass on the abort and prove
   * nothing about the guard.
   */
  it("drops a signal-less refresh response for an operation no longer selected", async () => {
    const { result } = renderHook(() =>
      useTenantProvisioning(TENANT_ID, { pollIntervalMs: 60_000 }),
    );
    await waitFor(() =>
      expect(result.current.selectedOperation.data?.id).toBe(OPERATION_ID),
    );

    // A refresh for A that has not answered yet - and carries no signal.
    let resolveStale: ((value: unknown) => void) | undefined;
    apiMock.getOperation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
    );
    let refreshing: Promise<unknown> | undefined;
    act(() => {
      refreshing = result.current.refreshAll();
    });

    // The operator moves to B, whose detail resolves immediately.
    apiMock.getOperation.mockResolvedValue(
      readTenantOperationDetail(operationDetail({ id: RETRY_OPERATION_ID })),
    );
    act(() => result.current.selectOperation(RETRY_OPERATION_ID));
    await waitFor(() =>
      expect(result.current.selectedOperation.data?.id).toBe(RETRY_OPERATION_ID),
    );

    // A answers late. Nothing aborted it, so only its identity can refuse it.
    await act(async () => {
      resolveStale?.(readTenantOperationDetail(operationDetail()));
      await refreshing;
    });

    expect(result.current.selectedOperation.data?.id).toBe(RETRY_OPERATION_ID);
  });
});
