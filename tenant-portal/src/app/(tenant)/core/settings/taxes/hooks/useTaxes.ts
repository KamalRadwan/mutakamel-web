"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatTemplate } from "@/lib/format/template";
import { coreDelete, coreGet, corePatch, corePost } from "../../../core-api";
import type { ActiveStatus } from "../../../core-validation";
import { companyLabel } from "../../company-options";
import { useCompanyOptions } from "../../hooks/useCompanyOptions";
import {
  COMPANY_INVALID_CODE,
  TAXES_PATH,
  TAX_CODE_TAKEN_CODE,
  TAX_PAGE_SIZE,
  buildCreateTaxRequest,
  buildUpdateTaxRequest,
  parseTaxesResponse,
  taxPath,
  taxesListPath,
  type Tax,
  type TaxFormValues,
} from "../tax-contract";

const LIST_RESPONSE_LIMIT_BYTES = 400_000;
const ROW_RESPONSE_LIMIT_BYTES = 20_000;

export function useTaxes() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("taxes.tax.manage") ?? false;
  const companies = useCompanyOptions();

  const [items, setItems] = useState<Tax[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ActiveStatus | undefined>(undefined);
  const [companyFilter, setCompanyFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Tax | null>(null);
  const [deactivating, setDeactivating] = useState<Tax | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const result = await coreGet(
          taxesListPath(page, statusFilter, companyFilter, search.trim()),
          { signal, maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES },
        );
        const parsed = parseTaxesResponse(result.data);
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
    [page, statusFilter, companyFilter, search],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const reportWriteError = useCallback(
    (error: unknown, failureTitle: string, scopeCompanyId: string | null): boolean => {
      const normalized = normalizeApiError(error);
      // The transport already toasts a 403 — a second would double-fire.
      if (normalized.status === 403) return false;
      if (toast.outcomeFromApi(normalized)) return false;
      if (normalized.code === TAX_CODE_TAKEN_CODE) {
        // A tax code is unique WITHIN its scope, so "code already exists" is
        // only meaningful once it names the scope it collided in.
        toast.error(
          failureTitle,
          formatTemplate(t.coreSettings.taxCodeTaken, {
            company: companyLabel(companies, scopeCompanyId, t.coreSettings.taxTenantWide),
          }),
        );
        return false;
      }
      if (normalized.code === COMPANY_INVALID_CODE) {
        toast.error(failureTitle, t.coreSettings.taxCompanyInvalid);
        return false;
      }
      toast.errorFromApi(failureTitle, normalized);
      return false;
    },
    [toast, t, companies],
  );

  const create = useCallback(
    async (values: TaxFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildCreateTaxRequest(values);
        await corePost(TAXES_PATH, request, { maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES });
        setCreateOpen(false);
        toast.success(t.coreSettings.savedTitle, t.coreSettings.taxCreated);
        await load();
        return true;
      } catch (error) {
        const formMessageText = formMessage(error, t);
        if (formMessageText) {
          setFormError(formMessageText);
          return false;
        }
        return reportWriteError(error, t.coreSettings.taxCreateFailed, values.companyId);
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, reportWriteError, toast, t, load],
  );

  const update = useCallback(
    async (values: TaxFormValues): Promise<boolean> => {
      if (!canManage || !editing || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildUpdateTaxRequest(editing, values);
        if (Object.keys(request).length === 0) {
          setEditing(null);
          return true;
        }
        await corePatch(taxPath(editing.id), request, {
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
        setEditing(null);
        toast.success(t.coreSettings.savedTitle, t.coreSettings.taxUpdated);
        await load();
        return true;
      } catch (error) {
        const formMessageText = formMessage(error, t);
        if (formMessageText) {
          setFormError(formMessageText);
          return false;
        }
        return reportWriteError(error, t.coreSettings.taxUpdateFailed, editing.companyId);
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, editing, isSubmitting, reportWriteError, toast, t, load],
  );

  const deactivate = useCallback(async (): Promise<void> => {
    if (!canManage || !deactivating || pendingId) return;
    setPendingId(deactivating.id);
    try {
      await coreDelete(taxPath(deactivating.id), { maxResponseBytes: 10_000 });
      toast.success(t.coreSettings.savedTitle, t.coreSettings.taxDeactivated);
    } catch (error) {
      reportWriteError(error, t.coreSettings.taxDeactivateFailed, deactivating.companyId);
    } finally {
      setPendingId(null);
      setDeactivating(null);
      await load();
    }
  }, [canManage, deactivating, pendingId, reportWriteError, toast, t, load]);

  return {
    t,
    lang,
    canManage,
    companies,
    items,
    pageInfo: { page, limit: TAX_PAGE_SIZE, total },
    statusFilter,
    companyFilter,
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
    setCompanyFilter: (next: string | undefined) => {
      setPage(1);
      setCompanyFilter(next);
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
    openEdit: (tax: Tax) => {
      setFormError(null);
      setEditing(tax);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setFormError(null);
      setEditing(null);
    },
    openDeactivate: (tax: Tax) => setDeactivating(tax),
    closeDeactivate: () => {
      if (pendingId) return;
      setDeactivating(null);
    },
    create,
    update,
    deactivate,
    reload: () => load(),
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

/** Client-side form stops, raised before any request leaves. */
function formMessage(error: unknown, t: Dictionary): string | null {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "TAX_FORM_CODE") return t.coreSettings.taxFormCode;
  if (reason === "TAX_FORM_NAME") return t.coreSettings.taxFormName;
  if (reason === "TAX_FORM_RATE") return t.coreSettings.taxFormRate;
  if (reason === "TAX_FORM_COMPANY") return t.coreSettings.taxFormCompany;
  return null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
