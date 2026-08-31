"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { coreDelete, coreGet, corePatch, corePost } from "../../../core-api";
import type { ActiveStatus } from "../../../core-validation";
import {
  CURRENCIES_PATH,
  CURRENCY_CODE_INVALID_CODE,
  CURRENCY_CODE_TAKEN_CODE,
  CURRENCY_DEFAULT_DELETE_CODE,
  CURRENCY_INACTIVE_DEFAULT_CODE,
  CURRENCY_IN_USE_CODE,
  CURRENCY_PAGE_SIZE,
  CURRENCY_RATE_REQUIRED_CODE,
  buildCreateCurrencyRequest,
  buildUpdateCurrencyRequest,
  currenciesListPath,
  currencyPath,
  parseCurrenciesResponse,
  setDefaultCurrencyPath,
  type Currency,
  type CurrencyFormValues,
} from "../currency-contract";

const LIST_RESPONSE_LIMIT_BYTES = 400_000;
const ROW_RESPONSE_LIMIT_BYTES = 20_000;

export function useCurrencies() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("currencies.currency.manage") ?? false;

  const [items, setItems] = useState<Currency[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ActiveStatus | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);
  const [deactivating, setDeactivating] = useState<Currency | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const result = await coreGet(currenciesListPath(page, statusFilter, search.trim()), {
          signal,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        const parsed = parseCurrenciesResponse(result.data);
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
    [page, statusFilter, search],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const runWrite = useCallback(
    async (operation: () => Promise<void>, failureTitle: string): Promise<boolean> => {
      try {
        await operation();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        // The transport already toasts a 403 — a second would double-fire.
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        const specific = currencyMessage(normalized.code, t);
        if (specific) {
          toast.error(failureTitle, specific);
          return false;
        }
        toast.errorFromApi(failureTitle, normalized);
        return false;
      }
    },
    [toast, t],
  );

  const create = useCallback(
    async (values: CurrencyFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildCreateCurrencyRequest(values);
        const saved = await runWrite(async () => {
          await corePost(CURRENCIES_PATH, request, { maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES });
        }, t.coreSettings.currencyCreateFailed);
        if (!saved) return false;
        setCreateOpen(false);
        toast.success(t.coreSettings.savedTitle, t.coreSettings.currencyCreated);
        await load();
        return true;
      } catch (error) {
        setFormError(formMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, runWrite, toast, t, load],
  );

  const update = useCallback(
    async (values: CurrencyFormValues): Promise<boolean> => {
      if (!canManage || !editing || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildUpdateCurrencyRequest(editing, values);
        if (Object.keys(request).length === 0) {
          setEditing(null);
          return true;
        }
        const saved = await runWrite(async () => {
          await corePatch(currencyPath(editing.id), request, {
            maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
          });
        }, t.coreSettings.currencyUpdateFailed);
        if (!saved) return false;
        setEditing(null);
        toast.success(t.coreSettings.savedTitle, t.coreSettings.currencyUpdated);
        await load();
        return true;
      } catch (error) {
        setFormError(formMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, editing, isSubmitting, runWrite, toast, t, load],
  );

  const setDefault = useCallback(
    async (currency: Currency): Promise<void> => {
      if (!canManage || pendingId) return;
      setPendingId(currency.id);
      const promoted = await runWrite(async () => {
        await corePost(setDefaultCurrencyPath(currency.id), undefined, {
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
      }, t.coreSettings.currencySetDefaultFailed);
      setPendingId(null);
      // Promotion and demotion happen in ONE server transaction. Clearing the
      // old default optimistically would render a tenant with zero defaults —
      // a state the server's partial-unique index makes impossible.
      if (promoted) toast.success(t.coreSettings.savedTitle, t.coreSettings.currencyDefaultSet);
      await load();
    },
    [canManage, pendingId, runWrite, toast, t, load],
  );

  const deactivate = useCallback(async (): Promise<void> => {
    if (!canManage || !deactivating || pendingId) return;
    setPendingId(deactivating.id);
    const done = await runWrite(async () => {
      await coreDelete(currencyPath(deactivating.id), { maxResponseBytes: 10_000 });
    }, t.coreSettings.currencyDeactivateFailed);
    setPendingId(null);
    setDeactivating(null);
    if (done) toast.success(t.coreSettings.savedTitle, t.coreSettings.currencyDeactivated);
    await load();
  }, [canManage, deactivating, pendingId, runWrite, toast, t, load]);

  return {
    t,
    lang,
    canManage,
    items,
    pageInfo: { page, limit: CURRENCY_PAGE_SIZE, total },
    statusFilter,
    search,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isSubmitting,
    pendingId,
    queryError,
    formError,
    createOpen,
    editing,
    deactivating,
    setPage,
    setStatusFilter: (next: ActiveStatus | undefined) => {
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
    openEdit: (currency: Currency) => {
      setFormError(null);
      setEditing(currency);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setFormError(null);
      setEditing(null);
    },
    openDeactivate: (currency: Currency) => setDeactivating(currency),
    closeDeactivate: () => {
      if (pendingId) return;
      setDeactivating(null);
    },
    create,
    update,
    setDefault,
    deactivate,
    reload: () => load(),
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

/** One message per documented rejection — never a shared "operation failed". */
function currencyMessage(code: string | undefined, t: Dictionary): string | undefined {
  switch (code) {
    case CURRENCY_CODE_TAKEN_CODE:
      return t.coreSettings.currencyCodeTaken;
    case CURRENCY_CODE_INVALID_CODE:
      return t.coreSettings.currencyCodeInvalid;
    case CURRENCY_RATE_REQUIRED_CODE:
      return t.coreSettings.currencyRateRequired;
    case CURRENCY_DEFAULT_DELETE_CODE:
      return t.coreSettings.currencyDefaultProtected;
    case CURRENCY_IN_USE_CODE:
      return t.coreSettings.currencyInUse;
    case CURRENCY_INACTIVE_DEFAULT_CODE:
      return t.coreSettings.currencyInactiveDefault;
    default:
      return undefined;
  }
}

function formMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "CURRENCY_FORM_CODE") return t.coreSettings.currencyFormCode;
  if (reason === "CURRENCY_FORM_NAME") return t.coreSettings.currencyFormName;
  if (reason === "CURRENCY_FORM_RATE") return t.coreSettings.currencyFormRate;
  if (reason === "CURRENCY_FORM_DECIMALS") return t.coreSettings.currencyFormDecimals;
  return t.coreSettings.currencyCreateFailed;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
