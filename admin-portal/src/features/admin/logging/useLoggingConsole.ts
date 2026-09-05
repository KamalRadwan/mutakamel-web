"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { adminCan, adminCanAll } from "@/lib/auth/rbac";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { loggingApi } from "./api";
import { isUuidV7, LoggingContractError } from "./readers";
import {
  buildEffectiveQuery,
  buildHistoryQuery,
  buildOverrideCommand,
  defaultExpiryLocal,
  deleteIntentFingerprint,
  isoToLocalDateTime,
  overrideIntentFingerprint,
  shouldRetainIntent,
} from "./validation";
import type {
  ContractResult,
  DirectoryFilterDraft,
  EffectiveDraft,
  EffectiveLoggingLevel,
  HistoryFilterDraft,
  LoggingHistoryQuery,
  LoggingHistoryRow,
  LoggingOverride,
  LoggingOverrideDraft,
  LoggingOverrideQuery,
  LoggingValidationErrors,
  MutationState,
  ResourceState,
  ResourceView,
  UpsertLoggingOverrideDto,
} from "./types";

interface OwnedResource<T> extends ResourceView<T> {
  ownerId: string | null;
}

type MutationIntent =
  | { kind: "UPSERT"; command: UpsertLoggingOverrideDto }
  | { kind: "DELETE"; row: LoggingOverride };

const DIRECTORY_DRAFT: DirectoryFilterDraft = {
  scope: "",
  appName: "",
  tenantId: "",
  includeExpired: false,
};
const HISTORY_DRAFT: HistoryFilterDraft = {
  overrideId: "",
  action: "",
  scope: "",
  appName: "",
  tenantId: "",
};
const INITIAL_DIRECTORY_QUERY: LoggingOverrideQuery = {
  page: 1,
  limit: 50,
  includeExpired: false,
};
const INITIAL_HISTORY_QUERY: LoggingHistoryQuery = { limit: 50 };
const INITIAL_OVERRIDE_DRAFT: LoggingOverrideDraft = {
  scope: "APP",
  appName: "core-app",
  tenantId: "",
  level: "debug",
  reason: "",
  expiresAtLocal: "",
};
const INITIAL_EFFECTIVE_DRAFT: EffectiveDraft = {
  appName: "core-app",
  tenantId: "",
};

