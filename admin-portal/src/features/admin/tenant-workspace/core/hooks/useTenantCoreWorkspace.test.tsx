// @vitest-environment jsdom

import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DESTROY_OPERATION_ID,
  NEXT_UPDATED_AT,
  OTHER_TENANT_ID,
  TENANT_ID,
  UPDATED_AT,
  tenantDestroyFixture,
  tenantFixture,
} from "../__tests__/fixtures";
import type {
  TenantCorePermissions,
  TenantDestroyView,
  TenantView,
} from "../types";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  getDestroy: vi.fn(),
  updateProfile: vi.fn(),
  suspend: vi.fn(),
  activate: vi.fn(),
  reprovision: vi.fn(),
  cancelProvisioning: vi.fn(),
  softDelete: vi.fn(),
  restore: vi.fn(),
  destroy: vi.fn(),
  abandonDestroy: vi.fn(),
}));

const permissionState = vi.hoisted(() => ({
  current: {
    canRead: true,
    canUpdate: true,
    canSuspendOrActivate: true,
    canReprovisionOrCancel: true,
    canSoftDelete: true,
    canDestroy: true,
    canValidateFqdn: true,
    canManageFqdns: true,
  } as TenantCorePermissions,
}));

vi.mock("../api/tenant-core.api", () => ({ tenantCoreApi: api }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin" }, isLoading: false }),
}));
vi.mock("../model/permissions", () => ({
  readTenantCorePermissions: () => permissionState.current,
}));

import { useTenantCoreWorkspace } from "./useTenantCoreWorkspace";

const normalizedError = (
  httpStatus: number,
  errorCode: string,
  message = errorCode,
) => ({ isNormalized: true as const, httpStatus, errorCode, message });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("useTenantCoreWorkspace tenant-first ownership", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    permissionState.current = {
      canRead: true,
      canUpdate: true,
      canSuspendOrActivate: true,
      canReprovisionOrCancel: true,
      canSoftDelete: true,
      canRestore: true,
      canDestroy: true,
      canValidateFqdn: true,
      canManageFqdns: true,
    };
    api.get.mockResolvedValue(tenantFixture());
    api.getDestroy.mockResolvedValue(null);
  });

  it("issues one initial detail request under React Strict Mode", async () => {
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID), {
      wrapper: StrictMode,
    });

    await waitFor(() => expect(result.current.resourceState).toBe("ready"));
    expect(api.get).toHaveBeenCalledOnce();
    expect(api.get).toHaveBeenCalledWith(TENANT_ID, expect.any(AbortSignal));
  });

  it("keeps the tenant detail independent from unrelated resource grants", async () => {
    permissionState.current = {
      ...permissionState.current,
      canUpdate: false,
      canValidateFqdn: false,
      canManageFqdns: false,
    };
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID));

    await waitFor(() => expect(result.current.tenant?.id).toBe(TENANT_ID));
    expect(result.current.resourceState).toBe("ready");
    expect(result.current.permissions).toMatchObject({
      canRead: true,
      canUpdate: false,
      canManageFqdns: false,
    });
  });

  it("fails closed before I/O without tenant read permission", async () => {
    permissionState.current = {
      ...permissionState.current,
      canRead: false,
    };
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID));

    await waitFor(() => expect(result.current.resourceState).toBe("forbidden"));
    expect(result.current.tenant).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("aborts and ignores tenant A when route identity changes to B", async () => {
    const a = deferred<TenantView>();
    const b = deferred<TenantView>();
    api.get.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { result, rerender } = renderHook(
      ({ id }) => useTenantCoreWorkspace(id),
      { initialProps: { id: TENANT_ID } },
    );
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    const aSignal = api.get.mock.calls[0]?.[1] as AbortSignal;

    rerender({ id: OTHER_TENANT_ID });
    expect(result.current.tenant).toBeNull();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(aSignal.aborted).toBe(true);

    await act(async () => {
      b.resolve(
        tenantFixture("ACTIVE", {
          id: OTHER_TENANT_ID,
          name: "other",
          fqdns: [],
        }),
      );
    });
    await waitFor(() =>
      expect(result.current.loadedTenantId).toBe(OTHER_TENANT_ID),
    );
    await act(async () => a.resolve(tenantFixture()));
    expect(result.current.tenant?.id).toBe(OTHER_TENANT_ID);
  });

  it("polls only provisioning status and stops when the tenant becomes ready", async () => {
    api.get
      .mockResolvedValueOnce(tenantFixture("PROVISIONING"))
      .mockResolvedValueOnce(tenantFixture("PROVISIONING"))
      .mockResolvedValueOnce(tenantFixture("ACTIVE"));
    const { result } = renderHook(() =>
      useTenantCoreWorkspace(TENANT_ID, {
        pollIntervalMs: 2,
        maxProvisioningPolls: 5,
      }),
    );

    await waitFor(() => expect(result.current.tenant?.status).toBe("ACTIVE"));
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(result.current.pollExhausted).toBe(false);
    expect(result.current.isPolling).toBe(false);
  });

  it("bounds provisioning polling and exposes an explicit paused state", async () => {
    api.get.mockResolvedValue(tenantFixture("PROVISIONING"));
    const { result } = renderHook(() =>
      useTenantCoreWorkspace(TENANT_ID, {
        pollIntervalMs: 2,
        maxProvisioningPolls: 2,
      }),
    );

    await waitFor(() => expect(result.current.pollExhausted).toBe(true));
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(result.current.pollAttempts).toBe(2);
    expect(result.current.isPolling).toBe(false);
  });

  it("continues bounded polling after a transient background failure", async () => {
    api.get
      .mockResolvedValueOnce(tenantFixture("PROVISIONING"))
      .mockRejectedValueOnce(normalizedError(503, "TEMPORARY"))
      .mockResolvedValueOnce(tenantFixture("ACTIVE"));
    const { result } = renderHook(() =>
      useTenantCoreWorkspace(TENANT_ID, {
        pollIntervalMs: 2,
        maxProvisioningPolls: 3,
      }),
    );

    await waitFor(() => expect(result.current.tenant?.status).toBe("ACTIVE"));
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(result.current.resourceState).toBe("ready");
  });
});

