"use client";

import { useCallback, useEffect, useState } from "react";
import { useRealtimeResync, useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch, tradePatch, tradePost } from "../../trade-api";
import {
  canPerformTradeAction,
  TRADE_CONCURRENCY_CODES,
  TRADE_PERMISSIONS,
} from "../../trade-scope";
import { useTradeScopeRequest } from "../../useTradeScope";
import { useTradeWrite } from "../../useTradeWrite";
import {
  LISTING_EXISTS_CODE,
  LISTING_INVALID_CODE,
  LISTING_PAGE_SIZE,
  buildListingRequest,
  channelListingPath,
  channelListingsPath,
  parseListingsResponse,
  type ItemChannelListing,
  type ListingFormValues,
} from "../item-profile-contract";

const LIST_RESPONSE_LIMIT_BYTES = 400_000;

/**
 * Channel listings, target `COMPANY_OR_BRANCH`.
 *
 * The read narrows on `branch_scope_key`, which is the branch id or the
 * literal `"none"`, so the company-only view and the branch view are two
 * disjoint sets of rows rather than a superset and a subset. Changing the
 * branch in the scope bar therefore changes WHICH listings exist, not just
 * which are shown.
 */
export function useItemListings(itemId: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.itemsManage);
  const { headers, gap } = useTradeScopeRequest("COMPANY_OR_BRANCH");

  const [listings, setListings] = useState<ItemChannelListing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ItemChannelListing | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (gap) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await tradeGet(channelListingsPath(itemId, page), {
          signal,
          headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        const parsed = parseListingsResponse(result.data);
        setListings(parsed.items);
        setTotal(parsed.total);
      } catch (thrown) {
        if (thrown instanceof DOMException && thrown.name === "AbortError") return;
        setError(normalizeApiError(thrown));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [itemId, page, headers, gap],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const describe = useCallback(
    (failure: NormalizedApiError): string | undefined => {
      if (failure.code === LISTING_EXISTS_CODE) return t.trade.listingExists;
      if (failure.code === LISTING_INVALID_CODE) return t.trade.listingInvalid;
      return undefined;
    },
    [t],
  );

  const save = useCallback(
    async (values: ListingFormValues): Promise<boolean> => {
      if (!canManage || gap || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        // Both fields go on every write. `publicationStatus` and
        // `saleConstraints` are optional WITH DEFAULTS, so a PATCH that omits
        // one silently writes the default over the stored value.
        const request = buildListingRequest(values, editing === null);
        const outcome = await runWrite(
          () =>
            editing
              ? tradePatch(channelListingPath(itemId, editing.channelId), request, {
                  headers: { ...headers, "if-match": tradeIfMatch(editing.version) },
                })
              : tradePost(channelListingsPath(itemId, page), request, { headers }),
          { failureTitle: t.trade.listingSaveFailed, describe },
        );
        // A 409 `TRADE.CONCURRENCY.STALE_VERSION` means someone else moved
        // the row. Trade has no force-write path, so the only honest
        // response is to refetch and let the user see the server's value.
        if (!outcome.ok) {
          if (outcome.error?.code === TRADE_CONCURRENCY_CODES.staleVersion) await load();
          return false;
        }
        setCreateOpen(false);
        setEditing(null);
        toast.success(
          t.trade.savedTitle,
          outcome.replayed ? t.trade.replayedDescription : t.trade.savedDescription,
        );
        await load();
        return true;
      } catch (thrown) {
        setFormError(listingMessage(thrown, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, gap, isSubmitting, editing, runWrite, itemId, page, headers, describe, toast, t, load],
  );

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  const reload = useCallback(() => load(), [load]);
  useRealtimeResync(reload);

  return {
    t,
    lang,
    canManage,
    scopeGap: gap,
    listings,
    pageInfo: { page, limit: LISTING_PAGE_SIZE, total },
    isLoading,
    error,
    isSubmitting,
    formError,
    createOpen,
    editing,
    setPage,
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setCreateOpen(false);
    },
    openEdit: (listing: ItemChannelListing) => {
      setFormError(null);
      setEditing(listing);
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setEditing(null);
    },
    save,
    reload,
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

function listingMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "LISTING_FORM_CHANNEL") return t.trade.listingChannel;
  if (reason === "LISTING_FORM_STATUS") return t.trade.publicationStatusHint;
  return t.trade.jsonInvalid;
}
