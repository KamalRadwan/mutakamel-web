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
import { useOperatorRefreshGuard } from "@/shared/hooks/useOperatorRefreshGuard";
import { usePollWhile } from "@/shared/hooks/usePollWhile";
import { provisioningPollIntervalMs } from "../../provisioning/model/polling";
import { tenantCoreApi } from "../api/tenant-core.api";
import {
  canAbandonTenantDestroy,
  canResumeTenantDestroy,
  isTenantDestroyAdvancing,
  tenantDestroyPollFingerprint,
} from "../model/destroy";
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
  TenantDestroyRequestView,
  TenantDestroyView,
} from "../types";

/**
 * The projection the status read returns. A destroy command's answer also
 * says whether it resumed the request; that belongs to the command, not to
 * the request's state, so it is not kept beside the polled projection.
 */
function destroyProjection(
  answer: TenantDestroyView | TenantDestroyRequestView,
): TenantDestroyView {
  if (!("resumed" in answer)) return answer;
  const operation: Partial<TenantDestroyRequestView> = { ...answer };
  delete operation.resumed;
  return operation as TenantDestroyView;
}

export interface TenantCoreWorkspaceOptions {
  /**
   * Base cadence. Provisioning status polls at it; destruction progress
   * starts at it and backs off while nothing changes.
   */
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
  const [destroyOperation, setDestroyOperation] = useState<TenantDestroyView | null>(null);
  const [destroyError, setDestroyError] = useState<NormalizedApiError | null>(null);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [pollExhausted, setPollExhausted] = useState(false);

  /**
   * Destruction progress backs off like the provisioning workspace: 3 s →
   * 15 s → 60 s while consecutive polls observe nothing new, back to the base
   * after any change, operator command, manual refresh or return to the tab.
   * A status read started before a command answered is discarded by
   * `destroyReadGeneration`, so it cannot overwrite the command's result.
   */
  const destroyReadGeneration = useRef(0);
  const destroyQuietPollsRef = useRef(0);
  const destroyPollFingerprintRef = useRef<string | null>(null);
  const [destroyQuietPolls, setDestroyQuietPolls] = useState(0);
  // Nothing is read while the page is hidden; the evidence on screen stays.
  const destroyPollPaused = useOperatorRefreshGuard().isPaused;