describe("useTenantCoreWorkspace profile and destructive actions", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    permissionState.current = {
      canRead: true,
      canUpdate: true,
      canSuspendOrActivate: true,
      canReprovisionOrCancel: true,
      canSoftDelete: true,
      canRestore: true,
      canDestroy: true,
      canValidateFqdn: true,
      canManageFqdns: true,
    };
    api.get.mockResolvedValue(tenantFixture());
    api.getDestroy.mockResolvedValue(null);
  });

  it("keeps one profile draft, sends null clears, and adopts success", async () => {
    const updated = tenantFixture("ACTIVE", {
      phone: null,
      address: null,
      updatedAt: NEXT_UPDATED_AT,
    });
    api.updateProfile.mockResolvedValue(updated);
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID));
    await waitFor(() => expect(result.current.profileDraft).not.toBeNull());

    act(() => {
      result.current.updateProfileDraft({ phone: null });
      result.current.clearAddress();
    });
    await act(async () => {
      await result.current.saveProfile();
    });

    const dto = api.updateProfile.mock.calls[0]?.[1];
    expect(dto).toMatchObject({
      expectedUpdatedAt: UPDATED_AT,
      phone: null,
      address: null,
    });
    expect(api.updateProfile.mock.calls[0]?.[2]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7/i,
    );
    expect(result.current.profileDirty).toBe(false);
    expect(result.current.tenant?.updatedAt).toBe(NEXT_UPDATED_AT);
  });

  it("preserves dirty draft and original concurrency token after server refresh", async () => {
    api.updateProfile.mockRejectedValue(
      normalizedError(409, "TENANT_UPDATE_STALE", "Profile changed"),
    );
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID));
    await waitFor(() => expect(result.current.profileDraft).not.toBeNull());

    act(() => result.current.updateProfileDraft({ phone: "01111111111" }));
    act(() =>
      result.current.replaceTenant(
        tenantFixture("ACTIVE", {
          phone: "01222222222",
          updatedAt: NEXT_UPDATED_AT,
        }),
      ),
    );
    expect(result.current.profileDraft?.phone).toBe("01111111111");
    expect(result.current.profileStale).toBe(true);

    await act(async () => {
      await result.current.saveProfile().catch(() => undefined);
    });
    expect(api.updateProfile.mock.calls[0]?.[1]).toMatchObject({
      expectedUpdatedAt: UPDATED_AT,
      phone: "01111111111",
    });
    expect(result.current.profileDraft?.phone).toBe("01111111111");
    expect(result.current.profileStale).toBe(true);
  });

  // Suspending is not the profile editor's write, so its response must not
  // overwrite a profile form the operator had already started filling in.
  it.each([
    ["suspend", "SUSPENDED"],
    ["activate", "ACTIVE"],
  ] as const)(
    "keeps an unsaved profile draft across %s",
    async (command, nextStatus) => {
      api[command].mockResolvedValue(
        tenantFixture(nextStatus, { updatedAt: NEXT_UPDATED_AT }),
      );
      const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID));
      await waitFor(() => expect(result.current.profileDraft).not.toBeNull());

      act(() => result.current.updateProfileDraft({ industry: "Finance" }));
      await act(async () => {
        await result.current[command]();
      });

      expect(result.current.tenant?.status).toBe(nextStatus);
      expect(result.current.profileDraft?.industry).toBe("Finance");
      expect(result.current.profileDirty).toBe(true);
      expect(result.current.profileStale).toBe(true);
    },
  );

  it("refreshes an untouched profile draft from a lifecycle response", async () => {
    api.suspend.mockResolvedValue(
      tenantFixture("SUSPENDED", {
        industry: "Changed elsewhere",
        updatedAt: NEXT_UPDATED_AT,
      }),
    );
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID));
    await waitFor(() => expect(result.current.profileDraft).not.toBeNull());

    await act(async () => {
      await result.current.suspend();
    });

    expect(result.current.profileDraft?.industry).toBe("Changed elsewhere");
    expect(result.current.profileDirty).toBe(false);
    expect(result.current.profileStale).toBe(false);
  });

  it("reuses a caller key for an ambiguous exact retry", async () => {
    api.updateProfile.mockRejectedValue(
      normalizedError(503, "TEMPORARY", "Try again"),
    );
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID));
    await waitFor(() => expect(result.current.profileDraft).not.toBeNull());
    act(() => result.current.updateProfileDraft({ industry: "Finance" }));

    await act(async () => {
      await result.current.saveProfile().catch(() => undefined);
      await result.current.saveProfile().catch(() => undefined);
    });
    expect(api.updateProfile).toHaveBeenCalledTimes(2);
    expect(api.updateProfile.mock.calls[0]?.[2]).toBe(
      api.updateProfile.mock.calls[1]?.[2],
    );
  });

  it("changes the caller key when the user changes an ambiguous intent", async () => {
    api.updateProfile.mockRejectedValue(normalizedError(503, "TEMPORARY"));
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID));
    await waitFor(() => expect(result.current.profileDraft).not.toBeNull());
    act(() => result.current.updateProfileDraft({ industry: "Finance" }));
    await act(async () => {
      await result.current.saveProfile().catch(() => undefined);
    });
    act(() => result.current.updateProfileDraft({ industry: "Healthcare" }));
    await act(async () => {
      await result.current.saveProfile().catch(() => undefined);
    });
    expect(api.updateProfile.mock.calls[0]?.[2]).not.toBe(
      api.updateProfile.mock.calls[1]?.[2],
    );
  });

  it("waits for verified destruction before entering terminal local state", async () => {
    api.get.mockResolvedValue(tenantFixture("DELETED"));
    api.destroy.mockResolvedValue(tenantDestroyFixture("STOPPING_PROVISIONING"));
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID, { pollIntervalMs: 20 }));
    await waitFor(() => expect(result.current.tenant?.status).toBe("DELETED"));
    await act(async () => { await result.current.destroy(false); });
    expect(result.current.resourceState).toBe("ready");
    expect(result.current.destroyOperation?.phase).toBe("STOPPING_PROVISIONING");
    expect(result.current.destroyPolling).toBe(true);
    api.getDestroy.mockResolvedValue(tenantDestroyFixture("SUCCEEDED"));
    await waitFor(() => expect(result.current.resourceState).toBe("destroyed"));
    expect(result.current.tenant).toBeNull();
  });

  it("recovers pending destruction on reload and keeps polling after a temporary read failure", async () => {
    api.get.mockResolvedValue(tenantFixture("DELETED"));
    api.getDestroy
      .mockResolvedValueOnce(tenantDestroyFixture("DROPPING_DATABASE"))
      .mockRejectedValueOnce(normalizedError(503, "TEMPORARY"))
      .mockResolvedValue(tenantDestroyFixture("SUCCEEDED"));
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID, { pollIntervalMs: 20 }));
    await waitFor(() => expect(result.current.resourceState).toBe("destroyed"));
    expect(api.destroy).not.toHaveBeenCalled();
    expect(api.getDestroy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  // BLOCKED waits for an operator and ABANDONED is evidence: Worker will not
  // move either, so re-reading them only spends requests.
  it.each(["BLOCKED", "ABANDONED"] as const)(
    "stops polling once destruction is %s and keeps the tenant",
    async (phase) => {
      api.get.mockResolvedValue(tenantFixture("DELETED"));
      api.getDestroy
        .mockResolvedValueOnce(tenantDestroyFixture("STOPPING_PROVISIONING"))
        .mockResolvedValue(tenantDestroyFixture(phase));
      const { result } = renderHook(() =>
        useTenantCoreWorkspace(TENANT_ID, { pollIntervalMs: 5 }),
      );

      await waitFor(() => expect(result.current.destroyOperation?.phase).toBe(phase));
      expect(result.current.destroyPolling).toBe(false);
      const reads = api.getDestroy.mock.calls.length;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
      });
      expect(api.getDestroy).toHaveBeenCalledTimes(reads);
      expect(result.current.resourceState).toBe("ready");
      expect(result.current.tenant?.status).toBe("DELETED");
    },
  );

  it("backs off while an advancing request stays unchanged", async () => {
    vi.useFakeTimers();
    try {
      api.get.mockResolvedValue(tenantFixture("DELETED"));
      api.getDestroy.mockResolvedValue(tenantDestroyFixture("STOPPING_PROVISIONING"));
      const { result } = renderHook(() =>
        useTenantCoreWorkspace(TENANT_ID, { pollIntervalMs: 100 }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.destroyPolling).toBe(true);
      expect(api.getDestroy).toHaveBeenCalledTimes(1);

      // Small steps, each its own act, so every poll's result re-renders the
      // hook and can slow the cadence before the next tick.
      for (let elapsed = 0; elapsed < 10_000; elapsed += 50) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(50);
        });
      }
      // 100 ms → 500 ms → 2 s: about fourteen reads where a fixed cadence
      // would have made a hundred.
      expect(api.getDestroy.mock.calls.length).toBeGreaterThan(8);
      expect(api.getDestroy.mock.calls.length).toBeLessThan(20);
      expect(result.current.destroyPolling).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("abandons the shown request by its id and stops polling", async () => {
    api.get.mockResolvedValue(tenantFixture("DELETED"));
    api.getDestroy.mockResolvedValue(tenantDestroyFixture("BLOCKED"));
    api.abandonDestroy.mockResolvedValue(tenantDestroyFixture("ABANDONED"));
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID));
    await waitFor(() => expect(result.current.destroyOperation?.phase).toBe("BLOCKED"));

    await act(async () => {
      await result.current.abandonDestruction();
    });

    expect(api.abandonDestroy).toHaveBeenCalledWith(
      TENANT_ID,
      DESTROY_OPERATION_ID,
      expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7/i),
    );
    expect(result.current.destroyOperation?.phase).toBe("ABANDONED");
    expect(result.current.destroyPolling).toBe(false);
    expect(result.current.mutation).toEqual({ name: null, error: null });
  });

  it("refreshes destruction progress when Core can no longer abandon it", async () => {
    api.get.mockResolvedValue(tenantFixture("DELETED"));
    api.getDestroy
      .mockResolvedValueOnce(tenantDestroyFixture("STOPPING_PROVISIONING"))
      .mockResolvedValue(tenantDestroyFixture("DROPPING_DATABASE"));
    api.abandonDestroy.mockRejectedValue(
      normalizedError(409, "TENANT_DESTROY_NOT_ABANDONABLE"),
    );
    const { result } = renderHook(() =>
      useTenantCoreWorkspace(TENANT_ID, { pollIntervalMs: 60_000 }),
    );
    await waitFor(() =>
      expect(result.current.destroyOperation?.phase).toBe("STOPPING_PROVISIONING"),
    );

    await act(async () => {
      await expect(result.current.abandonDestruction()).rejects.toMatchObject({
        errorCode: "TENANT_DESTROY_NOT_ABANDONABLE",
      });
    });

    expect(result.current.destroyOperation?.phase).toBe("DROPPING_DATABASE");
    expect(result.current.mutation.error?.errorCode).toBe(
      "TENANT_DESTROY_NOT_ABANDONABLE",
    );
  });

  it.each([
    ["a request Core already authorized to drop", "DROPPING_DATABASE", true, "TENANT_DESTROY_NOT_ABANDONABLE"],
    ["an abandoned request", "ABANDONED", true, "TENANT_DESTROY_NOT_ABANDONABLE"],
    ["an admin without the destroy grant", "BLOCKED", false, "TENANT_DESTROY_FORBIDDEN"],
  ] as const)(
    "refuses to abandon %s before any I/O",
    async (_label, phase, canDestroy, errorCode) => {
      permissionState.current = { ...permissionState.current, canDestroy };
      api.get.mockResolvedValue(tenantFixture("DELETED"));
      api.getDestroy.mockResolvedValue(tenantDestroyFixture(phase));
      const { result } = renderHook(() =>
        useTenantCoreWorkspace(TENANT_ID, { pollIntervalMs: 60_000 }),
      );
      await waitFor(() => expect(result.current.destroyOperation?.phase).toBe(phase));

      await expect(result.current.abandonDestruction()).rejects.toMatchObject({
        errorCode,
      });
      expect(api.abandonDestroy).not.toHaveBeenCalled();
    },
  );

  it("discards a status read that started before the abandon answered", async () => {
    const staleRead = deferred<TenantDestroyView>();
    api.get.mockResolvedValue(tenantFixture("DELETED"));
    api.getDestroy
      .mockResolvedValueOnce(tenantDestroyFixture("STOPPING_PROVISIONING"))
      .mockReturnValueOnce(staleRead.promise);
    api.abandonDestroy.mockResolvedValue(tenantDestroyFixture("ABANDONED"));
    const { result } = renderHook(() =>
      useTenantCoreWorkspace(TENANT_ID, { pollIntervalMs: 60_000 }),
    );
    await waitFor(() =>
      expect(result.current.destroyOperation?.phase).toBe("STOPPING_PROVISIONING"),
    );

    let read!: Promise<unknown>;
    act(() => {
      read = result.current.refreshDestruction();
    });
    await act(async () => {
      await result.current.abandonDestruction();
    });
    await act(async () => {
      staleRead.resolve(tenantDestroyFixture("STOPPING_PROVISIONING"));
      await read;
    });

    expect(result.current.destroyOperation?.phase).toBe("ABANDONED");
    expect(result.current.destroyPolling).toBe(false);
  });

  // Core replays an abandoned request for its own key, so a key retained for
  // an ambiguous destroy must not survive the abandonment it led to.
  it("requests a new destruction under a fresh key once the previous one was abandoned", async () => {
    api.get.mockResolvedValue(tenantFixture("DELETED"));
    api.getDestroy.mockResolvedValue(null);
    api.destroy
      .mockRejectedValueOnce(normalizedError(503, "TEMPORARY"))
      .mockResolvedValueOnce(tenantDestroyFixture("STOPPING_PROVISIONING"));
    const { result } = renderHook(() =>
      useTenantCoreWorkspace(TENANT_ID, { pollIntervalMs: 60_000 }),
    );
    await waitFor(() => expect(result.current.tenant?.status).toBe("DELETED"));

    await act(async () => {
      await result.current.destroy(false).catch(() => undefined);
    });
    const ambiguousKey = api.destroy.mock.calls[0]?.[2] as string;
    api.getDestroy.mockResolvedValue(
      tenantDestroyFixture("ABANDONED", { operationId: ambiguousKey }),
    );
    await act(async () => {
      await result.current.refreshDestruction();
    });
    expect(result.current.destroyOperation?.phase).toBe("ABANDONED");

    await act(async () => {
      await result.current.destroy(false);
    });
    expect(api.destroy.mock.calls[1]?.[2]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/i);
    expect(api.destroy.mock.calls[1]?.[2]).not.toBe(ambiguousKey);
    expect(result.current.destroyOperation?.phase).toBe("STOPPING_PROVISIONING");
  });

  it("stops showing abandoned evidence once the tenant is restored", async () => {
    api.get.mockResolvedValue(tenantFixture("DELETED"));
    api.getDestroy.mockResolvedValue(tenantDestroyFixture("ABANDONED"));
    api.restore.mockResolvedValue(tenantFixture("SUSPENDED"));
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID));
    await waitFor(() => expect(result.current.destroyOperation?.phase).toBe("ABANDONED"));

    await act(async () => {
      await result.current.restore();
    });

    expect(result.current.tenant?.status).toBe("SUSPENDED");
    expect(result.current.destroyOperation).toBeNull();
    expect(result.current.destroyError).toBeNull();
  });

  it("cannot let tenant A destruction mark tenant B as destroyed", async () => {
    const destroyRequest = deferred<void>();
    api.get
      .mockResolvedValueOnce(tenantFixture("DELETED"))
      .mockResolvedValueOnce(
        tenantFixture("ACTIVE", {
          id: OTHER_TENANT_ID,
          name: "other",
          fqdns: [],
        }),
      );
    api.destroy.mockReturnValue(destroyRequest.promise);
    const { result, rerender } = renderHook(
      ({ id }) => useTenantCoreWorkspace(id),
      { initialProps: { id: TENANT_ID } },
    );
    await waitFor(() => expect(result.current.tenant?.status).toBe("DELETED"));

    let destruction!: Promise<unknown>;
    act(() => {
      destruction = result.current.destroy(false);
    });
    const destructionOutcome = destruction.catch((error: unknown) => error);
    rerender({ id: OTHER_TENANT_ID });
    await waitFor(() => expect(result.current.tenant?.id).toBe(OTHER_TENANT_ID));
    await act(async () => destroyRequest.resolve());
    await expect(destructionOutcome).resolves.toMatchObject({
      errorCode: "TENANT_CONTEXT_CHANGED",
    });
    expect(result.current.resourceState).toBe("ready");
    expect(result.current.tenant?.id).toBe(OTHER_TENANT_ID);
  });
});