export function useLoggingConsole() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const ownerId = user?.id ?? null;
  const canRead = adminCan(user, "admin.logging.read");
  const canUpdate = adminCanAll(user, [
    "admin.logging.update",
    "admin.logging.critical",
  ]);
  const [directoryDraft, setDirectoryDraft] =
    useState<DirectoryFilterDraft>(DIRECTORY_DRAFT);
  const [directoryQuery, setDirectoryQuery] =
    useState<LoggingOverrideQuery>(INITIAL_DIRECTORY_QUERY);
  const [directoryErrors, setDirectoryErrors] =
    useState<LoggingValidationErrors>({});
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const [directory, setDirectory] = useState<OwnedResource<LoggingOverride[]>>(
    emptyResource(),
  );

  const [historyDraft, setHistoryDraft] =
    useState<HistoryFilterDraft>(HISTORY_DRAFT);
  const [historyQuery, setHistoryQuery] =
    useState<LoggingHistoryQuery>(INITIAL_HISTORY_QUERY);
  const [historyErrors, setHistoryErrors] =
    useState<LoggingValidationErrors>({});
  const [historyRevision, setHistoryRevision] = useState(0);
  const [history, setHistory] = useState<OwnedResource<LoggingHistoryRow[]>>(
    emptyResource(),
  );

  const [effectiveDraft, setEffectiveDraft] =
    useState<EffectiveDraft>(INITIAL_EFFECTIVE_DRAFT);
  const [effectiveErrors, setEffectiveErrors] =
    useState<LoggingValidationErrors>({});
  const [effective, setEffective] =
    useState<OwnedResource<EffectiveLoggingLevel>>(emptyResource("EMPTY"));

  const [overrideDraft, setOverrideDraft] =
    useState<LoggingOverrideDraft>(INITIAL_OVERRIDE_DRAFT);
  const [overrideErrors, setOverrideErrors] =
    useState<LoggingValidationErrors>({});
  const [mutationState, setMutationState] = useState<MutationState>("IDLE");
  const [mutationError, setMutationError] =
    useState<NormalizedApiError | null>(null);
  const [mutationCorrelationId, setMutationCorrelationId] =
    useState<string | null>(null);
  const [mutationOwnerId, setMutationOwnerId] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<MutationIntent | null>(null);
  const [retryIntent, setRetryIntent] = useState<MutationIntent | null>(null);
  const intentKeys = useRef(new Map<string, string>());

  useEffect(() => {
    setOverrideDraft((current) =>
      current.expiresAtLocal
        ? current
        : { ...current, expiresAtLocal: defaultExpiryLocal() },
    );
  }, []);

  const loadDirectory = useCallback(
    async (signal?: AbortSignal): Promise<boolean> => {
      if (!canRead || isAuthLoading || !ownerId) return false;
      setDirectory((current) => ({
        ...(current.ownerId === ownerId ? current : emptyResource()),
        ownerId,
        state: "LOADING",
        isRefreshing: current.ownerId === ownerId && current.data !== null,
        error: null,
      }));
      try {
        const result = await loggingApi.list(directoryQuery, signal);
        setDirectory({
          ownerId,
          data: result.data,
          state: result.data.length ? "READY" : "EMPTY",
          error: null,
          correlationId: result.correlationId,
          timestamp: result.timestamp,
          isRefreshing: false,
        });
        return true;
      } catch (caught) {
        if (isAbortError(caught)) return false;
        const normalized = normalizeApiError(caught);
        setDirectory((current) => ({
          ...current,
          ownerId,
          state: classifyReadFailure(caught, normalized, current.data !== null),
          error: normalized,
          isRefreshing: false,
        }));
        return false;
      }
    }, [canRead, directoryQuery, isAuthLoading, ownerId]);

  const loadHistory = useCallback(
    async (signal?: AbortSignal): Promise<boolean> => {
      if (!canRead || isAuthLoading || !ownerId) return false;
      setHistory((current) => ({
        ...(current.ownerId === ownerId ? current : emptyResource()),
        ownerId,
        state: "LOADING",
        isRefreshing: current.ownerId === ownerId && current.data !== null,
        error: null,
      }));
      try {
        const result = await loggingApi.history(historyQuery, signal);
        setHistory({
          ownerId,
          data: result.data,
          state: result.data.length ? "READY" : "EMPTY",
          error: null,
          correlationId: result.correlationId,
          timestamp: result.timestamp,
          isRefreshing: false,
        });
        return true;
      } catch (caught) {
        if (isAbortError(caught)) return false;
        const normalized = normalizeApiError(caught);
        setHistory((current) => ({
          ...current,
          ownerId,
          state: classifyReadFailure(caught, normalized, current.data !== null),
          error: normalized,
          isRefreshing: false,
        }));
        return false;
      }
    }, [canRead, historyQuery, isAuthLoading, ownerId]);

  useEffect(() => {
    if (!canRead || isAuthLoading || !ownerId) return;
    const controller = new AbortController();
    queueMicrotask(() => void loadDirectory(controller.signal));
    return () => controller.abort();
  }, [canRead, directoryRevision, isAuthLoading, loadDirectory, ownerId]);

  useEffect(() => {
    if (!canRead || isAuthLoading || !ownerId) return;
    const controller = new AbortController();
    queueMicrotask(() => void loadHistory(controller.signal));
    return () => controller.abort();
  }, [canRead, historyRevision, isAuthLoading, loadHistory, ownerId]);

  const setDirectoryDraftField = useCallback(
    <K extends keyof DirectoryFilterDraft>(
      field: K,
      value: DirectoryFilterDraft[K],
    ) => {
      setDirectoryDraft((current) => ({ ...current, [field]: value }));
      setDirectoryErrors({});
    },
    [],
  );

  const applyDirectoryFilters = useCallback(() => {
    const tenantId = directoryDraft.tenantId.trim();
    if (tenantId && !isUuidV7(tenantId)) {
      setDirectoryErrors({ tenantId: "INVALID_UUID_V7" });
      return false;
    }
    setDirectoryErrors({});
    setDirectoryQuery((current) => ({
      page: 1,
      limit: current.limit,
      includeExpired: directoryDraft.includeExpired,
      ...(directoryDraft.scope ? { scope: directoryDraft.scope } : {}),
      ...(directoryDraft.appName ? { appName: directoryDraft.appName } : {}),
      ...(tenantId ? { tenantId } : {}),
    }));
    return true;
  }, [directoryDraft]);

  const resetDirectoryFilters = useCallback(() => {
    setDirectoryDraft(DIRECTORY_DRAFT);
    setDirectoryErrors({});
    setDirectoryQuery(INITIAL_DIRECTORY_QUERY);
    setDirectoryRevision((current) => current + 1);
  }, []);

  const setDirectoryPage = useCallback((page: number) => {
    if (!Number.isSafeInteger(page) || page < 1) return;
    setDirectoryQuery((current) => ({ ...current, page }));
  }, []);

  const setDirectoryLimit = useCallback((limit: number) => {
    if (![25, 50, 100].includes(limit)) return;
    setDirectoryQuery((current) => ({ ...current, page: 1, limit }));
  }, []);

  const setHistoryDraftField = useCallback(
    <K extends keyof HistoryFilterDraft>(
      field: K,
      value: HistoryFilterDraft[K],
    ) => {
      setHistoryDraft((current) => ({ ...current, [field]: value }));
      setHistoryErrors({});
    },
    [],
  );

  const applyHistoryFilters = useCallback(() => {
    const built = buildHistoryQuery(historyDraft, historyQuery.limit);
    if (!built.query) {
      setHistoryErrors(built.errors);
      return false;
    }
    setHistoryErrors({});
    setHistoryQuery(built.query);
    setHistoryRevision((current) => current + 1);
    return true;
  }, [historyDraft, historyQuery.limit]);

  const resetHistoryFilters = useCallback(() => {
    setHistoryDraft(HISTORY_DRAFT);
    setHistoryErrors({});
    setHistoryQuery(INITIAL_HISTORY_QUERY);
    setHistoryRevision((current) => current + 1);
  }, []);

  const setHistoryLimit = useCallback((limit: number) => {
    if (![25, 50, 100, 200].includes(limit)) return;
    setHistoryQuery((current) => ({ ...current, limit }));
    setHistoryRevision((current) => current + 1);
  }, []);

  /** Monotonic, so only the newest resolve may commit. */
  const effectiveGeneration = useRef(0);

  const setEffectiveDraftField = useCallback(
    <K extends keyof EffectiveDraft>(field: K, value: EffectiveDraft[K]) => {
      setEffectiveDraft((current) => ({ ...current, [field]: value }));
      setEffectiveErrors({});
      // Editing the target invalidates any resolve still in flight: its answer
      // describes the target the operator has just moved away from.
      effectiveGeneration.current += 1;
    },
    [],
  );

  const resolveEffective = useCallback(async () => {
    if (!canRead || !ownerId) return false;
    const built = buildEffectiveQuery(effectiveDraft);
    if (!built.query) {
      setEffectiveErrors(built.errors);
      return false;
    }
    setEffectiveErrors({});
    // FE-AL02. The commit had no generation and no binding to the target it
    // asked about, while the screen leaves the target inputs and Resolve
    // enabled during the request. Start a slow resolve for Core, switch to
    // Worker and resolve again, and Core's late answer replaced Worker's -
    // under a Worker label, because the panel names the result from the
    // current form.
    const generation = ++effectiveGeneration.current;
    const isCurrent = () => generation === effectiveGeneration.current;
    setEffective({ ...emptyResource(), ownerId, state: "LOADING" });
    try {
      const result = await loggingApi.effective(built.query);
      if (!isCurrent()) return false;
      setEffective({
        ownerId,
        data: result.data,
        state: "READY",
        error: null,
        correlationId: result.correlationId,
        timestamp: result.timestamp,
        isRefreshing: false,
      });
      return true;
    } catch (caught) {
      if (!isCurrent()) return false;
      const normalized = normalizeApiError(caught);
      setEffective({
        ...emptyResource(),
        ownerId,
        state: classifyReadFailure(caught, normalized, false),
        error: normalized,
      });
      return false;
    }
  }, [canRead, effectiveDraft, ownerId]);

  const clearMutationOutcome = useCallback(() => {
    if (mutationState === "SAVING" || mutationState === "DELETING") return;
    setOverrideErrors({});
    setMutationState("IDLE");
    setMutationError(null);
    setMutationCorrelationId(null);
    setMutationOwnerId(null);
    setPendingIntent(null);
    setRetryIntent(null);
    intentKeys.current.clear();
  }, [mutationState]);

  const setOverrideDraftField = useCallback(
    <K extends keyof LoggingOverrideDraft>(
      field: K,
      value: LoggingOverrideDraft[K],
    ) => {
      if (
        mutationState === "SAVING" ||
        mutationState === "DELETING" ||
        mutationState === "STALE"
      ) {
        return;
      }
      setOverrideDraft((current) => ({
        ...current,
        [field]: value,
        ...(field === "scope"
          ? {
              appName:
                value === "GLOBAL" || value === "TENANT"
                  ? ""
                  : current.appName || "core-app",
              tenantId:
                value === "GLOBAL" || value === "APP"
                  ? ""
                  : current.tenantId,
            }
          : {}),
      }));
      clearMutationOutcome();
    },
    [clearMutationOutcome, mutationState],
  );

  const editOverride = useCallback(
    (row: LoggingOverride) => {
      if (!canUpdate || mutationState === "SAVING" || mutationState === "DELETING") {
        return;
      }
      clearMutationOutcome();
      setOverrideDraft({
        scope: row.scope,
        appName: row.appName ?? "",
        tenantId: row.tenantId ?? "",
        level: row.level === "trace" ? "debug" : row.level,
        reason: row.reason ?? "",
        expiresAtLocal: row.expiresAt
          ? isoToLocalDateTime(row.expiresAt)
          : defaultExpiryLocal(),
      });
    },
    [canUpdate, clearMutationOutcome, mutationState],
  );

  const requestUpsert = useCallback(() => {
    setMutationOwnerId(ownerId);
    if (!canUpdate) {
      setMutationState("FORBIDDEN");
      return false;
    }
    const built = buildOverrideCommand(overrideDraft);
    if (!built.command) {
      setOverrideErrors(built.errors);
      setMutationState("VALIDATION");
      return false;
    }
    setOverrideErrors({});
    setMutationError(null);
    setPendingIntent({ kind: "UPSERT", command: built.command });
    setMutationState("CONFIRMING_UPSERT");
    return true;
  }, [canUpdate, overrideDraft, ownerId]);

  const requestDelete = useCallback(
    (row: LoggingOverride) => {
      setMutationOwnerId(ownerId);
      if (!canUpdate) {
        setMutationState("FORBIDDEN");
        return false;
      }
      setMutationError(null);
      setPendingIntent({ kind: "DELETE", row });
      setMutationState("CONFIRMING_DELETE");
      return true;
    },
    [canUpdate, ownerId],
  );

  const closeConfirmation = useCallback(() => {
    if (mutationState === "SAVING" || mutationState === "DELETING") return;
    setPendingIntent(null);
    setMutationState("IDLE");
  }, [mutationState]);

  const refreshAfterWrite = useCallback(() => {
    setDirectoryRevision((current) => current + 1);
    setHistoryRevision((current) => current + 1);
  }, []);

  const performMutation = useCallback(
    async (intent: MutationIntent) => {
      if (!canUpdate || !ownerId) {
        setMutationOwnerId(ownerId);
        setMutationState("FORBIDDEN");
        return;
      }
      const fingerprint = mutationFingerprint(intent);
      const idempotencyKey =
        intentKeys.current.get(fingerprint) ?? generateUUIDv7();
      intentKeys.current.set(fingerprint, idempotencyKey);
      setMutationState(intent.kind === "UPSERT" ? "SAVING" : "DELETING");
      setMutationOwnerId(ownerId);
      setMutationError(null);
      setMutationCorrelationId(null);
      try {
        let result: ContractResult<LoggingOverride> | null = null;
        let deleteCorrelationId: string | null = null;
        if (intent.kind === "UPSERT") {
          result = await loggingApi.upsert(intent.command, idempotencyKey);
        } else {
          deleteCorrelationId = await loggingApi.remove(
            intent.row.id,
            idempotencyKey,
          );
        }
        intentKeys.current.delete(fingerprint);
        setPendingIntent(null);
        setRetryIntent(null);
        setMutationCorrelationId(
          result?.correlationId ?? deleteCorrelationId ?? null,
        );
        setMutationState("SUCCESS");
        refreshAfterWrite();
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        const retain = shouldRetainIntent(normalized);
        if (!retain) intentKeys.current.delete(fingerprint);
        setPendingIntent(null);
        setRetryIntent(retain ? intent : null);
        setMutationError(normalized);
        setMutationCorrelationId(normalized.correlationId ?? null);
        setMutationState(classifyMutationFailure(normalized, retain));
        if (!retain && [404, 409].includes(normalized.httpStatus)) {
          refreshAfterWrite();
        }
      }
    },
    [canUpdate, ownerId, refreshAfterWrite],
  );

  const confirmMutation = useCallback(() => {
    if (!pendingIntent) return;
    void performMutation(pendingIntent);
  }, [pendingIntent, performMutation]);

  const retryExactMutation = useCallback(() => {
    if (!retryIntent) return;
    void performMutation(retryIntent);
  }, [performMutation, retryIntent]);

  const reconcileUnknownMutation = useCallback(async () => {
    const intent = retryIntent;
    if (!intent || !ownerId || !canRead) return;
    setMutationState("SAVING");
    setMutationOwnerId(ownerId);
    setMutationError(null);
    try {
      const target = mutationTarget(intent);
      const result = await loggingApi.list({
        page: 1,
        limit: 100,
        includeExpired: true,
        scope: target.scope,
        ...(target.appName ? { appName: target.appName } : {}),
        ...(target.tenantId ? { tenantId: target.tenantId } : {}),
      });
      const row = result.data.find(
        (candidate) =>
          candidate.scope === target.scope &&
          candidate.appName === target.appName &&
          candidate.tenantId === target.tenantId,
      );
      const confirmed =
        intent.kind === "DELETE"
          ? row === undefined
          : row !== undefined && overrideMatchesCommand(row, intent.command);
      if (confirmed) {
        intentKeys.current.delete(mutationFingerprint(intent));
        setRetryIntent(null);
        setMutationCorrelationId(result.correlationId);
        setMutationState("SUCCESS");
        refreshAfterWrite();
      } else {
        setMutationState("STALE");
        setMutationError({
          isNormalized: true,
          httpStatus: 409,
          errorCode: "LOGGING_WRITE_NOT_CONFIRMED",
          message: "Authoritative readback did not confirm this exact write.",
          correlationId: result.correlationId,
        });
      }
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      setMutationError(normalized);
      setMutationState("STALE");
    }
  }, [canRead, ownerId, refreshAfterWrite, retryIntent]);

  const directoryView = visibleResource(
    directory,
    ownerId,
    canRead,
    isAuthLoading,
  );
  const historyView = visibleResource(history, ownerId, canRead, isAuthLoading);
  const effectiveView = visibleResource(
    effective,
    ownerId,
    canRead,
    isAuthLoading,
  );
  const directoryHasNext =
    directoryView.data?.length === directoryQuery.limit;
  const activeCount = useMemo(
    () =>
      directoryView.data?.filter(
        (row) =>
          !row.expiresAt ||
          !directoryView.timestamp ||
          Date.parse(row.expiresAt) > Date.parse(directoryView.timestamp),
      ).length ?? 0,
    [directoryView.data, directoryView.timestamp],
  );
  const ownsMutation = ownerId !== null && mutationOwnerId === ownerId;
  const visibleMutationState: MutationState = ownsMutation
    ? mutationState
    : "IDLE";

  return {
    canRead,
    canUpdate,
    directory: directoryView,
    directoryDraft,
    directoryErrors,
    directoryPage: directoryQuery.page,
    directoryLimit: directoryQuery.limit,
    directoryHasNext,
    activeCount,
    setDirectoryDraftField,
    applyDirectoryFilters,
    resetDirectoryFilters,
    setDirectoryPage,
    setDirectoryLimit,
    refreshDirectory: () => setDirectoryRevision((current) => current + 1),
    history: historyView,
    historyDraft,
    historyErrors,
    historyLimit: historyQuery.limit,
    setHistoryDraftField,
    applyHistoryFilters,
    resetHistoryFilters,
    setHistoryLimit,
    refreshHistory: () => setHistoryRevision((current) => current + 1),
    effective: effectiveView,
    effectiveDraft,
    effectiveErrors,
    setEffectiveDraftField,
    resolveEffective,
    overrideDraft,
    overrideErrors,
    mutationState: visibleMutationState,
    mutationError: ownsMutation ? mutationError : null,
    mutationCorrelationId: ownsMutation ? mutationCorrelationId : null,
    pendingIntent: ownsMutation ? pendingIntent : null,
    retryIntent: ownsMutation ? retryIntent : null,
    setOverrideDraftField,
    editOverride,
    requestUpsert,
    requestDelete,
    closeConfirmation,
    confirmMutation,
    retryExactMutation,
    reconcileUnknownMutation,
    clearMutationOutcome,
  };
}

