"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeGet, tradePost } from "../../trade-api";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import {
  IMPORT_EXECUTE_PERMISSION,
  IMPORT_PAGE_SIZE,
  IMPORT_PREVIEW_PATH,
  IMPORT_SOURCES_PATH,
  buildImportSourceBody,
  buildPreviewRequest,
  importFormMessage,
  importMessage,
  importRunsListPath,
  parseImportRun,
  parseImportRunsResponse,
  parseImportSourceId,
  type ImportRun,
  type ImportRunStatus,
} from "../import-contract";

const LIST_RESPONSE_LIMIT_BYTES = 600_000;
const ROW_RESPONSE_LIMIT_BYTES = 60_000;

type PendingStep = "upload" | "preview" | null;

export function useImportRuns() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  // `POST /imports/sources` is OPTIONAL_COMPANY_BRANCH at the Gateway, and a
  // branch header without a company is a 400 GW.REQUEST.INVALID at the edge —
  // this resolver never sends one without the other.
  const scope = useTradeScope("BRANCH", branchId);

  const [items, setItems] = useState<ImportRun[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ImportRunStatus | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [mappingId, setMappingId] = useState("");
  const [pending, setPending] = useState<PendingStep>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const canExecute = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    IMPORT_EXECUTE_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await tradeGet(importRunsListPath(page, status), {
          signal,
          headers: scope.headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        const parsed = parseImportRunsResponse(response.data);
        setItems(parsed.items);
        setTotal(parsed.total);
        setHasLoaded(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [page, status, scope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const fail = useCallback(
    (error: unknown): void => {
      const normalized = normalizeApiError(error);
      if (normalized.status === 403) return;
      if (toast.outcomeFromApi(normalized)) return;
      setFormError(importMessage(normalized, t) ?? importFormMessage(error, t));
    },
    [toast, t],
  );

  const uploadSource = useCallback(
    async (file: File): Promise<void> => {
      if (!canExecute || pending) return;
      setPending("upload");
      setFormError(null);
      try {
        const response = await tradePost(IMPORT_SOURCES_PATH, buildImportSourceBody(file), {
          headers: scope.headers,
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
        setSourceId(parseImportSourceId(response.data));
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradeAutomation.sourceUploaded,
        );
      } catch (error) {
        fail(error);
      } finally {
        setPending(null);
      }
    },
    [canExecute, pending, scope.headers, toast, t, fail],
  );

  const startPreview = useCallback(async (): Promise<void> => {
    if (!canExecute || pending) return;
    setPending("preview");
    setFormError(null);
    try {
      const response = await tradePost(
        IMPORT_PREVIEW_PATH,
        buildPreviewRequest(mappingId, sourceId),
        { headers: scope.headers, maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES },
      );
      // A 202 is acceptance, not completion, and no Location header is set —
      // the run id comes back in the body and the list is the only progress
      // signal.
      parseImportRun(response.data);
      toast.success(t.tradeCommon.savedTitle, t.tradeAutomation.previewQueued);
      await load();
    } catch (error) {
      fail(error);
    } finally {
      setPending(null);
    }
  }, [canExecute, pending, mappingId, sourceId, scope.headers, toast, t, load, fail]);

  return {
    t,
    lang,
    canExecute,
    branchIds,
    branchId,
    selectBranch,
    items,
    pageInfo: { page, limit: IMPORT_PAGE_SIZE, total },
    status,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    sourceId,
    mappingId,
    pending,
    formError,
    setPage,
    setStatus: (next: ImportRunStatus | undefined) => {
      setPage(1);
      setStatus(next);
    },
    setSourceId,
    setMappingId,
    uploadSource,
    startPreview,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
