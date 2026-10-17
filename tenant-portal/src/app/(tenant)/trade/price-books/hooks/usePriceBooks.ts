"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeDelete, tradeGet, tradeIfMatch, tradePost } from "../../trade-api";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import {
  CONFIGURATION_MANAGE_PERMISSION,
  PRICE_BOOKS_PATH,
  PRICE_BOOK_PAGE_SIZE,
  PRICING_MANAGE_PERMISSION,
  PRICING_READ_PERMISSION,
  buildCreatePriceBookRequest,
  companyDefaultPriceBookPath,
  companyDefaultPriceBookUpsertPath,
  parseCompanyDefaultPriceBook,
  parsePriceBooksResponse,
  priceBookVersionsPath,
  priceBooksListPath,
  type CompanyDefaultPriceBook,
  type PriceBook,
  type PriceBookFormValues,
  type PriceBookPurpose,
} from "../pricing-contract";
import { pricingFormMessage, pricingMessage } from "../pricing-messages";
import { buildCreateVersionRequest, type VersionDraft } from "../version-draft";

const LIST_RESPONSE_LIMIT_BYTES = 400_000;
const ROW_RESPONSE_LIMIT_BYTES = 200_000;

export type PriceBookViewMode = "bento" | "table" | "split";

export function usePriceBooks() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useTradeScope("COMPANY", branchId);

  const [items, setItems] = useState<PriceBook[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [purpose, setPurpose] = useState<PriceBookPurpose | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<PriceBookViewMode>("bento");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [defaultMappings, setDefaultMappings] = useState<Record<string, CompanyDefaultPriceBook>>({});
  const [isDefaultBusy, setIsDefaultBusy] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [versionFor, setVersionFor] = useState<PriceBook | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  const loadDefaultMappingsForBooks = useCallback(
    async (books: PriceBook[], signal?: AbortSignal): Promise<void> => {
      if (!scope.isResolved || books.length === 0) return;
      const pairs = new Map<string, { purpose: string; currencyCode: string }>();
      for (const b of books) {
        const key = `${b.purpose}:${b.currencyCode}`;
        if (!pairs.has(key)) {
          pairs.set(key, { purpose: b.purpose, currencyCode: b.currencyCode });
        }
      }
      const nextMappings: Record<string, CompanyDefaultPriceBook> = {};
      await Promise.all(
        Array.from(pairs.entries()).map(async ([key, pair]) => {
          try {
            const res = await tradeGet(companyDefaultPriceBookPath(pair.purpose, pair.currencyCode), {
              signal,
              headers: scope.headers,
              maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
            });
            nextMappings[key] = parseCompanyDefaultPriceBook(res.data);
          } catch {
            // 404 or missing mapping is normal when no default has been set yet
          }
        }),
      );
      if (!signal?.aborted) {
        setDefaultMappings(nextMappings);
      }
    },
    [scope.isResolved, scope.headers],
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
        const response = await tradeGet(priceBooksListPath(page, purpose), {
          signal,
          headers: scope.headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        const parsed = parsePriceBooksResponse(response.data);
        setItems(parsed.items);
        setTotal(parsed.total);
        setHasLoaded(true);
        if (parsed.items.length > 0) {
          setSelectedId((prev) =>
            prev && parsed.items.some((b) => b.id === prev) ? prev : parsed.items[0].id,
          );
          void loadDefaultMappingsForBooks(parsed.items, signal);
        }
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [scope.isResolved, scope.headers, page, purpose, loadDefaultMappingsForBooks],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const create = useCallback(
    async (values: PriceBookFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const response = await tradePost(PRICE_BOOKS_PATH, buildCreatePriceBookRequest(values), {
          headers: scope.headers,
          maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
        });
        setCreateOpen(false);
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradePricing.bookCreated,
        );
        await load();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        setFormError(pricingMessage(normalized, t) ?? pricingFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, scope.headers, toast, t, load],
  );

  const createVersion = useCallback(
    async (draft: VersionDraft): Promise<boolean> => {
      if (!canManage || !versionFor || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const response = await tradePost(
          priceBookVersionsPath(versionFor.id),
          buildCreateVersionRequest(draft),
          {
            headers: {
              ...scope.headers,
              "If-Match": tradeIfMatch(versionFor.version),
            },
            maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
          },
        );
        setVersionFor(null);
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradePricing.versionCreated,
        );
        await load();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        setFormError(pricingMessage(normalized, t) ?? pricingFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, versionFor, isSubmitting, scope.headers, toast, t, load],
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
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.error(t.trade.priceBookSaveFailed, pricingMessage(normalized, t) ?? normalized.message);
        }
        return false;
      } finally {
        setIsDefaultBusy(false);
      }
    },
    [canManageDefaults, isDefaultBusy, defaultMappings, scope.headers, toast, t],
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
    [canManageDefaults, defaultMappings, isDefaultBusy, scope.headers, toast, t],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (b) =>
        b.code.toLowerCase().includes(q) ||
        b.currencyCode.toLowerCase().includes(q) ||
        b.purpose.toLowerCase().includes(q) ||
        (b.name && b.name.toLowerCase().includes(q)),
    );
  }, [items, search]);

  const selectedBook = useMemo(
    () => filteredItems.find((b) => b.id === selectedId) ?? filteredItems[0] ?? null,
    [filteredItems, selectedId],
  );

  return {
    t,
    lang,
    canRead,
    canManage,
    canManageDefaults,
    isScopeResolved: scope.isResolved,
    branchIds,
    branchId,
    selectBranch,
    items: filteredItems,
    allItems: items,
    selectedBook,
    selectedId,
    setSelectedId,
    viewMode,
    setViewMode,
    search,
    setSearch,
    defaultMappings,
    isDefaultBusy,
    setBookAsCompanyDefault,
    removeBookCompanyDefault,
    pageInfo: { page, limit: PRICE_BOOK_PAGE_SIZE, total },
    purpose,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    createOpen,
    versionFor,
    isSubmitting,
    formError,
    setPage,
    setPurpose: (next: PriceBookPurpose | undefined) => {
      setPage(1);
      setPurpose(next);
    },
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setCreateOpen(false);
    },
    openVersion: (book: PriceBook) => {
      setFormError(null);
      setVersionFor(book);
    },
    closeVersion: () => {
      if (isSubmitting) return;
      setVersionFor(null);
    },
    create,
    createVersion,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
