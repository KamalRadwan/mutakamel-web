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
import { useOperatorRefreshGuard } from "@/shared/hooks/useOperatorRefreshGuard";
import { usePollWhile } from "@/shared/hooks/usePollWhile";
import { tenantProvisioningApi } from "../api/tenant-provisioning.api";
import {
  buildResolveSeedConflictDto,
  canonicalProvisioningIntent,
  validateAddApplicationInput,
} from "../model/commands";
import { deriveProvisioningPermissions } from "../model/permissions";
import {
  PROVISIONING_POLL_BASE_MS,
  appendPage,
  mergeFirstPage,
  newestEventFirst,
  newestOperationFirst,
  provisioningPollFingerprint,
  provisioningPollIntervalMs,
} from "../model/polling";
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
  TenantProvisioningResyncResult,
  TenantSeedState,
} from "../types";

/**
 * How long after an accepted Resync the operation is read again. Core answers
 * at once and the Worker's re-delivered records follow (core-app
 * `tenant-operations.controller.ts`: "refresh the detail a few seconds
 * later"). An open operation is polled anyway; a success whose step was left
 * unsettled is not, and would show the settled step only on a manual refresh.
 */
const RESYNC_FOLLOW_UP_MS = 5_000;

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
  /** The fastest poll cadence; quiet polls back off to 5× and then 20× it. */
  pollIntervalMs?: number;
  /**
   * A caller-owned pause, such as an open confirmation dialog. Polling also
   * pauses on its own while the page is hidden.
   */
  paused?: boolean;
}

export interface TenantProvisioningController {
  authLoading: boolean;
  permissions: ProvisioningPermissions;
  operations: ProvisioningResource<ProvisioningPage<TenantOperationSummary>>;
  selectedOperationId: string | null;
  selectedOperation: ProvisioningResource<TenantOperationDetail | null>;
  /**
   * When the selected operation was last read, in browser time. Running steps
   * measure their elapsed time against it, so it advances with every read
   * rather than on a ticking clock.
   */
  selectedOperationReadAtMs: number | null;
  timeline: ProvisioningResource<ProvisioningPage<TenantOperationTimelineEvent>>;
  updates: ProvisioningResource<ProvisioningPage<TenantAvailableUpdate>>;
  components: ProvisioningResource<ProvisioningPage<TenantComponentInstallation>>;
  seeds: ProvisioningResource<ProvisioningPage<TenantSeedState>>;
  prerequisites: ProvisioningResource<TenantPrerequisiteEvidenceRecord[]>;
  mutation: ProvisioningMutationState;
  /** Open work or prerequisites remain, so the workspace refreshes itself. */
  polling: boolean;
  /** Refresh is held: the page is hidden or the caller paused it. */
  pollPaused: boolean;
  /** The current refresh cadence, which slows while nothing changes. */
  pollIntervalMs: number;
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
  /**
   * Asks the Worker to re-deliver the operation's retained progress, then
   * reads the operation again once the records have had time to arrive.
   */
  resyncOperation: (operationId: string) => Promise<TenantProvisioningResyncResult>;
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
  const basePollIntervalMs = Math.max(
    100,
    options.pollIntervalMs ?? PROVISIONING_POLL_BASE_MS,
  );
  const refreshGuard = useOperatorRefreshGuard({
    modalOrMenuOpen: options.paused === true,
  });
  const pollPaused = refreshGuard.isPaused;
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
  const [selectedOperationReadAtMs, setSelectedOperationReadAtMs] = useState<
    number | null
  >(null);
  const [timeline, setTimeline] = useState(() =>
    idleResource(emptyPage<TenantOperationTimelineEvent>()),
  );
  /** Whose events the timeline holds, so a refresh can keep its older pages. */
  const timelineOperationIdRef = useRef<string | null>(null);
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

  /**
   * Poll backoff. Consecutive polls that changed nothing slow the cadence
   * from 3 s to 15 s to 60 s; anything that changed, and every operator
   * intent, returns it to 3 s.
   */
  const [quietPolls, setQuietPolls] = useState(0);
  const quietPollsRef = useRef(0);
  const lastPollFingerprintRef = useRef<string | null>(null);
  const pollIntervalMs = provisioningPollIntervalMs(
    quietPolls,
    basePollIntervalMs,
  );

  const intentKeys = useRef(new Map<string, string>());

  const resetPollBackoff = useCallback(() => {
    quietPollsRef.current = 0;
    lastPollFingerprintRef.current = null;
    setQuietPolls(0);
  }, []);