function emptyResource<T>(state: ResourceState = "LOADING"): OwnedResource<T> {
  return {
    ownerId: null,
    data: null,
    state,
    error: null,
    correlationId: null,
    timestamp: null,
    isRefreshing: false,
  };
}

function visibleResource<T>(
  resource: OwnedResource<T>,
  ownerId: string | null,
  canRead: boolean,
  isAuthLoading: boolean,
): ResourceView<T> {
  if (isAuthLoading) return { ...emptyResource<T>(), state: "LOADING" };
  if (!canRead) return { ...emptyResource<T>("FORBIDDEN") };
  if (resource.ownerId === null && resource.state === "EMPTY") {
    return resource;
  }
  if (!ownerId || resource.ownerId !== ownerId) {
    return { ...emptyResource<T>(), state: "LOADING" };
  }
  return resource;
}

function classifyReadFailure(
  original: unknown,
  error: NormalizedApiError,
  hasData: boolean,
): ResourceState {
  if (hasData) return "STALE";
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (
    original instanceof TypeError ||
    [502, 503, 504].includes(error.httpStatus) ||
    /(?:UPSTREAM|UNAVAILABLE|TIMEOUT)/u.test(error.errorCode)
  ) {
    return "UNAVAILABLE";
  }
  if (original instanceof LoggingContractError) return "ERROR";
  return "ERROR";
}

