"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { tradeGet, tradeIfMatch, tradePatch } from "../../trade-api";
import {
  canPerformTradeAction,
  TRADE_CONCURRENCY_CODES,
  TRADE_PERMISSIONS,
} from "../../trade-scope";
import { useTradeScopeRequest } from "../../useTradeScope";
import { useTradeWrite } from "../../useTradeWrite";
import {
  buildUpdateUomRequest,
  parseUomResponse,
  uomPath,
  UOM_CODE_TAKEN_CODE,
  UOM_INVALID_CODE,
  UOM_RETIRE_REFERENCED_CODE,
  type Uom,
  type UomFormValues,
} from "../uom-contract";

const ROW_RESPONSE_LIMIT_BYTES = 40_000;

/**
 * `GET /uoms/:id`.
 *
 * Two things the route table does not say. It is Gateway `BRANCH_REQUIRED`
 * like the list, so it needs the company and branch headers even though the
 * controller target is only `OPERATING_CONTEXT`. And a UOM that does not exist
 * is **422 `TRADE.CATALOG.UOM_INVALID`**, not a 404: `CatalogUomService.get`
 * throws `missingUom()`, which is an `UnprocessableEntityException`. A screen
 * that branches on 404 alone renders a retry button for a record that is gone.
 */
export function useUomDetail(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.catalogMasterManage);
  const { headers, gap } = useTradeScopeRequest("BRANCH");

  const [uom, setUom] = useState<Uom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [retireBlocked, setRetireBlocked] = useState(false);
  const [conflict, setConflict] = useState<Uom | null>(null);

  const isMalformedId = !isUUIDv7(id);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (isMalformedId || gap) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      void tradeGet(uomPath(id), {
        signal: controller.signal,
        headers,
        maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
      })
        .then((result) => {
          if (!controller.signal.aborted) setUom(parseUomResponse(result.data));
        })
        .catch((thrown: unknown) => {
          if (controller.signal.aborted) return;
          setUom(null);
          setError(normalizeApiError(thrown));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [id, headers, gap, isMalformedId, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const describe = useCallback(
    (err: NormalizedApiError): string | undefined => {
      if (err.code === UOM_CODE_TAKEN_CODE) return t.trade.uomCodeTaken;
      if (err.code === UOM_RETIRE_REFERENCED_CODE) return t.trade.uomRetireReferenced;
      if (err.code === UOM_INVALID_CODE) return t.trade.uomInvalid;
      return undefined;
    },
    [t],
  );

  const isStale = useCallback(
    (err: NormalizedApiError) => err.code === TRADE_CONCURRENCY_CODES.staleVersion,
    [],
  );

  const openConflict = useCallback(async () => {
    try {
      const result = await tradeGet(uomPath(id), {
        headers,
        maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
      });
      setConflict(parseUomResponse(result.data));
    } catch {
      setConflict(null);
    }
  }, [id, headers]);

  const update = useCallback(
    async (values: UomFormValues): Promise<boolean> => {
      if (!canManage || !uom || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildUpdateUomRequest(uom, values);
        if (Object.keys(request).length === 0) {
          setEditOpen(false);
          return true;
        }
        const outcome = await runWrite(
          () =>
            tradePatch(uomPath(uom.id), request, {
              headers: { "if-match": tradeIfMatch(uom.version) },
            }),
          {
            failureTitle: t.trade.uomUpdateFailed,
            describe,
            isHandled: (err) => isStale(err) || err.code === UOM_RETIRE_REFERENCED_CODE,
          },
        );
        if (!outcome.ok) {
          if (outcome.error && isStale(outcome.error)) {
            await openConflict();
          } else if (outcome.error?.code === UOM_RETIRE_REFERENCED_CODE) {
            setRetireBlocked(true);
          }
          return false;
        }
        setEditOpen(false);
        toast.success(
          t.trade.savedTitle,
          outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
        );
        reload();
        return true;
      } catch {
        setFormError(t.trade.uomUpdateFailed);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, uom, isSubmitting, runWrite, describe, isStale, openConflict, toast, t, reload],
  );

  const retire = useCallback(async (): Promise<void> => {
    if (!canManage || !uom || isSubmitting) return;
    setIsSubmitting(true);
    const outcome = await runWrite(
      () =>
        tradePatch(
          uomPath(uom.id),
          { status: "RETIRED" },
          { headers: { "if-match": tradeIfMatch(uom.version) } },
        ),
      {
        failureTitle: t.trade.uomRetireFailed,
        describe,
        isHandled: (err) => isStale(err) || err.code === UOM_RETIRE_REFERENCED_CODE,
      },
    );
    setIsSubmitting(false);
    setRetireOpen(false);
    if (!outcome.ok) {
      if (outcome.error && isStale(outcome.error)) {
        await openConflict();
      } else if (outcome.error?.code === UOM_RETIRE_REFERENCED_CODE) {
        setRetireBlocked(true);
      }
      return;
    }
    toast.success(
      t.trade.uomRetireSuccess,
      outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
    );
    reload();
  }, [canManage, uom, isSubmitting, runWrite, describe, isStale, openConflict, toast, t, reload]);

  const reactivate = useCallback(async (): Promise<void> => {
    if (!canManage || !uom || isSubmitting) return;
    setIsSubmitting(true);
    const outcome = await runWrite(
      () =>
        tradePatch(
          uomPath(uom.id),
          { status: "ACTIVE" },
          { headers: { "if-match": tradeIfMatch(uom.version) } },
        ),
      {
        failureTitle: t.trade.uomUpdateFailed,
        describe,
        isHandled: isStale,
      },
    );
    setIsSubmitting(false);
    setReactivateOpen(false);
    if (!outcome.ok) {
      if (outcome.error && isStale(outcome.error)) {
        await openConflict();
      }
      return;
    }
    toast.success(
      t.trade.uomReactivateSuccess,
      outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
    );
    reload();
  }, [canManage, uom, isSubmitting, runWrite, describe, isStale, openConflict, toast, t, reload]);

  const isGone =
    isMalformedId ||
    error?.status === 404 ||
    (error?.status === 422 && error.code === UOM_INVALID_CODE);

  return {
    t,
    lang,
    uom,
    canManage,
    isLoading,
    isSubmitting,
    error,
    formError,
    isGone,
    scopeGap: gap,
    editOpen,
    retireOpen,
    reactivateOpen,
    retireBlocked,
    conflict,
    openEdit: () => {
      setFormError(null);
      setEditOpen(true);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setFormError(null);
      setEditOpen(false);
    },
    openRetire: () => setRetireOpen(true),
    closeRetire: () => {
      if (isSubmitting) return;
      setRetireOpen(false);
    },
    openReactivate: () => setReactivateOpen(true),
    closeReactivate: () => {
      if (isSubmitting) return;
      setReactivateOpen(false);
    },
    dismissRetireBlocked: () => setRetireBlocked(false),
    dismissConflict: () => setConflict(null),
    resolveConflict: () => {
      setConflict(null);
      setEditOpen(false);
      reload();
    },
    update,
    retire,
    reactivate,
    reload,
  };
}