  const loadOperations = useCallback(
    async (
      signal?: AbortSignal,
    ): Promise<ProvisioningPage<TenantOperationSummary> | null> => {
      if (!permissions.canReadOperations) {
        setOperations((current) => forbiddenResource(current.data));
        return null;
      }
      startResource(setOperations);
      try {
        const page = await tenantProvisioningApi.listOperations(
          tenantId,
          { page: 1, limit: 100, sortBy: "generation", sortDir: "DESC" },
          signal,
        );
        if (signal?.aborted) return null;
        // A refresh re-reads page one only; older pages the operator loaded
        // stay, unless they describe another tenant.
        setOperations((current) =>
          readyResource(
            current.data.items.every((item) => item.tenantId === tenantId)
              ? mergeFirstPage(current.data, page, newestOperationFirst)
              : page,
          ),
        );
        setSelectedOperationId((current) => current ?? page.items[0]?.id ?? null);
        return page;
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) return null;
        failResource(setOperations, error);
        return null;
      }
    },
    [permissions.canReadOperations, tenantId],
  );

  const loadSelectedOperation = useCallback(
    async (
      operationId: string,
      signal?: AbortSignal,
    ): Promise<TenantOperationDetail | null> => {
      if (!permissions.canReadOperations) {
        setSelectedOperation(forbiddenResource(null));
        setTimeline(forbiddenResource(emptyPage()));
        return null;
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
        return null;
      }
      if (detailResult.status === "fulfilled") {
        setSelectedOperation(readyResource(detailResult.value));
        setSelectedOperationReadAtMs(Date.now());
      } else if (!isAbortError(detailResult.reason)) {
        failResource(setSelectedOperation, detailResult.reason);
      }
      if (timelineResult.status === "fulfilled") {
        // The same operation's timeline keeps the older pages already loaded;
        // another operation's replaces it.
        const sameOperation = timelineOperationIdRef.current === operationId;
        timelineOperationIdRef.current = operationId;
        const page = timelineResult.value;
        setTimeline((current) =>
          readyResource(
            sameOperation
              ? mergeFirstPage(current.data, page, newestEventFirst)
              : page,
          ),
        );
      } else if (!isAbortError(timelineResult.reason)) {
        failResource(setTimeline, timelineResult.reason);
      }
      return detailResult.status === "fulfilled" ? detailResult.value : null;
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
    async (
      signal?: AbortSignal,
    ): Promise<TenantPrerequisiteEvidenceRecord[] | null> => {
      if (!permissions.canReadPrerequisites) {
        setPrerequisites((current) => forbiddenResource(current.data));
        return null;
      }
      startResource(setPrerequisites);
      try {
        const records = await tenantProvisioningApi.listPrerequisiteEvidence(
          tenantId,
          signal,
        );
        if (signal?.aborted) return null;
        setPrerequisites(readyResource(records));
        return records;
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) return null;
        failResource(setPrerequisites, error);
        return null;
      }
    },
    [permissions.canReadPrerequisites, tenantId],
  );

  const refreshAll = useCallback(async () => {
    resetPollBackoff();
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
    resetPollBackoff,
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

  /**
   * One background read. What it observed decides the next cadence: the same
   * fingerprint as last time is a quiet poll and slows the cadence, anything
   * else returns it to the base.
   */
  const pollOnce = useCallback(async () => {
    const operationId = selectedOperationIdRef.current;
    const [page, detail, records] = await Promise.all([
      loadOperations(),
      operationId ? loadSelectedOperation(operationId) : Promise.resolve(null),
      permissions.canReadPrerequisites
        ? loadPrerequisites()
        : Promise.resolve(null),
    ]);
    const fingerprint = provisioningPollFingerprint({
      operations: page?.items ?? null,
      detail,
      prerequisites: records,
    });
    const quiet = fingerprint === lastPollFingerprintRef.current;
    lastPollFingerprintRef.current = fingerprint;
    quietPollsRef.current = quiet ? quietPollsRef.current + 1 : 0;
    setQuietPolls(quietPollsRef.current);
  }, [
    loadOperations,
    loadPrerequisites,
    loadSelectedOperation,
    permissions.canReadPrerequisites,
  ]);

  // Nothing is read while the page is hidden or the caller holds refresh
  // (an open confirmation dialog); the rows on screen stay as they are.
  usePollWhile(polling && !authLoading && !pollPaused, pollOnce, {
    intervalMs: pollIntervalMs,
    deps: [pollOnce, selectedOperationId],
  });

  // Coming back resumes at the base cadence rather than a slowed one: the
  // operator is looking again, and whatever changed meanwhile is unseen.
  const wasPollPausedRef = useRef(pollPaused);
  useEffect(() => {
    const resumed = wasPollPausedRef.current && !pollPaused;
    wasPollPausedRef.current = pollPaused;
    if (!resumed) return;
    const timer = window.setTimeout(resetPollBackoff, 0);
    return () => window.clearTimeout(timer);
  }, [pollPaused, resetPollBackoff]);

  const selectOperation = useCallback(
    (operationId: string) => {
      resetPollBackoff();
      setSelectedOperationId(operationId);
    },
    [resetPollBackoff],
  );

  const refreshAfterOperation = useCallback(
    async (operationId: string, detail?: TenantOperationDetail) => {
      resetPollBackoff();
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
      resetPollBackoff,
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
        setMutation({ name: null, intentKey: idempotencyKey, error: normalized });
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

  const resyncFollowUpRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (resyncFollowUpRef.current !== null) {
        window.clearTimeout(resyncFollowUpRef.current);
      }
    },
    [],
  );

  const resyncOperation = useCallback(
    (operationId: string) =>
      runCommand(
        "resync",
        permissions.canResync,
        { tenantId, operationId },
        (key) => tenantProvisioningApi.resyncOperation(tenantId, operationId, key),
        async (result) => {
          await refreshAfterOperation(result.operation.id, result.operation);
          if (resyncFollowUpRef.current !== null) {
            window.clearTimeout(resyncFollowUpRef.current);
          }
          resyncFollowUpRef.current = window.setTimeout(() => {
            resyncFollowUpRef.current = null;
            void loadOperations();
            // Only while it is still the operation on screen.
            if (selectedOperationIdRef.current === result.operation.id) {
              void loadSelectedOperation(result.operation.id);
            }
          }, RESYNC_FOLLOW_UP_MS);
        },
      ),
    [
      loadOperations,
      loadSelectedOperation,
      permissions.canResync,
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
          ? readyResource(appendPage(previous.data, page))
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
          ? readyResource(appendPage(previous.data, page))
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
    selectedOperationReadAtMs,
    timeline,
    updates,
    components,
    seeds,
    prerequisites,
    mutation,
    polling,
    pollPaused,
    pollIntervalMs,
    selectOperation,
    loadMoreOperations,
    loadMoreTimeline,
    loadingMoreOperations,
    loadingMoreTimeline,
    refreshAll,
    retryOperation,
    cancelOperation,
    resyncOperation,
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
