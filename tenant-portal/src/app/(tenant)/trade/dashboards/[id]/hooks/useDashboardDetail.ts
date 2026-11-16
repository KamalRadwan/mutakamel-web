"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeBranchSelection } from "../../../trade-advanced-scope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { can } from "@/lib/auth/permission-scope";
import { tradeDelete, tradeGet, tradeIfMatch, tradePatch, tradePost } from "../../../trade-api";
import { useTradeScope } from "../../../trade-advanced-scope";
import {
  DASHBOARDS_SHARE_TARGETS_PATH,
  analyticsFormMessage,
  analyticsMessage,
  dashboardActionPath,
  dashboardPath,
  dashboardPlacementPath,
  dashboardSharePath,
  dashboardSharesBulkPath,
  isDashboardPermissionRefusal,
  parseDashboardDetail,
  parseDashboardRunResult,
  parseShareTargets,
  parseShares,
  shareTargetsPath,
  type DashboardDetail,
  type DashboardRunResult,
  type ShareRecord,
  type ShareTarget,
} from "../../analytics-contract";
import {
  buildBulkSharesRequest,
  buildLayoutRequest,
  buildPlacementRequest,
  buildRunRequest,
  type ShareChangeInput,
} from "../../analytics-requests";

const DETAIL_RESPONSE_LIMIT_BYTES = 1_000_000;
const RUN_RESPONSE_LIMIT_BYTES = 4_000_000;

type PendingAction = "run" | "layout" | "place" | "share" | "unplace" | null;