  const resetDestroyPollBackoff = useCallback(() => {
    destroyQuietPollsRef.current = 0;
    destroyPollFingerprintRef.current = null;
    setDestroyQuietPolls(0);
  }, []);

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
      if (next.status !== "DELETED") {
        // Only a soft-deleted tenant carries a destruction request. Restoring
        // one after its request was abandoned leaves that request as Core
        // evidence; the workspace stops showing it and polls nothing.
        setDestroyOperation(null);
        setDestroyError(null);
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

  const applyDestruction = useCallback((operation: TenantDestroyView | null) => {
    setDestroyOperation(operation);
    setDestroyError(null);
    if (operation?.phase === "ABANDONED") {
      // Core keys a destruction request by its idempotency key and replays an
      // abandoned one unchanged, so a retained destroy key would bring this
      // request back instead of accepting a new one.
      intentKeys.current.clear("destroy");
    }
    if (operation?.phase === "SUCCEEDED") {
      tenantRef.current = null;
      profileExpectedUpdatedAtRef.current = null;
      setTenant(null);
      setProfileDraftState(null);
      setResourceState("destroyed");
    }
  }, []);

  /**
   * Reads the destruction projection. Resolves to what was applied, or
   * `undefined` when the read failed or was superseded — by another tenant, a
   * newer read, or a command's own answer.
   */
  const loadDestruction = useCallback(async (): Promise<
    TenantDestroyView | null | undefined
  > => {
    const identityGeneration = tenantIdentityGeneration.current;
    const readGeneration = ++destroyReadGeneration.current;
    const current = () =>
      identityGeneration === tenantIdentityGeneration.current &&
      tenantIdRef.current === tenantId &&
      readGeneration === destroyReadGeneration.current;
    try {
      const operation = await tenantCoreApi.getDestroy(tenantId);
      if (!current()) return undefined;
      applyDestruction(operation);
      return operation;
    } catch (caught) {
      if (current()) setDestroyError(normalizeApiError(caught));
      return undefined;
    }
  }, [applyDestruction, tenantId]);

  /** Adopts a command's answer as newer than any status read in flight. */
  const adoptDestruction = useCallback(
    (answer: TenantDestroyView | TenantDestroyRequestView) => {
      destroyReadGeneration.current += 1;
      applyDestruction(destroyProjection(answer));
    },
    [applyDestruction],
  );

  /**
   * One background read. The same fingerprint as the last one is a quiet poll
   * and slows the cadence; a failed read is quiet too, so an unavailable
   * status route is not hammered at the base cadence.
   */
  const pollDestruction = useCallback(async () => {
    const operation = await loadDestruction();
    const fingerprint =
      operation === undefined ? null : tenantDestroyPollFingerprint(operation);
    const quiet =
      fingerprint === null ||
      fingerprint === destroyPollFingerprintRef.current;
    if (fingerprint !== null) destroyPollFingerprintRef.current = fingerprint;
    destroyQuietPollsRef.current = quiet ? destroyQuietPollsRef.current + 1 : 0;
    setDestroyQuietPolls(destroyQuietPollsRef.current);
  }, [loadDestruction]);

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
        if (next.status === "DELETED") await loadDestruction();
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
    [applyTenant, isAuthLoading, loadDestruction, permissions.canRead, tenantId],
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
      setDestroyOperation(null);
      setDestroyError(null);
      resetDestroyPollBackoff();
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
  }, [isAuthLoading, loadTenant, resetDestroyPollBackoff, tenantId]);

  const currentTenant = loadedTenantId === tenantId ? tenant : null;

  usePollWhile(
    currentTenant?.status === "PROVISIONING" && permissions.canRead,
    () => loadTenant(true),
    {
      intervalMs: pollIntervalMs,
      maxAttempts: maxProvisioningPolls,
      onAttempt: setPollAttempts,
      onExhausted: () => setPollExhausted(true),
      shouldContinue: () => tenantRef.current?.status === "PROVISIONING",
      deps: [loadTenant],
    },
  );

  // Only phases Worker still advances are polled. SUCCEEDED, BLOCKED and
  // ABANDONED are final: BLOCKED waits for an operator, not for Worker.
  const destroyAdvancing =
    destroyOperation !== null &&
    destroyOperation.tenantId === tenantId &&
    isTenantDestroyAdvancing(destroyOperation.phase);
  const destroyPolling =
    destroyAdvancing && permissions.canRead && !destroyPollPaused;
  usePollWhile(destroyPolling, pollDestruction, {
    intervalMs: provisioningPollIntervalMs(destroyQuietPolls, pollIntervalMs),
    deps: [pollDestruction],
  });

  // Coming back resumes at the base cadence rather than a slowed one: the
  // operator is looking again, and whatever changed meanwhile is unseen.
  const wasDestroyPollPausedRef = useRef(destroyPollPaused);
  useEffect(() => {
    const resumed = wasDestroyPollPausedRef.current && !destroyPollPaused;
    wasDestroyPollPausedRef.current = destroyPollPaused;
    if (!resumed) return;
    const timer = window.setTimeout(resetDestroyPollBackoff, 0);
    return () => window.clearTimeout(timer);
  }, [destroyPollPaused, resetDestroyPollBackoff]);

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

  // A lifecycle command answers with the whole tenant, but it is not the
  // profile editor's write. Resetting the draft from it would throw away
  // whatever the operator had typed into the profile form before suspending —
  // so an untouched draft is refreshed and a dirty one is kept and marked
  // stale, exactly as a background refresh is handled.
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
    applyTenant(updated, !profileDirtyRef.current);
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
    applyTenant(updated, !profileDirtyRef.current);
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

  const restore = useCallback(async () => {
    requirePermission(permissions.canRestore, "TENANT_RESTORE_FORBIDDEN");
    const current = assertCurrentTenant();
    requireState(current.status === "DELETED", "TENANT_RESTORE_NOT_ALLOWED");
    const updated = await runWrite(
      "restore",
      { action: "tenant.restore", tenantId },
      (key) => tenantCoreApi.restore(tenantId, key),
    );
    applyTenant(updated, !profileDirtyRef.current);
    return updated;
  }, [
    applyTenant,
    assertCurrentTenant,
    permissions.canRestore,
    runWrite,
    tenantId,
  ]);

  const destroy = useCallback(
    async (destroySubscriptions = false) => {
      requirePermission(permissions.canDestroy, "TENANT_DESTROY_FORBIDDEN");
      const current = assertCurrentTenant();
      requireState(current.status === "DELETED", "TENANT_DESTROY_NOT_ALLOWED");
      resetDestroyPollBackoff();
      const operation = await runWrite(
        "destroy",
        {
          action: "tenant.destroy",
          tenantId,
          destroySubscriptions,
        },
        (key) => tenantCoreApi.destroy(tenantId, destroySubscriptions, key),
      );
      adoptDestruction(operation);
      return operation;
    },
    [
      assertCurrentTenant,
      permissions.canDestroy,
      adoptDestruction,
      resetDestroyPollBackoff,
      runWrite,
      tenantId,
    ],
  );

  /**
   * Gives up the shown destruction request while Core still allows it
   * (STOPPING_PROVISIONING, or BLOCKED while stopping provisioning), under the
   * same permissions as destroy. The database is kept and the tenant stays
   * soft-deleted, so restore and a new destruction request become available
   * again.
   */
  const abandonDestruction = useCallback(async () => {
    requirePermission(permissions.canDestroy, "TENANT_DESTROY_FORBIDDEN");
    const current = assertCurrentTenant();
    const operation = destroyOperation;
    requireState(
      current.status === "DELETED" &&
        operation !== null &&
        operation.tenantId === tenantId &&
        canAbandonTenantDestroy(operation),
      "TENANT_DESTROY_NOT_ABANDONABLE",
    );
    const { operationId } = operation;
    resetDestroyPollBackoff();
    try {
      const abandoned = await runWrite(
        "abandon-destroy",
        { action: "tenant.destroy.abandon", tenantId, operationId },
        (key) => tenantCoreApi.abandonDestroy(tenantId, operationId, key),
      );
      adoptDestruction(abandoned);
      return abandoned;
    } catch (caught) {
      const error = normalizeApiError(caught);
      // Core already moved the request past the point it can be abandoned
      // (or no longer knows it): show what it is now, not the stale phase
      // that offered the action.
      if (
        error.errorCode === "TENANT_DESTROY_NOT_ABANDONABLE" ||
        error.errorCode === "TENANT_DESTROY_NOT_FOUND"
      ) {
        await loadDestruction();
      }
      throw error;
    }
  }, [
    adoptDestruction,
    assertCurrentTenant,
    destroyOperation,
    loadDestruction,
    permissions.canDestroy,
    resetDestroyPollBackoff,
    runWrite,
    tenantId,
  ]);

  /**
   * Resumes the shown BLOCKED request, under the same permissions as destroy.
   * Core resumes it when destruction is requested again under a new
   * idempotency key: attempts reset and the block clears. One BLOCKED while
   * stopping provisioning goes back to STOPPING_PROVISIONING and Worker
   * re-checks at once (its one-hour stop deadline still counts from the
   * original request, so a provisioning operation that is still running
   * blocks it again on that attempt); one halted after the drop was
   * authorized continues in the same phase. The answer's `resumed` says
   * whether this call resumed it or found it no longer blocked.
   * The key scope is its own, so it can never be the request's original key,
   * whose exact replay Core answers unchanged; the block time is part of the
   * intent, so a retained key retries one resume exactly and a later block of
   * the same request gets a new key.
   */
  const resumeDestruction = useCallback(async () => {
    requirePermission(permissions.canDestroy, "TENANT_DESTROY_FORBIDDEN");
    const current = assertCurrentTenant();
    const operation = destroyOperation;
    requireState(
      current.status === "DELETED" &&
        operation !== null &&
        operation.tenantId === tenantId &&
        canResumeTenantDestroy(operation),
      "TENANT_DESTROY_NOT_RESUMABLE",
    );
    const { operationId, blockedAt } = operation;
    resetDestroyPollBackoff();
    const resumed = await runWrite(
      "resume-destroy",
      { action: "tenant.destroy.resume", tenantId, operationId, blockedAt },
      (key) => tenantCoreApi.destroy(tenantId, false, key),
    );
    adoptDestruction(resumed);
    return resumed;
  }, [
    adoptDestruction,
    assertCurrentTenant,
    destroyOperation,
    permissions.canDestroy,
    resetDestroyPollBackoff,
    runWrite,
    tenantId,
  ]);

  /** Manual re-read of destruction progress; resets the poll back-off. */
  const refreshDestruction = useCallback(() => {
    resetDestroyPollBackoff();
    return loadDestruction();
  }, [loadDestruction, resetDestroyPollBackoff]);

  const replaceTenant = useCallback(
    (next: TenantView) => applyTenant(next, !profileDirtyRef.current),
    [applyTenant],
  );

  const refresh = useCallback(() => {
    setPollAttempts(0);
    setPollExhausted(false);
    resetDestroyPollBackoff();
    return loadTenant(false);
  }, [loadTenant, resetDestroyPollBackoff]);

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
    destroyOperation: destroyOperation?.tenantId === tenantId ? destroyOperation : null,
    destroyError,
    /** Destruction progress is being re-read automatically. */
    destroyPolling,
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
    restore,
    destroy,
    abandonDestruction,
    resumeDestruction,
    refreshDestruction,
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
