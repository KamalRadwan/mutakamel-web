"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeDelete, tradeGet, tradeIfMatch, tradePost } from "../../trade-api";
import { useTradeScope } from "../../trade-advanced-scope";
import {
  DASHBOARDS_CATALOG_PATH,
  WIDGETS_PATH,
  analyticsFormMessage,
  analyticsMessage,
  isAnalyticsBodyReplay,
  isDashboardPermissionRefusal,
  parseDashboardCatalog,
  parseWidgetList,
  widgetClonePath,
  widgetPath,
  type DashboardCatalog,
  type DashboardVisualizationType,
  type WidgetRecord,
} from "../../dashboards/analytics-contract";
import {
  buildCloneWidgetRequest,
  buildWidgetRequest,
  type WidgetSeriesInput,
} from "../../dashboards/analytics-requests";

const LIST_RESPONSE_LIMIT_BYTES = 4_000_000;
const CATALOG_RESPONSE_LIMIT_BYTES = 2_000_000;
const ROW_RESPONSE_LIMIT_BYTES = 400_000;

/**
 * `GET /widgets` takes **no query parameters at all**.
 *
 * The handler has no `@Query()`, so there is no pagination, no filter and no
 * search — and because the pipe runs `forbidNonWhitelisted`, adding `?limit=50`
 * is a 400. The whole set comes back in one response, bounded only by the
 * 500-per-owner server limit, so filtering here is client-side by necessity.
 */
export function useWidgets() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);

  const [items, setItems] = useState<WidgetRecord[]>([]);
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<DashboardCatalog | null>(null);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      const [listResult, catalogResult] = await Promise.allSettled([
        tradeGet(WIDGETS_PATH, {
          signal,
          headers: scope.headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        }),
        tradeGet(DASHBOARDS_CATALOG_PATH, {
          signal,
          headers: scope.headers,
          maxResponseBytes: CATALOG_RESPONSE_LIMIT_BYTES,
        }),
      ]);

      if (listResult.status === "fulfilled") {
        try {
          setItems(parseWidgetList(listResult.value.data));
          setHasLoaded(true);
        } catch (error) {
          setQueryError(normalizeApiError(error));
        }
      } else if (!isAbortError(listResult.reason)) {
        setQueryError(normalizeApiError(listResult.reason));
      }

      if (catalogResult.status === "fulfilled") {
        try {
          setCatalog(parseDashboardCatalog(catalogResult.value.data));
          setCatalogUnavailable(false);
        } catch {
          setCatalogUnavailable(true);
        }
      } else if (!isAbortError(catalogResult.reason)) {
        setCatalogUnavailable(true);
      }

      if (!signal?.aborted) setIsLoading(false);
    },
    [scope.headers],
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
      setFormError(analyticsMessage(normalized, t) ?? analyticsFormMessage(error, t));
    },
    [toast, t],
  );

  const create = useCallback(
    async (
      name: string,
      visualizationType: DashboardVisualizationType,
      series: readonly WidgetSeriesInput[],
      displayTitle: string,
    ): Promise<boolean> => {
      if (isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const response = await tradePost(
          WIDGETS_PATH,
          buildWidgetRequest(name, visualizationType, series, displayTitle),
          { headers: scope.headers, maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES },
        );
        setCreateOpen(false);
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers) || isAnalyticsBodyReplay(response.data)
            ? t.tradeCommon.replayedDescription
            : t.tradeAnalytics.widgetCreated,
        );
        await load();
        return true;
      } catch (error) {
        fail(error);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, scope.headers, toast, t, load, fail],
  );

  const rowAction = useCallback(
    async (id: string, call: () => Promise<unknown>, success: string): Promise<void> => {
      if (pendingId) return;
      setPendingId(id);
      setFormError(null);
      try {
        await call();
        toast.success(t.tradeCommon.savedTitle, success);
      } catch (error) {
        fail(error);
      } finally {
        setPendingId(null);
        await load();
      }
    },
    [pendingId, toast, t, load, fail],
  );

  const query = search.trim().toLowerCase();
  const visible =
    query.length === 0
      ? items
      : items.filter((widget) => widget.name.toLowerCase().includes(query));

  return {
    t,
    lang,
    branchIds,
    branchId,
    selectBranch,
    items: visible,
    catalog,
    catalogUnavailable,
    search,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    isPermissionRefusal: queryError !== null && isDashboardPermissionRefusal(queryError),
    createOpen,
    isSubmitting,
    formError,
    pendingId,
    setSearch,
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setCreateOpen(false);
    },
    create,
    clone: (widget: WidgetRecord) =>
      rowAction(
        widget.id,
        () =>
          tradePost(widgetClonePath(widget.id), buildCloneWidgetRequest(""), {
            headers: scope.headers,
            maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
          }),
        t.tradeAnalytics.widgetCloned,
      ),
    remove: (widget: WidgetRecord) =>
      rowAction(
        widget.id,
        () =>
          tradeDelete(widgetPath(widget.id), {
            headers: { ...scope.headers, "If-Match": tradeIfMatch(widget.revision) },
            maxResponseBytes: 10_000,
          }),
        t.tradeAnalytics.widgetDeleted,
      ),
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
