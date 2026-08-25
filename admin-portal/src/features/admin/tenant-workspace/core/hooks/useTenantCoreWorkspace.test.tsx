// @vitest-environment jsdom

import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NEXT_UPDATED_AT,
  OTHER_TENANT_ID,
  TENANT_ID,
  UPDATED_AT,
  tenantFixture,
} from "../__tests__/fixtures";
import type { TenantCorePermissions, TenantView } from "../types";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  updateProfile: vi.fn(),
  suspend: vi.fn(),
  activate: vi.fn(),
  reprovision: vi.fn(),
  cancelProvisioning: vi.fn(),
  softDelete: vi.fn(),
  destroy: vi.fn(),
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
      canDestroy: true,
      canValidateFqdn: true,
      canManageFqdns: true,
    };
    api.get.mockResolvedValue(tenantFixture());
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
      canDestroy: true,
      canValidateFqdn: true,
      canManageFqdns: true,
    };
    api.get.mockResolvedValue(tenantFixture());
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

  it("destroys only a soft-deleted tenant and enters terminal local state", async () => {
    api.get.mockResolvedValue(tenantFixture("DELETED"));
    api.destroy.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTenantCoreWorkspace(TENANT_ID));
    await waitFor(() => expect(result.current.tenant?.status).toBe("DELETED"));

    await act(async () => result.current.destroy(true));
    expect(api.destroy).toHaveBeenCalledWith(
      TENANT_ID,
      true,
      expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7/i),
    );
    expect(result.current.resourceState).toBe("destroyed");
    expect(result.current.tenant).toBeNull();
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

    let destruction!: Promise<void>;
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
