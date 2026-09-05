"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { usePollWhile } from "@/shared/hooks/usePollWhile";
import { tenantProvisioningApi } from "../api/tenant-provisioning.api";
import {
  buildResolveSeedConflictDto,
  canonicalProvisioningIntent,
  validateAddApplicationInput,
} from "../model/commands";
import { deriveProvisioningPermissions } from "../model/permissions";
import { isOperationTerminal } from "../model/readers";
import type {
  ApplyTenantUpdatesDto,
  CreateAddApplicationOperationDto,
  CreateDecommissionOperationDto,
  CreateRepairOperationDto,
  ManagedProvisioningOperation,
  ProvisioningMutationName,
  ProvisioningMutationState,
  ProvisioningPage,
  ProvisioningPermissions,
  ProvisioningResource,
  RequestTenantPrerequisiteDto,
  SeedConflictDecision,
  SeedConflictResolution,
  TenantAvailableUpdate,
  TenantComponentInstallation,
  TenantOperationDetail,
  TenantOperationSummary,
  TenantOperationTimelineEvent,
  TenantPrerequisiteEvidenceRecord,
  TenantPrerequisiteRequest,
  TenantProvisioningCommandResult,
  TenantSeedState,
} from "../types";

const DEFAULT_PAGE_META = {
  page: 1,
  limit: 100,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
} as const;

export interface UseTenantProvisioningOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
}

export interface TenantProvisioningController {
  authLoading: boolean;
  permissions: ProvisioningPermissions;
  operations: ProvisioningResource<ProvisioningPage<TenantOperationSummary>>;
  selectedOperationId: string | null;
  selectedOperation: ProvisioningResource<TenantOperationDetail | null>;
  timeline: ProvisioningResource<ProvisioningPage<TenantOperationTimelineEvent>>;
  updates: ProvisioningResource<ProvisioningPage<TenantAvailableUpdate>>;
  components: ProvisioningResource<ProvisioningPage<TenantComponentInstallation>>;
  seeds: ProvisioningResource<ProvisioningPage<TenantSeedState>>;
  prerequisites: ProvisioningResource<TenantPrerequisiteEvidenceRecord[]>;
  mutation: ProvisioningMutationState;
  polling: boolean;
  selectOperation: (operationId: string) => void;
  /**
   * Loads the next page of operations and appends it.
   *
   * The history was pinned to the newest 100 with no way to reach further
   * back, so once a tenant had been provisioned, repaired and updated enough
   * times, its earlier operations could not be selected from the portal at all
   * - and the timeline of one operation stopped at its 100th event while the
   * header went on reporting the true total beside it.
   */
  loadMoreOperations: () => Promise<void>;
  /** The same, for the selected operation's timeline. */
  loadMoreTimeline: () => Promise<void>;
  loadingMoreOperations: boolean;
  loadingMoreTimeline: boolean;
  refreshAll: () => Promise<void>;
  retryOperation: (operationId: string) => Promise<TenantProvisioningCommandResult>;
  cancelOperation: (operationId: string) => Promise<TenantProvisioningCommandResult>;
  applyUpdates: (dto: ApplyTenantUpdatesDto) => Promise<TenantProvisioningCommandResult>;
  requestPrerequisites: (
    dto: RequestTenantPrerequisiteDto,
  ) => Promise<TenantPrerequisiteRequest>;
  addApplication: (
    dto: CreateAddApplicationOperationDto,
  ) => Promise<ManagedProvisioningOperation>;
  repair: (dto: CreateRepairOperationDto) => Promise<ManagedProvisioningOperation>;
  decommission: (
    dto: CreateDecommissionOperationDto,
  ) => Promise<ManagedProvisioningOperation>;
  resolveSeedConflict: (
    seed: TenantSeedState,
    decision: SeedConflictDecision,
    reasonCode: string,
  ) => Promise<SeedConflictResolution>;
  clearMutationError: () => void;
}

