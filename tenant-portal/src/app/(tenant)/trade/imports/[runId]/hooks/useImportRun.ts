"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch, tradePost } from "../../../trade-api";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import {
  IMPORT_EXECUTE_PERMISSION,
  IMPORT_PAGE_SIZE,
  IN_FLIGHT_RUN_STATUSES,
  importFormMessage,
  importMessage,
  importRunExecutePath,
  importRunPath,
  importRunResultsPath,
  parseImportResultsResponse,
  parseImportRun,
  type ImportResultRow,
  type ImportResultStatus,
  type ImportRun,
} from "../../import-contract";

const RUN_RESPONSE_LIMIT_BYTES = 60_000;
const RESULTS_RESPONSE_LIMIT_BYTES = 600_000;

export function useImportRun(runId: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchId } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [run, setRun] = useState<ImportRun | null>(null);
  const [rows, setRows] = useState<ImportResultRow[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);
  const [rowsUnavailable, setRowsUnavailable] = useState(false);
  const [page, setPage] = useState(1);
  const [rowStatus, setRowStatus] = useState<ImportResultStatus | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canExecute = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    IMPORT_EXECUTE_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      // Two sources: the run header and its rows. A rows failure degrades that
      // panel only — the counts on the run are still worth showing.
      const [runResult, rowsResult] = await Promise.allSettled([
        tradeGet(importRunPath(runId), {
          signal,
          headers: scope.headers,
          maxResponseBytes: RUN_RESPONSE_LIMIT_BYTES,
        }),
        tradeGet(importRunResultsPath(runId, page, rowStatus), {
          signal,
          headers: scope.headers,
          maxResponseBytes: RESULTS_RESPONSE_LIMIT_BYTES,
        }),
      ]);

      if (runResult.status === "fulfilled") {
        try {
          setRun(parseImportRun(runResult.value.data));
        } catch (error) {
          setQueryError(normalizeApiError(error));
        }
      } else if (!isAbortError(runResult.reason)) {
        setQueryError(normalizeApiError(runResult.reason));
      }

      if (rowsResult.status === "fulfilled") {
        try {
          const parsed = parseImportResultsResponse(rowsResult.value.data);
          setRows(parsed.items);
          setRowsTotal(parsed.total);
          setRowsUnavailable(false);
        } catch {
          setRowsUnavailable(true);
        }
      } else if (!isAbortError(rowsResult.reason)) {
        setRowsUnavailable(true);
      }

      if (!signal?.aborted) setIsLoading(false);
    },
    [runId, page, rowStatus, scope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const execute = useCallback(async (): Promise<void> => {
    if (!canExecute || !run || isExecuting) return;
    setIsExecuting(true);
    setActionError(null);
    try {
      await tradePost(importRunExecutePath(run.id), undefined, {
        headers: { ...scope.headers, "If-Match": tradeIfMatch(run.version) },
        maxResponseBytes: RUN_RESPONSE_LIMIT_BYTES,
      });
      // 202 with no Location and no operation resource: refreshing the run is
      // the only way to learn what happened.
      toast.success(t.tradeCommon.savedTitle, t.tradeAutomation.executeQueued);
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        setActionError(importMessage(normalized, t) ?? importFormMessage(error, t));
      }
    } finally {
      setIsExecuting(false);
      await load();
    }
  }, [canExecute, run, isExecuting, scope.headers, toast, t, load]);

  return {
    t,
    lang,
    canExecute,
    run,
    rows,
    rowsUnavailable,
    rowsPageInfo: { page, limit: IMPORT_PAGE_SIZE, total: rowsTotal },
    rowStatus,
    isLoading,
    queryError,
    isNotFound: queryError?.status === 404,
    isInFlight: run !== null && IN_FLIGHT_RUN_STATUSES.includes(run.status),
    isExecuting,
    actionError,
    setPage,
    setRowStatus: (next: ImportResultStatus | undefined) => {
      setPage(1);
      setRowStatus(next);
    },
    execute,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
