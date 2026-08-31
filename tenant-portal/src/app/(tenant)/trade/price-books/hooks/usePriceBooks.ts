"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeGet, tradeIfMatch, tradePost } from "../../trade-api";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import {
  PRICE_BOOKS_PATH,
  PRICE_BOOK_PAGE_SIZE,
  PRICING_MANAGE_PERMISSION,
  PRICING_READ_PERMISSION,
  buildCreatePriceBookRequest,
  parsePriceBooksResponse,
  priceBookVersionsPath,
  priceBooksListPath,
  type PriceBook,
  type PriceBookFormValues,
  type PriceBookPurpose,
} from "../pricing-contract";
import { pricingFormMessage, pricingMessage } from "../pricing-messages";
import { buildCreateVersionRequest, type VersionDraft } from "../version-draft";

const LIST_RESPONSE_LIMIT_BYTES = 400_000;
const ROW_RESPONSE_LIMIT_BYTES = 200_000;

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
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [scope.isResolved, scope.headers, page, purpose],
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
              // The book's own version, not the new version's — the If-Match
              // guards the book row this write appends to.
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

  return {
    t,
    lang,
    canRead,
    canManage,
    isScopeResolved: scope.isResolved,
    branchIds,
    branchId,
    selectBranch,
    items,
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