function classifyMutationFailure(
  error: NormalizedApiError,
  retained: boolean,
): MutationState {
  if (retained) return "STALE";
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus === 400 || error.httpStatus === 422) return "VALIDATION";
  if (error.httpStatus === 404 || error.httpStatus === 409) return "CONFLICT";
  if ([502, 503, 504].includes(error.httpStatus)) return "UNAVAILABLE";
  return "ERROR";
}

function mutationFingerprint(intent: MutationIntent): string {
  return intent.kind === "UPSERT"
    ? overrideIntentFingerprint(intent.command)
    : deleteIntentFingerprint(intent.row.id);
}

function mutationTarget(intent: MutationIntent): Pick<
  LoggingOverride,
  "scope" | "appName" | "tenantId"
> {
  if (intent.kind === "DELETE") return intent.row;
  return {
    scope: intent.command.scope,
    appName: intent.command.appName ?? null,
    tenantId: intent.command.tenantId ?? null,
  };
}

function overrideMatchesCommand(
  row: LoggingOverride,
  command: UpsertLoggingOverrideDto,
): boolean {
  return (
    row.scope === command.scope &&
    row.appName === (command.appName ?? null) &&
    row.tenantId === (command.tenantId ?? null) &&
    row.level === command.level &&
    row.reason === command.reason &&
    row.expiresAt === command.expiresAt
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