export function useDashboardDetail(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchId } = useTradeBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);

  const [dashboard, setDashboard] = useState<DashboardDetail | null>(null);
  const [run, setRun] = useState<DashboardRunResult | null>(null);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [shareTargets, setShareTargets] = useState<ShareTarget[]>([]);
  const [sharesUnavailable, setSharesUnavailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const loadController = useRef<AbortController | null>(null);
  const runController = useRef<AbortController | null>(null);
  const loadEpoch = useRef(0);
  const runEpoch = useRef(0);

  // Mirrors assertAnyPermission: a supplied company must match the grant;
  // without one, any accessible grant scope is sufficient.
  const permissionTarget = scope.headers[COMPANY_SCOPE_HEADER]
    ? { companyId: scope.headers[COMPANY_SCOPE_HEADER] }
    : {};
  const canEdit = (dashboard?.accessLevel === "OWNER" || dashboard?.accessLevel === "EDIT") &&
    (user?.isTenantOwner === true || can(user, "trade.dashboards.update", permissionTarget));
  const canShare = dashboard?.accessLevel === "OWNER" &&
    (user?.isTenantOwner === true || can(user, "trade.dashboards.share", permissionTarget));

  const load = useCallback(
    async ({ reset }: { reset: boolean }): Promise<void> => {
      loadController.current?.abort();
      runController.current?.abort();
      runEpoch.current++;
      const controller = new AbortController();
      loadController.current = controller;
      const { signal } = controller;
      const epoch = ++loadEpoch.current;
      if (reset) {
        setDashboard(null);
        setRun(null);
        setShares([]);
        setShareTargets([]);
        setSharesUnavailable(false);
        setPending(null);
        setActionError(null);
        setIsLoading(true);
        setQueryError(null);
      }
      const [detailResult, sharesResult, targetsResult] = await Promise.allSettled([
        tradeGet(dashboardPath(id), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        }),
        tradeGet(dashboardActionPath(id, "shares"), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        }),
        // Behind `trade.dashboards.share`, which the reader may not hold.
        tradeGet(shareTargetsPath(DASHBOARDS_SHARE_TARGETS_PATH, ""), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        }),
      ]);

      if (signal.aborted || epoch !== loadEpoch.current) return;

      if (targetsResult.status === "fulfilled") {
        try {
          setShareTargets(parseShareTargets(targetsResult.value.data));
        } catch {
          setShareTargets([]);
        }
      }

      if (detailResult.status === "fulfilled") {
        try {
          setDashboard(parseDashboardDetail(detailResult.value.data));
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
        // Sharing needs its own grant; losing this panel is normal and must
        // not blank the dashboard.
        setSharesUnavailable(true);
      }

      if (!signal?.aborted) setIsLoading(false);
    },
    [id, scope.headers],
  );

  useEffect(() => {
    const loadLifetime = loadEpoch;
    const runLifetime = runEpoch;
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void load({ reset: true });
    });
    return () => {
      disposed = true;
      loadController.current?.abort();
      runController.current?.abort();
      loadLifetime.current++;
      runLifetime.current++;
    };
  }, [load]);

  const act = useCallback(
    async (action: PendingAction, call: () => Promise<unknown>, refresh = true): Promise<void> => {
      if (pending) return;
      if (action === "share" ? !canShare : !canEdit) return;
      const epoch = loadEpoch.current;
      setPending(action);
      setActionError(null);
      let succeeded = false;
      try {
        await call();
        succeeded = true;
      } catch (error) {
        if (epoch !== loadEpoch.current) return;
        const normalized = normalizeApiError(error);
        if (!toast.outcomeFromApi(normalized)) {
          setActionError(analyticsMessage(normalized, t) ?? analyticsFormMessage(error, t));
        }
      } finally {
        if (epoch === loadEpoch.current) {
          setPending(null);
          if (refresh && succeeded) await load({ reset: false });
        }
      }
    },
    [pending, canEdit, canShare, toast, t, load],
  );

  const execute = useCallback(async (): Promise<void> => {
    if (pending) return;
    runController.current?.abort();
    const controller = new AbortController();
    runController.current = controller;
    const epoch = ++runEpoch.current;
    setPending("run");
    setActionError(null);
    try {
      const response = await tradePost(dashboardActionPath(id, "run"), buildRunRequest(), {
        signal: controller.signal,
        headers: scope.headers,
        maxResponseBytes: RUN_RESPONSE_LIMIT_BYTES,
      });
      if (controller.signal.aborted || epoch !== runEpoch.current) return;
      // A run that fails comes back **200 with a FAILED tile**, so the request
      // status alone proves nothing about the widgets.
      setRun(parseDashboardRunResult(response.data));
    } catch (error) {
      if (controller.signal.aborted || epoch !== runEpoch.current || isAbortError(error)) return;
      const normalized = normalizeApiError(error);
      if (!toast.outcomeFromApi(normalized)) {
        setActionError(analyticsMessage(normalized, t) ?? analyticsFormMessage(error, t));
      }
    } finally {
      if (epoch === runEpoch.current) setPending(null);
    }
  }, [pending, id, scope.headers, toast, t]);

  const ifMatch = () => ({
    ...scope.headers,
    "If-Match": tradeIfMatch(dashboard?.revision ?? 0),
  });

  return {
    t,
    lang,
    dashboard,
    canEdit,
    canShare,
    run,
    shares,
    shareTargets,
    sharesUnavailable,
    isLoading,
    queryError,
    isNotFound: queryError?.status === 404,
    isPermissionRefusal: queryError !== null && isDashboardPermissionRefusal(queryError),
    pending,
    actionError,
    execute,
    saveLayout: (placements: DashboardDetail["placements"]) =>
      act("layout", () =>
        tradePatch(dashboardActionPath(id, "layout"), buildLayoutRequest(placements), {
          headers: ifMatch(),
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        }),
      ),
    // A placement POST takes an idempotency key but NO If-Match: the Gateway
    // marks these routes non-idempotent, and the app requires the key itself.
    addPlacement: (widgetId: string) =>
      act("place", () =>
        tradePost(dashboardActionPath(id, "placements"), buildPlacementRequest(widgetId), {
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        }),
      ),
    removePlacement: (placementId: string) =>
      act("unplace", () =>
        tradeDelete(dashboardPlacementPath(id, placementId), {
          headers: ifMatch(),
          maxResponseBytes: 10_000,
        }),
      ),
    upsertShares: (changes: readonly ShareChangeInput[]) =>
      act("share", () =>
        tradePost(
          dashboardSharesBulkPath(id),
          // `resourceRevision` is a third concurrency token, in the body —
          // this route carries no If-Match at all.
          buildBulkSharesRequest(dashboard?.revision ?? 0, changes),
          { headers: scope.headers, maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES },
        ),
      ),
    removeShare: (shareId: string) =>
      act("share", () =>
        tradeDelete(dashboardSharePath(id, shareId), {
          headers: ifMatch(),
          maxResponseBytes: 10_000,
        }),
      ),
    reload: () => load({ reset: true }),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
