"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeBranchSelection } from "../../../trade-advanced-scope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch, tradePost } from "../../../trade-api";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import {
  POLICY_PUBLISH_PERMISSION,
  PRICING_MANAGE_PERMISSION,
  PRICING_READ_PERMISSION,
  parsePriceBookVersionDetail,
  parsePriceBookVersionTestReport,
  priceBookVersionActionPath,
  priceBookVersionPath,
  type PriceBookVersionDetail,
  type PriceBookVersionTestReport,
} from "../../../price-books/pricing-contract";
import {
  pricingFormMessage,
  pricingMessage,
} from "../../../price-books/pricing-messages";

/** A version carries up to 10 000 entries and 500 promotions. */
const VERSION_RESPONSE_LIMIT_BYTES = 4_000_000;

export function usePriceBookVersion(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchId } = useTradeBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);

  const [detail, setDetail] = useState<PriceBookVersionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [pending, setPending] = useState<"test" | "publish" | null>(null);
  const [replacement, setReplacement] = useState({ versionId: id, predecessorId: "" });
  const supersedesVersionId = replacement.versionId === id ? replacement.predecessorId : "";
  const [testResult, setTestResult] = useState<{
    versionId: string;
    report: PriceBookVersionTestReport;
  } | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    PRICING_READ_PERMISSION,
  );
  const canTest = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    PRICING_MANAGE_PERMISSION,
  );
  // Publishing a price-book version is behind a Policy Studio grant, not
  // `trade.pricing.manage` — a pricing manager cannot publish on its own.
  const hasPublishPermission = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    POLICY_PUBLISH_PERMISSION,
  );
  const publishDisabledReasons: string[] = [];
  if (!hasPublishPermission) publishDisabledReasons.push(t.tradePricing.publishPermissionRequired);
  if (detail?.version.status !== "TESTED") publishDisabledReasons.push(t.tradePricing.publishTestedRequired);
  if (!detail?.latestTestEvidence?.passed) publishDisabledReasons.push(t.tradePricing.publishEvidenceRequired);
  if (!user?.id || !detail?.version.createdByUserId) {
    publishDisabledReasons.push(t.tradePricing.publishIdentityRequired);
  } else if (detail.version.createdByUserId === user.id) {
    publishDisabledReasons.push(t.tradePricing.publishCheckerRequired);
  }
  if (!scope.isResolved || isLoading || queryError || detail?.version.id !== id) {
    publishDisabledReasons.push(t.tradePricing.publishRefreshRequired);
  }
  if (pending !== null) publishDisabledReasons.push(t.tradePricing.publishActionPending);
  const canPublish = publishDisabledReasons.length === 0;

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!scope.isResolved) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await tradeGet(priceBookVersionPath(id), {
          signal,
          headers: scope.headers,
          maxResponseBytes: VERSION_RESPONSE_LIMIT_BYTES,
        });
        setDetail(parsePriceBookVersionDetail(response.data));
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [id, scope.isResolved, scope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const run = useCallback(
    async (action: "test" | "publish"): Promise<void> => {
      if (!detail || pending) return;
      if (action === "publish" && !canPublish) return;
      setPending(action);
      if (action === "test") setTestResult(null);
      try {
        const body = action === "publish" && supersedesVersionId.trim()
          ? { supersedesVersionId: supersedesVersionId.trim() } : undefined;
        const response = await tradePost(priceBookVersionActionPath(detail.version.id, action), body, {
          headers: {
            ...scope.headers,
            "If-Match": tradeIfMatch(detail.version.version),
          },
          maxResponseBytes: action === "test" ? VERSION_RESPONSE_LIMIT_BYTES : 200_000,
        });
        if (action === "test") {
          const report = parsePriceBookVersionTestReport(response.data);
          setTestResult({ versionId: detail.version.id, report });
          if (report.passed) {
            toast.success(t.tradeCommon.savedTitle, t.tradePricing.testPassed);
          } else {
            toast.error(t.tradePricing.testFailedTitle, t.tradePricing.errorTestFailed);
          }
        } else {
          toast.success(t.tradeCommon.savedTitle, t.tradePricing.versionPublished);
        }
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.error(
            action === "test" ? t.tradePricing.testFailedTitle : t.tradePricing.publishFailedTitle,
            pricingMessage(normalized, t) ?? pricingFormMessage(error, t),
          );
        }
      } finally {
        setPending(null);
        await load();
      }
    },
    [detail, pending, canPublish, supersedesVersionId, scope.headers, toast, t, load],
  );

  return {
    t,
    lang,
    canRead,
    canTest,
    canPublish,
    supersedesVersionId,
    setSupersedesVersionId: (predecessorId: string) => setReplacement({ versionId: id, predecessorId }),
    publishDisabledReasons,
    detail,
    isLoading,
    queryError,
    isNotFound: queryError?.status === 404,
    pending,
    testReport: testResult?.versionId === id ? testResult.report : null,
    test: () => run("test"),
    publish: () => run("publish"),
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
