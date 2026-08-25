"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { tenantCoreApi } from "../api/tenant-core.api";
import {
  createTenantIntentKeyStore,
  shouldRetainTenantIntentKey,
} from "../model/intent-keys";
import { readTenantCorePermissions } from "../model/permissions";
import {
  buildUpdateTenantProfileDto,
  createTenantProfileDraft,
} from "../model/readers";
import type {
  TenantAddress,
  TenantMutationName,
  TenantMutationState,
  TenantProfileDraft,
  TenantProvisioningCommandResult,
  TenantResourceState,
  TenantView,
} from "../types";

export interface TenantCoreWorkspaceOptions {
  pollIntervalMs?: number;
  maxProvisioningPolls?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 3_000;
const DEFAULT_MAX_PROVISIONING_POLLS = 40;

export function useTenantCoreWorkspace(
  tenantId: string,
  options: TenantCoreWorkspaceOptions = {},
) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const permissions = useMemo(
    () => readTenantCorePermissions(user),
    [user],
  );
  const pollIntervalMs = Math.max(
    1,
    options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
  );
  const maxProvisioningPolls = Math.max(
    1,
    options.maxProvisioningPolls ?? DEFAULT_MAX_PROVISIONING_POLLS,
  );

  const tenantIdRef = useRef(tenantId);
  const tenantRef = useRef<TenantView | null>(null);
  const tenantIdentityGeneration = useRef(0);
  const requestGeneration = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const profileDirtyRef = useRef(false);
  const profileExpectedUpdatedAtRef = useRef<string | null>(null);
  const intentKeys = useRef(createTenantIntentKeyStore());

