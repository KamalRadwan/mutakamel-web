"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  isTradeReplay,
  tradeDelete,
  tradeGet,
  tradeIfMatch,
  tradePatch,
  tradePost,
} from "../../trade-api";
import {
  COMPANY_DEFAULT_PRICE_BOOKS_LIST_PATH,
  CONFIGURATION_MANAGE_PERMISSION,
  PRICE_BOOKS_PATH,
  PRICE_BOOK_PAGE_SIZE,
  PRICING_MANAGE_PERMISSION,
  PRICING_READ_PERMISSION,
  buildClonePriceBookVersionRequest,
  buildCreatePriceBookRequest,
  buildUpdatePriceBookRequest,
  companyDefaultPriceBookPath,
  companyDefaultPriceBookUpsertPath,
  localizedBookDisplayName,
  parseCompanyDefaultPriceBook,
  parseCompanyDefaultPriceBooksList,
  parsePriceBooksResponse,
  priceBookCloneVersionPath,
  priceBookDetailPath,
  priceBooksListPath,
  recordFromCreatedBook,
  type CompanyDefaultPriceBook,
  type PriceBook,
  type PriceBookFormValues,
  type PriceBookGovernanceFilter,
  type PriceBookPurpose,
  type PriceBookStatus,
  type UpdatePriceBookInput,
} from "../pricing-contract";
import { pricingFormMessage, pricingMessage } from "../pricing-messages";

const LIST_RESPONSE_LIMIT_BYTES = 500_000;
const ROW_RESPONSE_LIMIT_BYTES = 250_000;

export type PriceBookViewMode = "board" | "cards" | "table";

function readInitialViewMode(): PriceBookViewMode {
  if (typeof window === "undefined") return "board";
  const param = new URLSearchParams(window.location.search).get("view");
  if (param === "cards" || param === "card") return "cards";
  if (param === "table") return "table";
  return "board";
}

