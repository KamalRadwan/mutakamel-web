"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { generateUUIDv7 } from "@/lib/uuid";
import { tradeGet, tradeIfMatch, tradePatch } from "../../trade-api";
import { canPerformTradeAction, TRADE_CONCURRENCY_CODES } from "../../trade-scope";
import { useTradeScopeRequest } from "../../useTradeScope";
import { useTradeWrite } from "../../useTradeWrite";
import {
  buildStandardCostRequest,
  itemStandardCostPath,
  parseStandardCostResponse,
  STANDARD_COST_MANAGE_PERMISSION,
  STANDARD_COST_VIEW_PERMISSION,
  type ItemStandardCost,
} from "../item-standard-cost-contract";

const RESPONSE_LIMIT_BYTES = 100_000;

export function useItemStandardCost(itemId: string, enabled: boolean) {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const toast = useToast();
  const write = useTradeWrite();
  const company = useTradeScopeRequest("COMPANY");
  const companyId = company.headers[COMPANY_SCOPE_HEADER] ?? "";
  const canView = canPerformTradeAction(user, STANDARD_COST_VIEW_PERMISSION);
  const canManage = canPerformTradeAction(user, STANDARD_COST_MANAGE_PERMISSION);
  const [cost, setCost] = useState<ItemStandardCost | null>(null);
  const [loadedCompanyId, setLoadedCompanyId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !canView || company.gap) return undefined;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setError(null);
      setIsDenied(false);
      void tradeGet(itemStandardCostPath(itemId), {
        signal: controller.signal,
        headers: company.headers,
        maxResponseBytes: RESPONSE_LIMIT_BYTES,
      })
        .then((result) => {
          if (!controller.signal.aborted) {
            setCost(parseStandardCostResponse(result.data));
            setLoadedCompanyId(companyId);
          }
        })
        .catch((thrown: unknown) => {
          if (controller.signal.aborted) return;
          const normalized = normalizeApiError(thrown);
          setCost(null);
          if (normalized.status === 403) setIsDenied(true);
          else setError(normalized);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [attempt, canView, company.gap, company.headers, companyId, enabled, itemId]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);
  const visibleCost = loadedCompanyId === companyId ? cost : null;
  const save = useCallback(async (raw: string): Promise<boolean> => {
    if (!visibleCost || !canManage || company.gap || isSubmitting) return false;
    setFormError(null);
    setIsSubmitting(true);
    try {
      const request = buildStandardCostRequest(raw, visibleCost.currencyCode);
      const outcome = await write(
        () => tradePatch(itemStandardCostPath(itemId), request, {
          headers: {
            ...company.headers,
            "if-match": tradeIfMatch(visibleCost.version),
            "x-idempotency-key": generateUUIDv7(),
          },
          maxResponseBytes: RESPONSE_LIMIT_BYTES,
        }),
        { failureTitle: t.trade.itemStandardCostSaveFailed },
      );
      if (!outcome.ok) {
        if (outcome.error?.code === TRADE_CONCURRENCY_CODES.staleVersion) reload();
        return false;
      }
      setOpen(false);
      toast.success(t.trade.savedTitle, outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription);
      reload();
      return true;
    } catch (thrown) {
      const reason = thrown instanceof Error ? thrown.message : "";
      setFormError(
        reason === "STANDARD_COST_CURRENCY_REQUIRED"
          ? t.trade.itemStandardCostCurrencyRequired
          : t.trade.itemStandardCostInvalid,
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [canManage, company, isSubmitting, itemId, reload, t, toast, visibleCost, write]);

  return {
    cost: visibleCost,
    canView: canView && !isDenied,
    canManage,
    scopeGap: company.gap,
    isLoading,
    isSubmitting,
    error,
    formError,
    open,
    openEditor: () => {
      setFormError(null);
      setOpen(true);
    },
    closeEditor: () => {
      if (!isSubmitting) setOpen(false);
    },
    reload,
    save,
  };
}
