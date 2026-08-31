"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeDelete, tradeGet, tradeIfMatch, tradePost } from "../../../trade-api";
import { useTradeScope } from "../../../trade-advanced-scope";
import {
  WIDGETS_PREVIEW_PATH,
  WIDGETS_SHARE_TARGETS_PATH,
  analyticsFormMessage,
  analyticsMessage,
  isDashboardPermissionRefusal,
  parseShareTargets,
  parseShares,
  parseWidgetExecutionResult,
  parseWidgetRecord,
  shareTargetsPath,
  widgetPath,
  widgetSharePath,
  widgetSharesBulkPath,
  widgetSharesPath,
  type ShareRecord,
  type ShareTarget,
  type WidgetExecutionResult,
  type WidgetRecord,
} from "../../../dashboards/analytics-contract";
import {
  buildBulkSharesRequest,
  buildWidgetPreviewRequest,
  type ShareChangeInput,
} from "../../../dashboards/analytics-requests";

const DETAIL_RESPONSE_LIMIT_BYTES = 800_000;
const PREVIEW_RESPONSE_LIMIT_BYTES = 4_000_000;

type PendingAction = "preview" | "share" | null;

export function useWidgetDetail(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchId } = useTenantBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);

  const [widget, setWidget] = useState<WidgetRecord | null>(null);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [shareTargets, setShareTargets] = useState<ShareTarget[]>([]);
  const [sharesUnavailable, setSharesUnavailable] = useState(false);
  const [preview, setPreview] = useState<WidgetExecutionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      // Share targets are a third source behind their own grant
      // (`trade.widgets.share`), so losing them leaves the widget readable.
      const [detailResult, sharesResult, targetsResult] = await Promise.allSettled([
        tradeGet(widgetPath(id), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        }),
        tradeGet(widgetSharesPath(id), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        }),
        tradeGet(shareTargetsPath(WIDGETS_SHARE_TARGETS_PATH, ""), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        }),
      ]);

      if (targetsResult.status === "fulfilled") {
        try {
          setShareTargets(parseShareTargets(targetsResult.value.data));
        } catch {
          setShareTargets([]);
        }
      }

      if (detailResult.status === "fulfilled") {
        try {
          setWidget(parseWidgetRecord(detailResult.value.data));
        } catch (error) {
          setQueryError(normalizeApiError(error));
        }
      } else if (!isAbortError(detailResult.reason)) {
        setQueryError(normalizeApiError(detailResult.reason));
      }

      if (sharesResult.status === "fulfilled") {
        try {
          setShares(parseShares(sharesResult.value.data));
          setSharesUnavailable(false);
        } catch {
          setSharesUnavailable(true);
        }
      } else if (!isAbortError(sharesResult.reason)) {
        setSharesUnavailable(true);
      }

      if (!signal?.aborted) setIsLoading(false);
    },
    [id, scope.headers],
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
      if (toast.outcomeFromApi(normalized)) return;
      setActionError(analyticsMessage(normalized, t) ?? analyticsFormMessage(error, t));
    },
    [toast, t],
  );

  const runPreview = useCallback(async (): Promise<void> => {
    if (!widget || pending) return;
    setPending("preview");
    setActionError(null);
    try {
      const response = await tradePost(
        WIDGETS_PREVIEW_PATH,
        // A preview needs the COMPLETE widget definition plus its own
        // requestId — it is not a fragment, and the requestId is required.
        buildWidgetPreviewRequest(
          widget.name,
          widget.visualizationType as Parameters<typeof buildWidgetPreviewRequest>[1],
          widget.series.map((series) => ({
            metricKey: series.metricKey,
            label: series.label ?? "",
          })),
          widget.displayTitle ?? "",
        ),
        { headers: scope.headers, maxResponseBytes: PREVIEW_RESPONSE_LIMIT_BYTES },
      );
      const body = response.data as { result?: unknown } | null;
      setPreview(body?.result ? parseWidgetExecutionResult(body.result) : null);
    } catch (error) {
      setPreview(null);
      fail(error);
    } finally {
      setPending(null);
    }
  }, [widget, pending, scope.headers, fail]);

  const shareAction = useCallback(
    async (call: () => Promise<unknown>): Promise<void> => {
      if (pending) return;
      setPending("share");
      setActionError(null);
      try {
        await call();
      } catch (error) {
        fail(error);
      } finally {
        setPending(null);
        await load();
      }
    },
    [pending, load, fail],
  );

  return {
    t,
    lang,
    widget,
    shares,
    shareTargets,
    sharesUnavailable,
    preview,
    isLoading,
    queryError,
    isNotFound: queryError?.status === 404,
    isPermissionRefusal: queryError !== null && isDashboardPermissionRefusal(queryError),
    pending,
    actionError,
    runPreview,
    upsertShares: (changes: readonly ShareChangeInput[]) =>
      shareAction(() =>
        tradePost(
          widgetSharesBulkPath(id),
          buildBulkSharesRequest(widget?.revision ?? 0, changes),
          { headers: scope.headers, maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES },
        ),
      ),
    removeShare: (shareId: string) =>
      shareAction(() =>
        tradeDelete(widgetSharePath(id, shareId), {
          headers: { ...scope.headers, "If-Match": tradeIfMatch(widget?.revision ?? 0) },
          maxResponseBytes: 10_000,
        }),
      ),
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