  const [tenant, setTenant] = useState<TenantView | null>(null);
  const [loadedTenantId, setLoadedTenantId] = useState<string | null>(null);
  const [resourceState, setResourceState] =
    useState<TenantResourceState>("loading");
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [profileDraft, setProfileDraftState] =
    useState<TenantProfileDraft | null>(null);
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileStale, setProfileStale] = useState(false);
  const [mutation, setMutation] = useState<
    TenantMutationState<TenantMutationName>
  >({ name: null, error: null });
  const [lastProvisioningCommand, setLastProvisioningCommand] =
    useState<TenantProvisioningCommandResult | null>(null);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [pollExhausted, setPollExhausted] = useState(false);

  const applyTenant = useCallback(
    (next: TenantView, resetProfile: boolean) => {
      if (tenantIdRef.current !== next.id) return;
      tenantRef.current = next;
      setTenant(next);
      setLoadedTenantId(next.id);
      setResourceState("ready");
      setLoadError(null);
      if (next.status !== "PROVISIONING") {
        setPollExhausted(false);
      }
      if (resetProfile) {
        const draft = createTenantProfileDraft(next);
        profileExpectedUpdatedAtRef.current = next.updatedAt;
        profileDirtyRef.current = false;
        setProfileDirty(false);
        setProfileStale(false);
        setProfileDraftState(draft);
      } else if (
        profileExpectedUpdatedAtRef.current !== null &&
        profileExpectedUpdatedAtRef.current !== next.updatedAt
      ) {
        setProfileStale(true);
      }
    },
    [],
  );

  const loadTenant = useCallback(
    async (background = false): Promise<TenantView | null> => {
      const generation = ++requestGeneration.current;
      requestAbort.current?.abort();
      const controller = new AbortController();
      requestAbort.current = controller;

      if (isAuthLoading) {
        if (!background) setResourceState("loading");
        return null;
      }
      if (!permissions.canRead) {
        if (!background) setResourceState("forbidden");
        return null;
      }
      if (!background) setResourceState("loading");
      setLoadError(null);

      try {
        const next = await tenantCoreApi.get(tenantId, controller.signal);
        if (
          generation !== requestGeneration.current ||
          controller.signal.aborted ||
          tenantIdRef.current !== tenantId
        ) {
          return null;
        }
        if (next.id !== tenantId) {
          throw localError(
            "TENANT_DETAIL_IDENTITY_MISMATCH",
            "The tenant response did not match the selected tenant.",
            502,
          );
        }
        applyTenant(next, !profileDirtyRef.current);
        return next;
      } catch (caught) {
        if (
          generation !== requestGeneration.current ||
          controller.signal.aborted ||
          tenantIdRef.current !== tenantId
        ) {
          return null;
        }
        const error = normalizeApiError(caught);
        setLoadError(error);
        if (!background || !tenantRef.current) setResourceState("error");
        return null;
      }
    },
    [applyTenant, isAuthLoading, permissions.canRead, tenantId],
  );

  useEffect(() => {
    tenantIdentityGeneration.current += 1;
    tenantIdRef.current = tenantId;
    tenantRef.current = null;
    profileDirtyRef.current = false;
    profileExpectedUpdatedAtRef.current = null;
    requestGeneration.current += 1;
    requestAbort.current?.abort();
    intentKeys.current.clearAll();
    const timer = window.setTimeout(() => {
      setTenant(null);
      setLoadedTenantId(null);
      setResourceState(isAuthLoading ? "loading" : "idle");
      setLoadError(null);
      setProfileDraftState(null);
      setProfileDirty(false);
      setProfileStale(false);
      setMutation({ name: null, error: null });
      setLastProvisioningCommand(null);
      setPollAttempts(0);
      setPollExhausted(false);
      void loadTenant(false);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      tenantIdentityGeneration.current += 1;
      requestGeneration.current += 1;
      requestAbort.current?.abort();
    };
  }, [isAuthLoading, loadTenant, tenantId]);

  const currentTenant = loadedTenantId === tenantId ? tenant : null;

  useEffect(() => {
    if (currentTenant?.status !== "PROVISIONING" || !permissions.canRead) {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        attempts += 1;
        setPollAttempts(attempts);
        const next = await loadTenant(true);
        if (cancelled) return;
        if (
          (next?.status ?? tenantRef.current?.status) === "PROVISIONING" &&
          attempts < maxProvisioningPolls
        ) {
          schedule();
          return;
        }
        if (
          attempts >= maxProvisioningPolls &&
          (next?.status ?? tenantRef.current?.status) === "PROVISIONING"
        ) {
          setPollExhausted(true);
        }
      }, pollIntervalMs);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [
    currentTenant?.status,
    loadTenant,
    maxProvisioningPolls,
    permissions.canRead,
    pollIntervalMs,
  ]);

  const assertCurrentTenant = useCallback((): TenantView => {
    const current = tenantRef.current;
    if (
      !current ||
      loadedTenantId !== tenantId ||
      tenantIdRef.current !== tenantId
    ) {
      throw localError(
        "TENANT_CONTEXT_CHANGED",
        "The selected tenant changed. Reload before continuing.",
        409,
      );
    }
    return current;
  }, [loadedTenantId, tenantId]);

  const runWrite = useCallback(
    async <Result,>(
      name: TenantMutationName,
      intent: unknown,
      action: (idempotencyKey: string) => Promise<Result>,
    ): Promise<Result> => {
      const identityGeneration = tenantIdentityGeneration.current;
      const idempotencyKey = intentKeys.current.get(name, intent);
      setMutation({ name, error: null });
      try {
        const result = await action(idempotencyKey);
        if (identityGeneration !== tenantIdentityGeneration.current) {
          throw localError(
            "TENANT_CONTEXT_CHANGED",
            "The selected tenant changed while the action was running.",
            409,
          );
        }
        intentKeys.current.clear(name);
        setMutation({ name: null, error: null });
        return result;
      } catch (caught) {
        const error = normalizeApiError(caught);
        if (identityGeneration === tenantIdentityGeneration.current) {
          if (!shouldRetainTenantIntentKey(error)) {
            intentKeys.current.clear(name);
          }
          setMutation({ name: null, error });
        }
        throw error;
      }
    },
    [],
  );

  const updateProfileDraft = useCallback(
    (patch: Partial<TenantProfileDraft>) => {
      profileDirtyRef.current = true;
      setProfileDirty(true);
      setProfileDraftState((current) =>
        current ? { ...current, ...patch } : current,
      );
    },
    [],
  );

  const updateAddressField = useCallback(
    (field: keyof TenantAddress, value: string) => {
      profileDirtyRef.current = true;
      setProfileDirty(true);
      setProfileDraftState((current) => {
        if (!current) return current;
        return {
          ...current,
          address: { ...(current.address ?? {}), [field]: value },
        };
      });
    },
    [],
  );

  const clearAddress = useCallback(() => {
    updateProfileDraft({ address: null });
  }, [updateProfileDraft]);

  const saveProfile = useCallback(async () => {
    if (!permissions.canUpdate) {
      throw localError(
        "TENANT_PROFILE_FORBIDDEN",
        "You do not have permission to update this tenant.",
        403,
      );
    }
    const current = assertCurrentTenant();
    if (!profileDraft) {
      throw localError(
        "TENANT_PROFILE_NOT_READY",
        "The tenant profile is not loaded.",
        409,
      );
    }

    let dto;
    try {
      dto = buildUpdateTenantProfileDto(
        profileDraft,
        profileExpectedUpdatedAtRef.current ?? current.updatedAt,
      );
    } catch {
      const error = localError(
        "INVALID_TENANT_PROFILE_DRAFT",
        "Complete the required company and country fields before saving.",
        400,
      );
      setMutation({ name: null, error });
      throw error;
    }

    try {
      const updated = await runWrite(
        "profile",
        { action: "tenant.profile.update", tenantId, dto },
        (key) => tenantCoreApi.updateProfile(tenantId, dto, key),
      );
      applyTenant(updated, true);
      return updated;
    } catch (caught) {
      const error = normalizeApiError(caught);
      if (error.errorCode === "TENANT_UPDATE_STALE") setProfileStale(true);
      throw error;
    }
  }, [
    applyTenant,
    assertCurrentTenant,
    permissions.canUpdate,
    profileDraft,
    runWrite,
    tenantId,
  ]);

  const reloadStaleProfile = useCallback(async () => {
    profileDirtyRef.current = false;
    setProfileDirty(false);
    setProfileStale(false);
    return loadTenant(false);
  }, [loadTenant]);

  const suspend = useCallback(async () => {
    requirePermission(
      permissions.canSuspendOrActivate,
      "TENANT_LIFECYCLE_FORBIDDEN",
    );
    const current = assertCurrentTenant();
    requireState(
      current.status === "ACTIVE" || current.status === "SUSPENDED",
      "TENANT_SUSPEND_NOT_ALLOWED",
    );
    const updated = await runWrite(
      "suspend",
      { action: "tenant.suspend", tenantId },
      (key) => tenantCoreApi.suspend(tenantId, key),
    );
    applyTenant(updated, true);
    return updated;
  }, [
    applyTenant,
    assertCurrentTenant,
    permissions.canSuspendOrActivate,
    runWrite,
    tenantId,
  ]);

  const activate = useCallback(async () => {
    requirePermission(
      permissions.canSuspendOrActivate,
      "TENANT_LIFECYCLE_FORBIDDEN",
    );
    const current = assertCurrentTenant();
    requireState(
      current.status === "SUSPENDED" || current.status === "ACTIVE",
      "TENANT_ACTIVATE_NOT_ALLOWED",
    );
    const updated = await runWrite(
      "activate",
      { action: "tenant.activate", tenantId },
      (key) => tenantCoreApi.activate(tenantId, key),
    );
    applyTenant(updated, true);
    return updated;
  }, [
    applyTenant,
    assertCurrentTenant,
    permissions.canSuspendOrActivate,
    runWrite,
    tenantId,
  ]);

  const reprovision = useCallback(async () => {
    requirePermission(
      permissions.canReprovisionOrCancel,
      "TENANT_REPROVISION_FORBIDDEN",
    );
    const current = assertCurrentTenant();
    requireState(
      current.status === "PROVISIONING_FAILED",
      "TENANT_REPROVISION_NOT_ALLOWED",
    );
    const result = await runWrite(
      "reprovision",
      { action: "tenant.reprovision", tenantId },
      (key) => tenantCoreApi.reprovision(tenantId, key),
    );
    setLastProvisioningCommand(result);
    await loadTenant(true);
    return result;
  }, [
    assertCurrentTenant,
    loadTenant,
    permissions.canReprovisionOrCancel,
    runWrite,
    tenantId,
  ]);

  const cancelProvisioning = useCallback(async () => {
    requirePermission(
      permissions.canReprovisionOrCancel,
      "TENANT_PROVISIONING_CANCEL_FORBIDDEN",
    );
    const current = assertCurrentTenant();
    requireState(
      current.status === "PROVISIONING",
      "TENANT_PROVISIONING_CANCEL_NOT_ALLOWED",
    );
    const result = await runWrite(
      "cancel-provisioning",
      { action: "tenant.provisioning.cancel", tenantId },
      (key) => tenantCoreApi.cancelProvisioning(tenantId, key),
    );
    setLastProvisioningCommand(result);
    await loadTenant(true);
    return result;
  }, [
    assertCurrentTenant,
    loadTenant,
    permissions.canReprovisionOrCancel,
    runWrite,
    tenantId,
  ]);

  const softDelete = useCallback(async () => {
    requirePermission(permissions.canSoftDelete, "TENANT_DELETE_FORBIDDEN");
    const current = assertCurrentTenant();
    requireState(current.status !== "DELETED", "TENANT_DELETE_NOT_ALLOWED");
    await runWrite(
      "soft-delete",
      { action: "tenant.soft-delete", tenantId },
      (key) => tenantCoreApi.softDelete(tenantId, key),
    );
    return loadTenant(true);
  }, [
    assertCurrentTenant,
    loadTenant,
    permissions.canSoftDelete,
    runWrite,
    tenantId,
  ]);

  const destroy = useCallback(
    async (destroySubscriptions = false) => {
      requirePermission(permissions.canDestroy, "TENANT_DESTROY_FORBIDDEN");
      const current = assertCurrentTenant();
      requireState(current.status === "DELETED", "TENANT_DESTROY_NOT_ALLOWED");
      await runWrite(
        "destroy",
        {
          action: "tenant.destroy",
          tenantId,
          destroySubscriptions,
        },
        (key) => tenantCoreApi.destroy(tenantId, destroySubscriptions, key),
      );
      tenantRef.current = null;
      profileExpectedUpdatedAtRef.current = null;
      setTenant(null);
      setProfileDraftState(null);
      setResourceState("destroyed");
    },
    [
      assertCurrentTenant,
      permissions.canDestroy,
      runWrite,
      tenantId,
    ],
  );

  const replaceTenant = useCallback(
    (next: TenantView) => applyTenant(next, !profileDirtyRef.current),
    [applyTenant],
  );

  const refresh = useCallback(() => {
    setPollAttempts(0);
    setPollExhausted(false);
    return loadTenant(false);
  }, [loadTenant]);

  return {
    tenant: currentTenant,
    loadedTenantId,
    resourceState,
    loadError,
    permissions,
    profileDraft,
    profileDirty,
    profileStale,
    mutation,
    lastProvisioningCommand,
    pollAttempts,
    pollExhausted,
    isPolling: currentTenant?.status === "PROVISIONING" && !pollExhausted,
    isAuthLoading,
    refresh,
    replaceTenant,
    updateProfileDraft,
    updateAddressField,
    clearAddress,
    saveProfile,
    reloadStaleProfile,
    suspend,
    activate,
    reprovision,
    cancelProvisioning,
    softDelete,
    destroy,
  };
}

export type UseTenantCoreWorkspaceResult = ReturnType<
  typeof useTenantCoreWorkspace
>;

function requirePermission(allowed: boolean, code: string): asserts allowed {
  if (!allowed) {
    throw localError(code, "You do not have permission for this action.", 403);
  }
}

function requireState(allowed: boolean, code: string): asserts allowed {
  if (!allowed) {
    throw localError(
      code,
      "This action is not available in the tenant's current state.",
      409,
    );
  }
}

function localError(
  errorCode: string,
  message: string,
  httpStatus: number,
): NormalizedApiError {
  return {
    isNormalized: true,
    httpStatus,
    errorCode,
    message,
  };
}
