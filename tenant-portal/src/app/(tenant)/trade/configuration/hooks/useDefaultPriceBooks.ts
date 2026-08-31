"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { tradeDelete, tradeGet, tradeIfMatch, tradePost } from "../../trade-api";
import { canPerformTradeAction, TRADE_PERMISSIONS } from "../../trade-scope";
import { useTradeScopeRequest } from "../../useTradeScope";
import { useTradeWrite } from "../../useTradeWrite";
import {
  DEFAULT_PRICE_BOOK_INCOMPATIBLE_CODE,
  DEFAULT_PRICE_BOOK_NOT_FOUND_CODE,
  defaultPriceBookPath,
  defaultPriceBookUpsertPath,
  parseDefaultPriceBook,
  type DefaultPriceBookMapping,
  type PriceBookPurpose,
} from "../configuration-contract";

const ROW_RESPONSE_LIMIT_BYTES = 40_000;

/**
 * The three `/configuration/company-default-price-books/*` routes.
 *
 * They are under the `/configuration` prefix but live on `PricingController`,
 * are gated on the **`trade.pricing`** feature rather than `trade.policy_studio`,
 * and target `COMPANY`. MASTER-PLAN 10.19 counts them in the nine; task 12.12
 * also names them, and they are built here once.
 *
 * The upsert is the **only** route in Trade parsed by
 * `parseExpectedVersionOrCreate`, so it alone accepts `If-Match: "0"`, meaning
 * "I expect no mapping to exist yet". Every other route rejects 0 as a 400.
 */
export function useDefaultPriceBooks() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const canRead = canPerformTradeAction(user, TRADE_PERMISSIONS.configurationRead);
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.configurationManage);
  const { headers, gap } = useTradeScopeRequest("COMPANY");

  const [purpose, setPurpose] = useState<PriceBookPurpose>("SALES");
  const [currencyCode, setCurrencyCode] = useState("");
  const [priceBookId, setPriceBookId] = useState("");
  const [mapping, setMapping] = useState<DefaultPriceBookMapping | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const describe = useCallback(
    (failure: NormalizedApiError): string | undefined => {
      if (failure.code === DEFAULT_PRICE_BOOK_NOT_FOUND_CODE) return t.trade.priceBookNotFound;
      if (failure.code === DEFAULT_PRICE_BOOK_INCOMPATIBLE_CODE) {
        return t.trade.priceBookIncompatible;
      }
      return undefined;
    },
    [t],
  );

  const load = useCallback(async (): Promise<void> => {
    if (gap || !canRead) return;
    setFormError(null);
    setError(null);
    setNotFound(false);
    setIsLoading(true);
    try {
      const result = await tradeGet(defaultPriceBookPath(purpose, currencyCode.toUpperCase()), {
        headers,
        maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
      });
      const parsed = parseDefaultPriceBook(result.data);
      setMapping(parsed);
      setPriceBookId(parsed.priceBookId);
    } catch (thrown) {
      if (thrown instanceof Error && thrown.message === "PRICE_BOOK_FORM_CURRENCY") {
        setFormError(t.trade.priceBookFormCurrency);
        setIsLoading(false);
        return;
      }
      const normalized = normalizeApiError(thrown);
      setMapping(null);
      // A missing mapping is a legitimate answer, not a failure: it is what
      // `If-Match: "0"` on the upsert is for.
      if (normalized.status === 404) setNotFound(true);
      else setError(normalized);
    } finally {
      setIsLoading(false);
    }
  }, [gap, canRead, purpose, currencyCode, headers, t]);

  const save = useCallback(async (): Promise<void> => {
    if (!canManage || gap || isSubmitting) return;
    if (!isUUIDv7(priceBookId.trim())) {
      setFormError(t.trade.priceBookFormId);
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      const outcome = await runWrite(
        () =>
          tradePost(
            defaultPriceBookUpsertPath(purpose, currencyCode.toUpperCase()),
            { priceBookId: priceBookId.trim() },
            {
              headers: {
                ...headers,
                // "0" means "I expect no mapping to exist". Nothing else in
                // Trade accepts it.
                "if-match": tradeIfMatch(mapping ? mapping.version : 0),
              },
            },
          ),
        { failureTitle: t.trade.priceBookSaveFailed, describe },
      );
      if (!outcome.ok) return;
      toast.success(
        t.trade.savedTitle,
        outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
      );
      await load();
    } catch (thrown) {
      setFormError(
        thrown instanceof Error && thrown.message === "PRICE_BOOK_FORM_CURRENCY"
          ? t.trade.priceBookFormCurrency
          : t.trade.priceBookFormId,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canManage,
    gap,
    isSubmitting,
    priceBookId,
    runWrite,
    purpose,
    currencyCode,
    headers,
    mapping,
    describe,
    toast,
    t,
    load,
  ]);

  const remove = useCallback(async (): Promise<void> => {
    if (!canManage || gap || !mapping || isSubmitting) return;
    setIsSubmitting(true);
    const outcome = await runWrite(
      () =>
        tradeDelete(defaultPriceBookPath(purpose, currencyCode.toUpperCase()), {
          headers: { ...headers, "if-match": tradeIfMatch(mapping.version) },
        }),
      { failureTitle: t.trade.priceBookDeleteFailed, describe },
    );
    setIsSubmitting(false);
    setDeleteOpen(false);
    if (!outcome.ok) return;
    toast.success(
      t.trade.savedTitle,
      outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
    );
    setMapping(null);
    setNotFound(true);
  }, [canManage, gap, mapping, isSubmitting, runWrite, purpose, currencyCode, headers, describe, toast, t]);

  return {
    canRead,
    canManage,
    scopeGap: gap,
    purpose,
    currencyCode,
    priceBookId,
    mapping,
    notFound,
    isLoading,
    isSubmitting,
    error,
    formError,
    deleteOpen,
    setPurpose,
    setCurrencyCode,
    setPriceBookId,
    openDelete: () => setDeleteOpen(true),
    closeDelete: () => setDeleteOpen(false),
    load,
    save,
    remove,
  };
}
