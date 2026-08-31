"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { resolveCompanyForBranch } from "@/lib/api/organization-scope";
import {
  isTradeReplay,
  tradeDelete,
  tradeGet,
  tradeIfMatch,
  tradePost,
} from "../../trade-api";
import { useTradeScope } from "../../trade-advanced-scope";
import {
  DASHBOARDS_CATALOG_PATH,
  DASHBOARDS_DEFAULT_PATH,
  DASHBOARDS_NAVIGATION_PATH,
  DASHBOARDS_PATH,
  analyticsFormMessage,
  analyticsMessage,
  dashboardActionPath,
  dashboardFromTemplatePath,
  dashboardPath,
  dashboardsListPath,
  isAnalyticsBodyReplay,
  isDashboardPermissionRefusal,
  parseDashboardCatalog,
  parseDashboardDefault,
  parseDashboardListPage,
  parseDashboardNavigation,
  type DashboardCatalog,
  type DashboardListEntry,
} from "../analytics-contract";
import {
  buildCreateDashboardRequest,
  buildDuplicateRequest,
  buildFromTemplateRequest,
  buildSetDefaultRequest,
  buildSetFavoriteRequest,
} from "../analytics-requests";

const LIST_RESPONSE_LIMIT_BYTES = 800_000;
const CATALOG_RESPONSE_LIMIT_BYTES = 2_000_000;
const ROW_RESPONSE_LIMIT_BYTES = 400_000;

/**
 * Dashboards are **not** permission-gated at the guard.
 *
 * `DASHBOARD_CONTEXT` makes `TradePermissionsGuard.canActivate` return true
 * immediately, so no `canRead` is computed here and no `PermissionGate` wraps
 * the screen: doing either would imply a protection that does not exist. The
 * dashboard service authorizes each resolved company itself, and its refusals
 * arrive as `TRADE.DASHBOARD.*` codes — sometimes 403, sometimes 422.
 */
export function useDashboards() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  // DASHBOARD_CONTEXT accepts nothing at all and resolves TENANT, so the
  // headers are a narrowing, not a precondition.
  const scope = useTradeScope("COMPANY", branchId);
  const companyId = resolveCompanyForBranch(user, branchId);

  const [items, setItems] = useState<DashboardListEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [quickJump, setQuickJump] = useState<DashboardListEntry[]>([]);
  const [defaultDashboardId, setDefaultDashboardId] = useState<string | null>(null);
  const [ensureTemplateKey, setEnsureTemplateKey] = useState<string | null>(null);
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
      // Four sources, each degrading on its own: the paged list, the compact
      // switcher, the caller's default (or the template the server suggests
      // when there is none) and the metric catalogue.
      const [listResult, navigationResult, defaultResult, catalogResult] =
        await Promise.allSettled([
          tradeGet(dashboardsListPath(offset), {
            signal,
            headers: scope.headers,
            maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
          }),
          tradeGet(DASHBOARDS_NAVIGATION_PATH, {
            signal,
            headers: scope.headers,
            maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
          }),
          tradeGet(DASHBOARDS_DEFAULT_PATH, {
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

      if (navigationResult.status === "fulfilled") {
        try {
          setQuickJump(parseDashboardNavigation(navigationResult.value.data).items);
        } catch {
          setQuickJump([]);
        }
      }

      if (defaultResult.status === "fulfilled") {
        try {
          const preference = parseDashboardDefault(defaultResult.value.data);
          setDefaultDashboardId(preference.dashboardId);
          setEnsureTemplateKey(preference.ensureTemplateKey);
        } catch {
          setDefaultDashboardId(null);
          setEnsureTemplateKey(null);
        }
      }

      if (listResult.status === "fulfilled") {
        try {
          const parsed = parseDashboardListPage(listResult.value.data);
          setItems(parsed.items);
          setNextOffset(parsed.nextOffset);
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
    [offset, scope.headers],
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
    async (name: string, description: string): Promise<boolean> => {
      if (isSubmitting) return false;
      if (!companyId) {
        setFormError(t.tradeAnalytics.formScopeInvalid);
        return false;
      }
      setIsSubmitting(true);
      setFormError(null);
      try {
        const response = await tradePost(
          DASHBOARDS_PATH,
          buildCreateDashboardRequest(name, description, [{ companyId, branchIds: [] }]),
          { headers: scope.headers, maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES },
        );
        setCreateOpen(false);
        // A dashboard write reports its replay in the BODY as well as the
        // header, because the response is not unwrapped.
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers) || isAnalyticsBodyReplay(response.data)
            ? t.tradeCommon.replayedDescription
            : t.tradeAnalytics.dashboardCreated,
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
    [isSubmitting, companyId, scope.headers, toast, t, load, fail],
  );

  const runRowAction = useCallback(
    async (id: string, operation: () => Promise<unknown>, success: string): Promise<void> => {
      if (pendingId) return;
      setPendingId(id);
      setFormError(null);
      try {
        await operation();
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

  return {
    t,
    lang,
    branchIds,
    branchId,
    selectBranch,
    items,
    quickJump,
    defaultDashboardId,
    ensureTemplateKey,
    catalog,
    catalogUnavailable,
    offset,
    nextOffset,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    isPermissionRefusal: queryError !== null && isDashboardPermissionRefusal(queryError),
    createOpen,
    isSubmitting,
    formError,
    pendingId,
    nextPage: () => {
      if (nextOffset !== null) setOffset(nextOffset);
    },
    previousPage: () => setOffset((current) => Math.max(0, current - 50)),
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setCreateOpen(false);
    },
    create,
    createFromTemplate: (templateKey: string, name: string) =>
      runRowAction(
        templateKey,
        () =>
          tradePost(dashboardFromTemplatePath(templateKey), buildFromTemplateRequest(name), {
            headers: scope.headers,
            maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
          }),
        t.tradeAnalytics.dashboardCreated,
      ),
    duplicate: (dashboard: DashboardListEntry) =>
      runRowAction(
        dashboard.id,
        () =>
          tradePost(
            dashboardActionPath(dashboard.id, "duplicate"),
            buildDuplicateRequest(""),
            { headers: scope.headers, maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES },
          ),
        t.tradeAnalytics.dashboardDuplicated,
      ),
    // set-default and set-favorite are personal preferences, so they need only
    // the read grant — and both take a `context` body, not an empty POST.
    setDefault: (dashboard: DashboardListEntry) =>
      runRowAction(
        dashboard.id,
        () =>
          tradePost(
            dashboardActionPath(dashboard.id, "set-default"),
            buildSetDefaultRequest(companyId),
            { headers: scope.headers, maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES },
          ),
        t.tradeAnalytics.defaultSet,
      ),
    toggleFavorite: (dashboard: DashboardListEntry) =>
      runRowAction(
        dashboard.id,
        () =>
          tradePost(
            dashboardActionPath(dashboard.id, "set-favorite"),
            buildSetFavoriteRequest(companyId, !dashboard.isFavorite),
            { headers: scope.headers, maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES },
          ),
        t.tradeAnalytics.favoriteToggled,
      ),
    remove: (dashboard: DashboardListEntry) =>
      runRowAction(
        dashboard.id,
        () =>
          tradeDelete(dashboardPath(dashboard.id), {
            // Concurrency here is the REVISION, not a version.
            headers: { ...scope.headers, "If-Match": tradeIfMatch(dashboard.revision) },
            maxResponseBytes: 10_000,
          }),
        t.tradeAnalytics.dashboardDeleted,
      ),
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
