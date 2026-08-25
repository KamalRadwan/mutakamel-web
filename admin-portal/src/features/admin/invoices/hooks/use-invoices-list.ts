"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { invoicesApi } from "../api/invoices-api";
import { classifyInvoiceReadError } from "../model/invoice-errors";
import { readInvoicePermissions } from "../model/invoice-permissions";
import { buildInvoiceListQuery, validateInvoiceFilters } from "../model/invoice-validation";
import type {
  CoreSnapshot,
  InvoiceListFilterDraft,
  InvoicePage,
  InvoiceResourceState,
  InvoiceValidationErrors,
} from "../types/invoices";

const DEFAULT_FILTERS: InvoiceListFilterDraft = {
  search: "",
  tenantId: "",
  status: "",
  sortBy: "createdAt",
  sortDir: "DESC",
  limit: "20",
};

export function useInvoicesList() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const permissions = useMemo(() => readInvoicePermissions(user), [user]);
  const [draft, setDraft] = useState<InvoiceListFilterDraft>({ ...DEFAULT_FILTERS });
  const [applied, setApplied] = useState<InvoiceListFilterDraft>({ ...DEFAULT_FILTERS });
  const [validationErrors, setValidationErrors] = useState<InvoiceValidationErrors>({});
  const [page, setPage] = useState(1);
  const [state, setState] = useState<InvoiceResourceState>("LOADING");
  const [snapshot, setSnapshot] = useState<CoreSnapshot<InvoicePage> | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const hasSnapshot = useRef(false);

  useEffect(() => {
    if (isAuthLoading || !permissions.canRead) return;
    const current = ++generation.current;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted || current !== generation.current) return;
      if (hasSnapshot.current) setIsRefreshing(true);
      else setState("LOADING");
      setError(null);
    });

    void invoicesApi
      .list(buildInvoiceListQuery(applied, page), controller.signal)
      .then((next) => {
        if (controller.signal.aborted || current !== generation.current) return;
        if (next.data.totalPages > 0 && page > next.data.totalPages) {
          setPage(next.data.totalPages);
          return;
        }
        hasSnapshot.current = true;
        setSnapshot(next);
        setState(next.data.items.length ? "READY" : "EMPTY");
      })
      .catch((caught) => {
        if (controller.signal.aborted || current !== generation.current || isAbortError(caught)) return;
        const normalized = normalizeApiError(caught);
        hasSnapshot.current = false;
        setSnapshot(null);
        setError(normalized);
        setState(classifyInvoiceReadError(caught, normalized));
      })
      .finally(() => {
        if (!controller.signal.aborted && current === generation.current) {
          setIsRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [applied, isAuthLoading, page, permissions.canRead, revision]);

  const updateFilter = useCallback(
    <K extends keyof InvoiceListFilterDraft>(
      field: K,
      value: InvoiceListFilterDraft[K],
    ) => {
      setDraft((current) => ({ ...current, [field]: value }));
      setValidationErrors((current) => {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const applyFilters = useCallback(() => {
    const errors = validateInvoiceFilters(draft);
    setValidationErrors(errors);
    if (Object.keys(errors).length) return false;
    setApplied({ ...draft });
    setPage(1);
    setRevision((current) => current + 1);
    return true;
  }, [draft]);

  const submitFilters = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      applyFilters();
    },
    [applyFilters],
  );

  const clearFilters = useCallback(() => {
    setDraft({ ...DEFAULT_FILTERS });
    setApplied({ ...DEFAULT_FILTERS });
    setValidationErrors({});
    setPage(1);
    setRevision((current) => current + 1);
  }, []);

  const refresh = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  const visibleState: InvoiceResourceState = isAuthLoading
    ? "LOADING"
    : !permissions.canRead
      ? "FORBIDDEN"
      : state;

  return {
    permissions,
    draft,
    validationErrors,
    page,
    state: visibleState,
    snapshot:
      visibleState === "READY" || visibleState === "EMPTY" ? snapshot : null,
    error,
    isRefreshing,
    updateFilter,
    submitFilters,
    clearFilters,
    refresh,
    previousPage: () => setPage((current) => Math.max(1, current - 1)),
    nextPage: () => {
      if (snapshot?.data.hasNext) setPage((current) => current + 1);
    },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message === "AbortError");
}