export function usePriceBooks() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const scope = useTradeScope("COMPANY", null, { autoSelectCompany: false });

  const [items, setItems] = useState<PriceBook[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [purpose, setPurpose] = useState<PriceBookPurpose | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<PriceBookStatus | undefined>(undefined);
  const [governanceFilter, setGovernanceFilter] = useState<PriceBookGovernanceFilter | undefined>(
    undefined,
  );
  const [onlyDefaults, setOnlyDefaults] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<PriceBookViewMode>(readInitialViewMode);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [defaultMappings, setDefaultMappings] = useState<Record<string, CompanyDefaultPriceBook>>(
    {},
  );
  const [isDefaultBusy, setIsDefaultBusy] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    PRICING_READ_PERMISSION,
  );
  const canManage = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    PRICING_MANAGE_PERMISSION,
  );
  const canManageDefaults = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    CONFIGURATION_MANAGE_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!scope.isResolved) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const [booksRes, defaultsRes] = await Promise.all([
          tradeGet(
            priceBooksListPath(page, purpose, statusFilter, debouncedSearch, governanceFilter),
            {
              signal,
              headers: scope.headers,
              maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
            },
          ),
          tradeGet(COMPANY_DEFAULT_PRICE_BOOKS_LIST_PATH, {
            signal,
            headers: scope.headers,
            maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
          }).catch(() => null),
        ]);

        const parsed = parsePriceBooksResponse(booksRes.data);
        setItems(parsed.items);
        setTotal(parsed.total);
        if (defaultsRes) {
          const list = parseCompanyDefaultPriceBooksList(defaultsRes.data);
          const nextMap: Record<string, CompanyDefaultPriceBook> = {};
          for (const item of list) {
            nextMap[`${item.purpose}:${item.currencyCode}`] = item;
          }
          setDefaultMappings(nextMap);
        }
        setHasLoaded(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [scope.isResolved, scope.headers, page, purpose, statusFilter, debouncedSearch, governanceFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const isBookDefault = useCallback(
    (book: PriceBook): boolean => {
      if (book.isCompanyDefault) return true;
      const key = `${book.purpose}:${book.currencyCode}`;
      return defaultMappings[key]?.priceBookId === book.id;
    },
    [defaultMappings],
  );

  const visibleItems = useMemo(
    () => (onlyDefaults ? items.filter((b) => isBookDefault(b)) : items),
    [items, onlyDefaults, isBookDefault],
  );

  const create = useCallback(
    async (values: PriceBookFormValues): Promise<string | null> => {
      if (!canManage || isSubmitting) return null;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const response = await tradePost(PRICE_BOOKS_PATH, buildCreatePriceBookRequest(values), {
          headers: scope.headers,
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
        const created = recordFromCreatedBook(response.data);
        const createdId = created.id;
        const createdVersion = created.version;

        // Optional seed/clone step right after creating the header
        if (
          createdId &&
          (values.seedMode === "CATALOG" ||
            (values.seedMode === "CLONE" && values.sourceVersionId?.trim()))
        ) {
          const effectiveFrom =
            values.effectiveFrom && values.effectiveFrom.trim()
              ? values.effectiveFrom
              : new Date().toISOString();
          await tradePost(
            priceBookCloneVersionPath(createdId),
            buildClonePriceBookVersionRequest({
              sourceMode: values.seedMode === "CATALOG" ? "CATALOG" : "VERSION",
              sourceVersionId: values.sourceVersionId,
              effectiveFrom,
              adjustmentMode: values.adjustmentMode,
              adjustmentValue: values.adjustmentValue,
              roundingMode: values.roundingMode,
              copyPromotions: values.copyPromotions,
              notes: values.notes,
            }),
            {
              headers: {
                ...scope.headers,
                "If-Match": tradeIfMatch(createdVersion),
              },
              maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
            },
          );
        }

        // Optional company-default pin
        if (createdId && values.setAsCompanyDefault && canManageDefaults) {
          const curr = values.currencyCode.trim().toUpperCase();
          const key = `${values.purpose}:${curr}`;
          const existing = defaultMappings[key];
          await tradePost(
            companyDefaultPriceBookUpsertPath(values.purpose, curr),
            { priceBookId: createdId },
            {
              headers: {
                ...scope.headers,
                "If-Match": tradeIfMatch(existing ? existing.version : 0),
              },
              maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
            },
          ).catch(() => null);
        }

        setCreateOpen(false);
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradePricing.bookCreated,
        );
        await load();
        return createdId || "created";
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return null;
        if (toast.outcomeFromApi(normalized)) return null;
        setFormError(pricingMessage(normalized, t) ?? pricingFormMessage(error, t));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, canManageDefaults, isSubmitting, scope.headers, defaultMappings, toast, t, load],
  );

  const updateBook = useCallback(
    async (book: PriceBook, patch: UpdatePriceBookInput): Promise<boolean> => {
      if (!canManage) return false;
      if (patch.status === "INACTIVE" && isBookDefault(book)) {
        toast.error(t.trade.priceBookSaveFailed, t.tradePricing.cannotDeactivateDefault);
        return false;
      }
      try {
        await tradePatch(priceBookDetailPath(book.id), buildUpdatePriceBookRequest(patch), {
          headers: {
            ...scope.headers,
            "If-Match": tradeIfMatch(book.version),
          },
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
        toast.success(t.tradeCommon.savedTitle, t.tradePricing.bookUpdated);
        await load();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.error(
            t.trade.priceBookSaveFailed,
            pricingMessage(normalized, t) ?? pricingFormMessage(error, t),
          );
        }
        return false;
      }
    },
    [canManage, isBookDefault, scope.headers, toast, t, load],
  );

  const setBookAsCompanyDefault = useCallback(
    async (book: PriceBook): Promise<boolean> => {
      if (!canManageDefaults || isDefaultBusy) return false;
      setIsDefaultBusy(true);
      const key = `${book.purpose}:${book.currencyCode}`;
      const existing = defaultMappings[key];
      try {
        const response = await tradePost(
          companyDefaultPriceBookUpsertPath(book.purpose, book.currencyCode),
          { priceBookId: book.id },
          {
            headers: {
              ...scope.headers,
              "If-Match": tradeIfMatch(existing ? existing.version : 0),
            },
            maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
          },
        );
        const updated = parseCompanyDefaultPriceBook(response.data);
        setDefaultMappings((prev) => ({ ...prev, [key]: updated }));
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradePricing.defaultBookSaved,
        );
        await load();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.error(
            t.trade.priceBookSaveFailed,
            pricingMessage(normalized, t) ?? normalized.message,
          );
        }
        return false;
      } finally {
        setIsDefaultBusy(false);
      }
    },
    [canManageDefaults, isDefaultBusy, defaultMappings, scope.headers, toast, t, load],
  );

  const removeBookCompanyDefault = useCallback(
    async (book: PriceBook): Promise<boolean> => {
      const key = `${book.purpose}:${book.currencyCode}`;
      const existing = defaultMappings[key];
      if (!canManageDefaults || !existing || isDefaultBusy) return false;
      setIsDefaultBusy(true);
      try {
        await tradeDelete(companyDefaultPriceBookPath(book.purpose, book.currencyCode), {
          headers: {
            ...scope.headers,
            "If-Match": tradeIfMatch(existing.version),
          },
        });
        setDefaultMappings((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
        toast.success(t.tradeCommon.savedTitle, t.tradePricing.defaultBookRemoved);
        await load();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.error(t.trade.priceBookDeleteFailed, normalized.message);
        }
        return false;
      } finally {
        setIsDefaultBusy(false);
      }
    },
    [canManageDefaults, defaultMappings, isDefaultBusy, scope.headers, toast, t, load],
  );

  const toggleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (visibleItems.length > 0 && visibleItems.every((b) => prev.has(b.id))) {
        return new Set();
      }
      return new Set(visibleItems.map((b) => b.id));
    });
  }, [visibleItems]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const bulkSetStatus = useCallback(
    async (targetStatus: PriceBookStatus): Promise<void> => {
      if (!canManage || selectedIds.size === 0) return;
      const targets = items.filter((b) => selectedIds.has(b.id) && b.status !== targetStatus);
      for (const book of targets) {
        if (targetStatus === "INACTIVE" && isBookDefault(book)) {
          toast.error(t.trade.priceBookSaveFailed, t.tradePricing.cannotDeactivateDefault);
          continue;
        }
        await tradePatch(
          priceBookDetailPath(book.id),
          buildUpdatePriceBookRequest({ status: targetStatus }),
          {
            headers: {
              ...scope.headers,
              "If-Match": tradeIfMatch(book.version),
            },
            maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
          },
        ).catch(() => null);
      }
      setSelectedIds(new Set());
      toast.success(t.tradeCommon.savedTitle, t.tradePricing.bulkCompleted);
      await load();
    },
    [canManage, selectedIds, items, isBookDefault, scope.headers, toast, t, load],
  );

  const exportSelectedCsv = useCallback(() => {
    const rows = visibleItems.filter((b) => (selectedIds.size > 0 ? selectedIds.has(b.id) : true));
    const header = ["code", "name", "purpose", "currencyCode", "status", "versionCount", "isDefault"];
    const lines = [
      header.join(","),
      ...rows.map((b) =>
        [
          `"${b.code.replaceAll('"', '""')}"`,
          `"${localizedBookDisplayName(b, lang).replaceAll('"', '""')}"`,
          b.purpose,
          b.currencyCode,
          b.status,
          String(b.versionCount),
          isBookDefault(b) ? "true" : "false",
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `price-books-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [visibleItems, selectedIds, lang, isBookDefault]);

  const selectedBooks = useMemo(
    () => items.filter((b) => selectedIds.has(b.id)),
    [items, selectedIds],
  );

  return {
    t,
    lang,
    canRead,
    canManage,
    canManageDefaults,
    isScopeResolved: scope.isResolved,
    items: visibleItems,
    allItems: items,
    viewMode,
    setViewMode,
    search,
    setSearch,
    purpose,
    setPurpose: (next: PriceBookPurpose | undefined) => {
      setPage(1);
      setPurpose(next);
    },
    statusFilter,
    setStatusFilter: (next: PriceBookStatus | undefined) => {
      setPage(1);
      setStatusFilter(next);
    },
    governanceFilter,
    setGovernanceFilter: (next: PriceBookGovernanceFilter | undefined) => {
      setPage(1);
      setGovernanceFilter(next);
    },
    onlyDefaults,
    setOnlyDefaults: (next: boolean) => {
      setPage(1);
      setOnlyDefaults(next);
    },
    defaultMappings,
    isDefaultBusy,
    isBookDefault,
    setBookAsCompanyDefault,
    removeBookCompanyDefault,
    updateBook,
    selectedIds,
    selectedBooks,
    toggleSelectRow,
    toggleSelectAll,
    clearSelection,
    bulkSetStatus,
    exportSelectedCsv,
    pageInfo: {
      page,
      limit: PRICE_BOOK_PAGE_SIZE,
      total: onlyDefaults ? visibleItems.length : total,
    },
    setPage,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    createOpen,
    isSubmitting,
    formError,
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => setCreateOpen(false),
    create,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
