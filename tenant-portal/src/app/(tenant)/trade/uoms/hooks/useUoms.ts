"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import { canPerformTradeAction, TRADE_CONCURRENCY_CODES, TRADE_PERMISSIONS } from "../../trade-scope";
import { useTradeScopeRequest } from "../../useTradeScope";
import { useTradeWrite } from "../../useTradeWrite";
import {
  buildCreateUomRequest,
  buildUpdateUomRequest,
  parseUomResponse,
  parseUomsResponse,
  UOMS_PATH,
  UOM_CODE_TAKEN_CODE,
  UOM_INVALID_CODE,
  UOM_PAGE_SIZE,
  UOM_RETIRE_REFERENCED_CODE,
  uomPath,
  uomsListPath,
  type Uom,
  type UomFormValues,
  type UomStatus,
} from "../uom-contract";

const LIST_RESPONSE_LIMIT_BYTES = 400_000;
const ROW_RESPONSE_LIMIT_BYTES = 40_000;

/**
 * `GET /uoms` is Gateway `BRANCH_REQUIRED`: the company **and** branch headers
 * must both be present or the edge answers 400 `GW.REQUEST.INVALID` before
 * trade-app runs. The controller target is only `OPERATING_CONTEXT`, so the
 * stricter of the two policies is what the screen has to satisfy.
 */
const READ_TARGET = "BRANCH" as const;

export function useUoms() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.catalogMasterManage);
  const { headers: readHeaders, gap } = useTradeScopeRequest(READ_TARGET);

  const [items, setItems] = useState<Uom[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<UomStatus | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Uom | null>(null);
  const [retiring, setRetiring] = useState<Uom | null>(null);
  const [conflict, setConflict] = useState<Uom | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      // The scope is not a filter here — without both headers the request
      // cannot legally be made, so the screen asks instead of firing a 400.
      if (gap) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const result = await tradeGet(uomsListPath(page, statusFilter, search.trim()), {
          signal,
          headers: readHeaders,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        const parsed = parseUomsResponse(result.data);
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
    [gap, page, statusFilter, search, readHeaders],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const describe = useCallback(
    (error: NormalizedApiError): string | undefined => {
      if (error.code === UOM_CODE_TAKEN_CODE) return t.trade.uomCodeTaken;
      if (error.code === UOM_RETIRE_REFERENCED_CODE) return t.trade.uomRetireReferenced;
      if (error.code === UOM_INVALID_CODE) return t.trade.uomInvalid;
      return undefined;
    },
    [t],
  );

  const isStale = useCallback(
    (error: NormalizedApiError) => error.code === TRADE_CONCURRENCY_CODES.staleVersion,
    [],
  );

  /** Refetches the row so `ConflictDialog` can show both values, not just ours. */
  const openConflict = useCallback(async (id: string): Promise<void> => {
    try {
      const result = await tradeGet(uomPath(id), { maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES });
      setConflict(parseUomResponse(result.data));
    } catch {
      // A refetch that also fails leaves the dialog with our side only; the
      // reload action still works and is the honest way out.
      setConflict(null);
    }
  }, []);

  const create = useCallback(
    async (values: UomFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildCreateUomRequest(values);
        // **No scope headers.** `POST /uoms` is Gateway `organizationScopeMode:
        // NONE`; a company header here is a 400 at the edge.
        const outcome = await runWrite(() => tradePost(UOMS_PATH, request, {}), {
          failureTitle: t.trade.uomCreateFailed,
          describe,
        });
        if (!outcome.ok) return false;
        setCreateOpen(false);
        toast.success(t.trade.savedTitle, replayMessage(outcome.replayed, t));
        await load();
        return true;
      } catch (error) {
        setFormError(formMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, runWrite, describe, toast, t, load],
  );

  const update = useCallback(
    async (values: UomFormValues): Promise<boolean> => {
      if (!canManage || !editing || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildUpdateUomRequest(editing, values);
        if (Object.keys(request).length === 0) {
          setEditing(null);
          return true;
        }
        const outcome = await runWrite(
          () =>
            tradePatch(uomPath(editing.id), request, {
              headers: { "if-match": tradeIfMatch(editing.version) },
            }),
          { failureTitle: t.trade.uomUpdateFailed, describe, isHandled: isStale },
        );
        if (!outcome.ok) {
          if (outcome.error && isStale(outcome.error)) await openConflict(editing.id);
          return false;
        }
        setEditing(null);
        toast.success(t.trade.savedTitle, replayMessage(outcome.replayed, t));
        await load();
        return true;
      } catch (error) {
        setFormError(formMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, editing, isSubmitting, runWrite, describe, isStale, openConflict, toast, t, load],
  );

  /** Retiring is a `PATCH` of `status`; trade-app publishes no retire route. */
  const retire = useCallback(async (): Promise<void> => {
    if (!canManage || !retiring || isSubmitting) return;
    setIsSubmitting(true);
    const outcome = await runWrite(
      () =>
        tradePatch(
          uomPath(retiring.id),
          { status: "RETIRED" },
          { headers: { "if-match": tradeIfMatch(retiring.version) } },
        ),
      { failureTitle: t.trade.uomRetireFailed, describe, isHandled: isStale },
    );
    setIsSubmitting(false);
    if (!outcome.ok && outcome.error && isStale(outcome.error)) await openConflict(retiring.id);
    setRetiring(null);
    if (outcome.ok) toast.success(t.trade.savedTitle, replayMessage(outcome.replayed, t));
    await load();
  }, [canManage, retiring, isSubmitting, runWrite, describe, isStale, openConflict, toast, t, load]);

  return {
    t,
    lang,
    canManage,
    scopeGap: gap,
    items,
    pageInfo: { page, limit: UOM_PAGE_SIZE, total },
    statusFilter,
    search,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isSubmitting,
    queryError,
    formError,
    createOpen,
    editing,
    retiring,
    conflict,
    setPage,
    setStatusFilter: (next: UomStatus | undefined) => {
      setPage(1);
      setStatusFilter(next);
    },
    setSearch: (next: string) => {
      setPage(1);
      setSearch(next);
    },
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setFormError(null);
      setCreateOpen(false);
    },
    openEdit: (uom: Uom) => {
      setFormError(null);
      setEditing(uom);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setFormError(null);
      setEditing(null);
    },
    openRetire: (uom: Uom) => setRetiring(uom),
    closeRetire: () => {
      if (isSubmitting) return;
      setRetiring(null);
    },
    dismissConflict: () => setConflict(null),
    resolveConflict: () => {
      setConflict(null);
      setEditing(null);
      void load();
    },
    create,
    update,
    retire,
    reload: () => load(),
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

/**
 * A replay is a **success**: Trade sets `Idempotency-Replayed` on every
 * idempotent result, with `"false"` on first execution, so `=== "true"` means
 * the write already ran once and this is its stored result.
 */
function replayMessage(replayed: boolean, t: Dictionary): string {
  return replayed ? t.trade.replayedDescription : t.trade.savedDescription;
}

function formMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "UOM_FORM_CODE") return t.trade.uomFormCode;
  if (reason === "UOM_FORM_DISPLAY_NAME") return t.trade.uomFormDisplayName;
  if (reason === "UOM_FORM_NAMES") return t.trade.uomFormNames;
  if (reason === "UOM_FORM_EVIDENCE") return t.trade.uomFormEvidence;
  return t.trade.uomCreateFailed;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