export function useTenantProvisioning(
  tenantId: string,
  options: UseTenantProvisioningOptions = {},
): TenantProvisioningController {
  const { user, isLoading: authLoading } = useAuth();
  const enabled = options.enabled !== false;
  const pollIntervalMs = Math.max(100, options.pollIntervalMs ?? 3_000);
  const permissions = useMemo(
    () => deriveProvisioningPermissions(user),
    [user],
  );

  const [operations, setOperations] = useState(() =>
    idleResource(emptyPage<TenantOperationSummary>()),
  );
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(
    null,
  );

  /**
   * The live selection, outside the closure.
   *
   * `loadSelectedOperation` only checked `signal?.aborted`, and two of its three
   * callers - `refreshAll` and the poll - pass no signal at all. Selecting
   * operation B while A's detail was in flight therefore let A's response
   * commit: the list highlighted B while the detail pane, timeline, and the
   * retry/cancel actions read A.
   */
  const selectedOperationIdRef = useRef(selectedOperationId);
  useEffect(() => {
    selectedOperationIdRef.current = selectedOperationId;
  }, [selectedOperationId]);
  const [selectedOperation, setSelectedOperation] = useState(() =>
    idleResource<TenantOperationDetail | null>(null),
  );
  const [timeline, setTimeline] = useState(() =>
    idleResource(emptyPage<TenantOperationTimelineEvent>()),
  );
  const [updates, setUpdates] = useState(() =>
    idleResource(emptyPage<TenantAvailableUpdate>()),
  );
  const [components, setComponents] = useState(() =>
    idleResource(emptyPage<TenantComponentInstallation>()),
  );
  const [seeds, setSeeds] = useState(() =>
    idleResource(emptyPage<TenantSeedState>()),
  );
  const [prerequisites, setPrerequisites] = useState(() =>
    idleResource<TenantPrerequisiteEvidenceRecord[]>([]),
  );
  const [mutation, setMutation] = useState<ProvisioningMutationState>({
    name: null,
    intentKey: null,
    error: null,
  });
  const [loadingMoreOperations, setLoadingMoreOperations] = useState(false);
  const [loadingMoreTimeline, setLoadingMoreTimeline] = useState(false);

  const intentKeys = useRef(new Map<string, string>());

  const loadOperations = useCallback(
    async (signal?: AbortSignal) => {
      if (!permissions.canReadOperations) {
        setOperations((current) => forbiddenResource(current.data));
        return;
      }
      startResource(setOperations);
      try {
        const page = await tenantProvisioningApi.listOperations(
          tenantId,
          { page: 1, limit: 100, sortBy: "generation", sortDir: "DESC" },
          signal,
        );
        if (signal?.aborted) return;
        setOperations(readyResource(page));
        setSelectedOperationId((current) => current ?? page.items[0]?.id ?? null);
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) return;
        failResource(setOperations, error);
      }
    },
    [permissions.canReadOperations, tenantId],
  );

  const loadSelectedOperation = useCallback(
    async (operationId: string, signal?: AbortSignal) => {
      if (!permissions.canReadOperations) {
        setSelectedOperation(forbiddenResource(null));
        setTimeline(forbiddenResource(emptyPage()));
        return;
      }
      startResource(setSelectedOperation);
      startResource(setTimeline);
      const [detailResult, timelineResult] = await Promise.allSettled([
        tenantProvisioningApi.getOperation(tenantId, operationId, signal),
        tenantProvisioningApi.listTimeline(
          tenantId,
          operationId,
          { page: 1, limit: 100, sortBy: "sequence", sortDir: "DESC" },
          signal,
        ),
      ]);
      // Identity, not just the signal: a signal-less caller has nothing to
      // abort, so the operation the response describes is the only thing that
      // can say whether it is still the one on screen.
      if (signal?.aborted || selectedOperationIdRef.current !== operationId) {
        return;
      }
      if (detailResult.status === "fulfilled") {
        setSelectedOperation(readyResource(detailResult.value));
      } else if (!isAbortError(detailResult.reason)) {
        failResource(setSelectedOperation, detailResult.reason);
      }
      if (timelineResult.status === "fulfilled") {
        setTimeline(readyResource(timelineResult.value));
      } else if (!isAbortError(timelineResult.reason)) {
        failResource(setTimeline, timelineResult.reason);
      }
    },
    [permissions.canReadOperations, tenantId],
  );

  const loadUpdates = useCallback(
    async (signal?: AbortSignal) => {
      if (!permissions.canReadOperations) {
        setUpdates((current) => forbiddenResource(current.data));
        return;
      }
      startResource(setUpdates);
      try {
        const page = await tenantProvisioningApi.listUpdates(
          tenantId,
          { page: 1, limit: 100, sortBy: "componentKey", sortDir: "ASC" },
          signal,
        );
        if (!signal?.aborted) setUpdates(readyResource(page));
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) return;
        failResource(setUpdates, error);
      }
    },
    [permissions.canReadOperations, tenantId],
  );

  const loadComponents = useCallback(
    async (signal?: AbortSignal) => {
      if (!permissions.canReadOperations) {
        setComponents((current) => forbiddenResource(current.data));
        return;
      }
      startResource(setComponents);
      try {
        const page = await tenantProvisioningApi.listComponents(
          tenantId,
          { page: 1, limit: 100, sortBy: "state", sortDir: "ASC" },
          signal,
        );
        if (!signal?.aborted) setComponents(readyResource(page));
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) return;
        failResource(setComponents, error);
      }
    },
    [permissions.canReadOperations, tenantId],
  );

  const loadSeeds = useCallback(
    async (signal?: AbortSignal) => {
      if (!permissions.canReadOperations) {
        setSeeds((current) => forbiddenResource(current.data));
        return;
      }
      startResource(setSeeds);
      try {
        const page = await tenantProvisioningApi.listSeeds(
          tenantId,
          { page: 1, limit: 100, sortBy: "status", sortDir: "ASC" },
          signal,
        );
        if (!signal?.aborted) setSeeds(readyResource(page));
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) return;
        failResource(setSeeds, error);
      }
    },
    [permissions.canReadOperations, tenantId],
  );

  const loadPrerequisites = useCallback(
    async (signal?: AbortSignal) => {
      if (!permissions.canReadPrerequisites) {
        setPrerequisites((current) => forbiddenResource(current.data));
        return;
      }
      startResource(setPrerequisites);
      try {
        const records = await tenantProvisioningApi.listPrerequisiteEvidence(
          tenantId,
          signal,
        );
        if (!signal?.aborted) setPrerequisites(readyResource(records));
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) return;
        failResource(setPrerequisites, error);
      }
    },
    [permissions.canReadPrerequisites, tenantId],
  );

  const refreshAll = useCallback(async () => {
    const tasks: Promise<unknown>[] = [];
    if (permissions.canReadOperations) {
      tasks.push(loadOperations(), loadUpdates(), loadComponents(), loadSeeds());
      if (selectedOperationId) {
        tasks.push(loadSelectedOperation(selectedOperationId));
      }
    }
    if (permissions.canReadPrerequisites) tasks.push(loadPrerequisites());
    await Promise.all(tasks);
  }, [
    loadComponents,
    loadOperations,
    loadPrerequisites,
    loadSeeds,
    loadSelectedOperation,
    loadUpdates,
    permissions.canReadOperations,
    permissions.canReadPrerequisites,
    selectedOperationId,
  ]);

  useEffect(() => {
    if (!enabled || authLoading) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void Promise.all([
        loadOperations(controller.signal),
        loadUpdates(controller.signal),
        loadComponents(controller.signal),
        loadSeeds(controller.signal),
        loadPrerequisites(controller.signal),
      ]);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    authLoading,
    enabled,
    loadComponents,
    loadOperations,
    loadPrerequisites,
    loadSeeds,
    loadUpdates,
  ]);

  useEffect(() => {
    if (!enabled || authLoading || !selectedOperationId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadSelectedOperation(selectedOperationId, controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    authLoading,
    enabled,
    loadSelectedOperation,
    selectedOperationId,
  ]);

  const polling = useMemo(() => {
    const operationPending =
      operations.data.items.some((operation) =>
        !isOperationTerminal(operation.status),
      ) ||
      (selectedOperation.data
        ? !isOperationTerminal(selectedOperation.data.status)
        : false);
    const prerequisitePending = prerequisites.data.some(
      (request) =>
        request.status !== "FAILED" &&
        (request.status !== "RELEASED" ||
          (request.maintenanceFence !== null &&
            request.maintenanceFence.status !== "RELEASED")),
    );
    return enabled && (operationPending || prerequisitePending);
  }, [enabled, operations.data.items, prerequisites.data, selectedOperation.data]);

  usePollWhile(
    polling && !authLoading,
    () => {
      const tasks: Promise<unknown>[] = [loadOperations()];
      if (selectedOperationId) {
        tasks.push(loadSelectedOperation(selectedOperationId));
      }
      if (permissions.canReadPrerequisites) tasks.push(loadPrerequisites());
      return Promise.all(tasks).then(() => undefined);
    },
    {
      intervalMs: pollIntervalMs,
      deps: [
        loadOperations,
        loadPrerequisites,
        loadSelectedOperation,
        permissions.canReadPrerequisites,
        selectedOperationId,
      ],
    },
  );

  const refreshAfterOperation = useCallback(
    async (operationId: string, detail?: TenantOperationDetail) => {
      setSelectedOperationId(operationId);
      if (detail) setSelectedOperation(readyResource(detail));
      await Promise.all([
        loadOperations(),
        loadSelectedOperation(operationId),
        loadUpdates(),
        loadComponents(),
        loadSeeds(),
        permissions.canReadPrerequisites ? loadPrerequisites() : Promise.resolve(),
      ]);
    },
    [
      loadComponents,
      loadOperations,
      loadPrerequisites,
      loadSeeds,
      loadSelectedOperation,
      loadUpdates,
      permissions.canReadPrerequisites,
    ],
  );

  const runCommand = useCallback(
    async <T,>(
      name: ProvisioningMutationName,
      permission: boolean,
      payload: unknown,
      command: (idempotencyKey: string) => Promise<T>,
      onSuccess: (result: T) => Promise<void>,
    ): Promise<T> => {
      if (!permission) throw localPermissionError();
      const fingerprint = `${name}:${canonicalProvisioningIntent(payload)}`;
      const idempotencyKey =
        intentKeys.current.get(fingerprint) ?? generateUUIDv7();
      intentKeys.current.set(fingerprint, idempotencyKey);
      setMutation({ name, intentKey: idempotencyKey, error: null });
      try {
        const result = await command(idempotencyKey);
        intentKeys.current.delete(fingerprint);
        await onSuccess(result);
        setMutation({ name: null, intentKey: null, error: null });
        return result;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (!shouldRetainProvisioningIntent(normalized)) {
          intentKeys.current.delete(fingerprint);
        }
        setMutation({ name, intentKey: idempotencyKey, error: normalized });
        throw normalized;
      }
    },
    [],
  );

  const retryOperation = useCallback(
    (operationId: string) =>
      runCommand(
        "retry",
        permissions.canRetryOrCancel,
        { tenantId, operationId },
        (key) => tenantProvisioningApi.retryOperation(tenantId, operationId, key),
        (result) => refreshAfterOperation(result.operation.id, result.operation),
      ),
    [
      permissions.canRetryOrCancel,
      refreshAfterOperation,
      runCommand,
      tenantId,
    ],
  );

  const cancelOperation = useCallback(
    (operationId: string) =>
      runCommand(
        "cancel",
        permissions.canRetryOrCancel,
        { tenantId, operationId },
        (key) => tenantProvisioningApi.cancelOperation(tenantId, operationId, key),
        (result) => refreshAfterOperation(result.operation.id, result.operation),
      ),
    [
      permissions.canRetryOrCancel,
      refreshAfterOperation,
      runCommand,
      tenantId,
    ],
  );

  const applyUpdates = useCallback(
    (dto: ApplyTenantUpdatesDto) =>
      runCommand(
        "apply-updates",
        permissions.canApplyUpdates,
        { tenantId, dto },
        (key) => tenantProvisioningApi.applyUpdates(tenantId, dto, key),
        (result) => refreshAfterOperation(result.operation.id, result.operation),
      ),
    [permissions.canApplyUpdates, refreshAfterOperation, runCommand, tenantId],
  );

  const requestPrerequisites = useCallback(
    (dto: RequestTenantPrerequisiteDto) =>
      runCommand(
        "request-prerequisites",
        permissions.canRequestPrerequisites,
        { tenantId, dto },
        (key) => tenantProvisioningApi.requestPrerequisites(tenantId, dto, key),
        async () => {
          if (permissions.canReadPrerequisites) await loadPrerequisites();
        },
      ),
    [
      loadPrerequisites,
      permissions.canReadPrerequisites,
      permissions.canRequestPrerequisites,
      runCommand,
      tenantId,
    ],
  );

  const addApplication = useCallback(
    async (dto: CreateAddApplicationOperationDto) => {
      validateAddApplicationInput(dto);
      return await runCommand(
        "add-application",
        permissions.canAddApplication,
        { tenantId, dto },
        (key) => tenantProvisioningApi.addApplication(tenantId, dto, key),
        (result) => refreshAfterOperation(result.operationId),
      );
    },
    [permissions.canAddApplication, refreshAfterOperation, runCommand, tenantId],
  );

  const repair = useCallback(
    (dto: CreateRepairOperationDto) =>
      runCommand(
        "repair",
        permissions.canRepair,
        { tenantId, dto },
        (key) => tenantProvisioningApi.repair(tenantId, dto, key),
        (result) => refreshAfterOperation(result.operationId),
      ),
    [permissions.canRepair, refreshAfterOperation, runCommand, tenantId],
  );

  const decommission = useCallback(
    (dto: CreateDecommissionOperationDto) =>
      runCommand(
        "decommission",
        permissions.canDecommission,
        { tenantId, dto },
        (key) => tenantProvisioningApi.decommission(tenantId, dto, key),
        (result) => refreshAfterOperation(result.operationId),
      ),
    [permissions.canDecommission, refreshAfterOperation, runCommand, tenantId],
  );

  const resolveSeedConflict = useCallback(
    async (
      seed: TenantSeedState,
      decision: SeedConflictDecision,
      reasonCode: string,
    ) => {
      const dto = buildResolveSeedConflictDto(seed, decision, reasonCode);
      return await runCommand(
        "resolve-seed-conflict",
        permissions.canResolveConflicts,
        { tenantId, seedStateId: seed.id, dto },
        (key) =>
          tenantProvisioningApi.resolveSeedConflict(tenantId, seed.id, dto, key),
        async () => {
          await Promise.all([loadSeeds(), loadOperations()]);
        },
      );
    },
    [
      loadOperations,
      loadSeeds,
      permissions.canResolveConflicts,
      runCommand,
      tenantId,
    ],
  );

  /**
   * Appends the next page of operations to the ones already shown.
   *
   * Guarded on the page it is extending: `meta.page` is the newest page loaded,
   * so a second click while the first request is still in flight asks for the
   * same page rather than skipping one, and the append is dropped if the list
   * was reloaded underneath it.
   */
  const loadMoreOperations = useCallback(async () => {
    if (!permissions.canReadOperations) return;
    const current = operations.data.meta;
    if (!current.hasNext || loadingMoreOperations) return;
    const nextPage = current.page + 1;
    setLoadingMoreOperations(true);
    try {
      const page = await tenantProvisioningApi.listOperations(tenantId, {
        page: nextPage,
        limit: current.limit,
        sortBy: "generation",
        sortDir: "DESC",
      });
      setOperations((previous) =>
        previous.data.meta.page === nextPage - 1
          ? readyResource({
              items: [...previous.data.items, ...page.items],
              meta: page.meta,
            })
          : previous,
      );
    } catch (error) {
      if (!isAbortError(error)) failResource(setOperations, error);
    } finally {
      setLoadingMoreOperations(false);
    }
  }, [
    loadingMoreOperations,
    operations.data.meta,
    permissions.canReadOperations,
    tenantId,
  ]);

  /**
   * The same for the timeline, and additionally fenced on the operation.
   *
   * Selecting another operation while a page is in flight must not append that
   * operation's events to this one's - the same identity check the selected
   * detail already makes.
   */
  const loadMoreTimeline = useCallback(async () => {
    const operationId = selectedOperationIdRef.current;
    if (!operationId || !permissions.canReadOperations) return;
    const current = timeline.data.meta;
    if (!current.hasNext || loadingMoreTimeline) return;
    const nextPage = current.page + 1;
    setLoadingMoreTimeline(true);
    try {
      const page = await tenantProvisioningApi.listTimeline(
        tenantId,
        operationId,
        {
          page: nextPage,
          limit: current.limit,
          sortBy: "sequence",
          sortDir: "DESC",
        },
      );
      if (selectedOperationIdRef.current !== operationId) return;
      setTimeline((previous) =>
        previous.data.meta.page === nextPage - 1
          ? readyResource({
              items: [...previous.data.items, ...page.items],
              meta: page.meta,
            })
          : previous,
      );
    } catch (error) {
      if (!isAbortError(error)) failResource(setTimeline, error);
    } finally {
      setLoadingMoreTimeline(false);
    }
  }, [
    loadingMoreTimeline,
    permissions.canReadOperations,
    tenantId,
    timeline.data.meta,
  ]);

  return {
    authLoading,
    permissions,
    operations,
    selectedOperationId,
    selectedOperation,
    timeline,
    updates,
    components,
    seeds,
    prerequisites,
    mutation,
    polling,
    selectOperation: setSelectedOperationId,
    loadMoreOperations,
    loadMoreTimeline,
    loadingMoreOperations,
    loadingMoreTimeline,
    refreshAll,
    retryOperation,
    cancelOperation,
    applyUpdates,
    requestPrerequisites,
    addApplication,
    repair,
    decommission,
    resolveSeedConflict,
    clearMutationError: () =>
      setMutation({ name: null, intentKey: null, error: null }),
  };
}

export function shouldRetainProvisioningIntent(error: NormalizedApiError): boolean {
  return (
    error.errorCode === "GW.IDEM.IN_FLIGHT" ||
    error.httpStatus >= 500 ||
    error.errorCode === "UNKNOWN_ERROR"
  );
}

function emptyPage<T>(): ProvisioningPage<T> {
  return { items: [], meta: { ...DEFAULT_PAGE_META } };
}

function idleResource<T>(data: T): ProvisioningResource<T> {
  return { status: "idle", data, error: null, refreshing: false };
}

function readyResource<T>(data: T): ProvisioningResource<T> {
  return { status: "ready", data, error: null, refreshing: false };
}

function forbiddenResource<T>(data: T): ProvisioningResource<T> {
  return { status: "forbidden", data, error: null, refreshing: false };
}

function startResource<T>(
  setter: React.Dispatch<React.SetStateAction<ProvisioningResource<T>>>,
): void {
  setter((current) => ({
    ...current,
    status: current.status === "ready" ? "ready" : "loading",
    error: null,
    refreshing: current.status === "ready",
  }));
}

function failResource<T>(
  setter: React.Dispatch<React.SetStateAction<ProvisioningResource<T>>>,
  error: unknown,
): void {
  const normalized = normalizeApiError(error);
  setter((current) => ({
    ...current,
    status: normalized.httpStatus === 403 ? "forbidden" : "error",
    error: normalized,
    refreshing: false,
  }));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function localPermissionError(): NormalizedApiError {
  return {
    isNormalized: true,
    httpStatus: 403,
    errorCode: "ADMIN_PERMISSION_REQUIRED",
    errorCategory: "AUTHORIZATION",
    message: "The required provisioning permissions are missing.",
  };
}
