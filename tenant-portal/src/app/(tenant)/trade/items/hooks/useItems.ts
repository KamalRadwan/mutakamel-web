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
import { useTradeScope, useTradeScopeRequest } from "../../useTradeScope";
import { useTradeWrite } from "../../useTradeWrite";
import {
  buildCreateItemRequest,
  buildItemSearchRequest,
  buildUpdateItemRequest,
  ITEMS_PATH,
  ITEMS_SEARCH_PATH,
  ITEM_CODE_TAKEN_CODE,
  ITEM_IDENTITY_INVALID_CODE,
  ITEM_PAGE_SIZE,
  ITEM_UOM_INVALID_CODE,
  itemPath,
  itemsListPath,
  parseItemDetailResponse,
  parseItemsResponse,
  type Item,
  type ItemFormValues,
  type ItemKind,
  type ItemStatus,
} from "../item-contract";

const LIST_RESPONSE_LIMIT_BYTES = 800_000;

/**
 * Reads target `OPERATING_CONTEXT`: with no company header the list is
 * workspace-wide and carries no `eligibility`; with one it is narrowed to that
 * company's profiles, and a branch narrows it again to assorted items only.
 * Nothing is required, so there is no scope gap to render here.
 */
const READ_TARGET = "OPERATING_CONTEXT" as const;

export function useItems() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const runWrite = useTradeWrite();
  const canManage = canPerformTradeAction(user, TRADE_PERMISSIONS.catalogMasterManage);
  const { headers } = useTradeScopeRequest(READ_TARGET);
  const { context, selectCompany } = useTradeScope();

  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageScope, setPageScope] = useState(headers);
  if (pageScope !== headers) {
    setPageScope(headers);
    setPage(1);
  }
  const [kindFilter, setKindFilter] = useState<ItemKind | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<ItemStatus | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const trimmed = search.trim();
        // `POST /items/search` is the read-like free-text variant: a 200, not
        // a 201. The term matches localized names, canonical code and barcode.
        const result = trimmed
          ? await tradePost(
              ITEMS_SEARCH_PATH,
              buildItemSearchRequest(page, trimmed, kindFilter, statusFilter),
              { signal, headers, maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES },
            )
          : await tradeGet(itemsListPath(page, kindFilter, statusFilter), {
              signal,
              headers,
              maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
            });
        const parsed = parseItemsResponse(result.data);
        if (signal?.aborted) return;
        setItems(parsed.items);
        setTotal(parsed.total);
        setHasLoaded(true);
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [page, kindFilter, statusFilter, search, headers],
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
      if (error.code === ITEM_CODE_TAKEN_CODE) return t.trade.itemCodeTaken;
      if (error.code === ITEM_IDENTITY_INVALID_CODE) return t.trade.itemIdentityInvalid;
      if (error.code === ITEM_UOM_INVALID_CODE) return t.trade.itemUomInvalid;
      return undefined;
    },
    [t],
  );

  const create = useCallback(
    async (values: ItemFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildCreateItemRequest(values);
        // TENANT target: no scope headers at all, whatever the selector says.
        const outcome = await runWrite(() => tradePost(ITEMS_PATH, request, {}), {
          failureTitle: t.trade.itemCreateFailed,
          describe,
        });
        if (!outcome.ok) return false;
        setCreateOpen(false);
        toast.success(t.trade.savedTitle, replayMessage(outcome.replayed, t));
        // Creation writes only the tenant identity; a company-profile read
        // cannot include it yet. Let the changed query load the master page.
        if (context.companyId || page !== 1 || search || kindFilter || statusFilter) {
          if (context.companyId) selectCompany(null);
          setPage(1);
          setSearch("");
          setKindFilter(undefined);
          setStatusFilter(undefined);
        } else {
          await load();
        }
        return true;
      } catch (error) {
        setFormError(formMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, runWrite, describe, toast, t, load, context.companyId, selectCompany, page, search, kindFilter, statusFilter],
  );

  const update = useCallback(
    async (values: ItemFormValues): Promise<boolean> => {
      if (!canManage || !editing || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const request = buildUpdateItemRequest(editing, values);
        if (Object.keys(request).length === 0) {
          setEditing(null);
          return true;
        }
        const outcome = await runWrite(
          () =>
            tradePatch(itemPath(editing.id), request, {
              headers: { "if-match": tradeIfMatch(editing.version) },
            }),
          { failureTitle: t.trade.itemUpdateFailed, describe },
        );
        // A 409 `TRADE.CONCURRENCY.STALE_VERSION` means someone else moved
        // the row. Trade has no force-write path, so the only honest
        // response is to refetch and let the user see the server's value.
        if (!outcome.ok) {
          if (outcome.error?.code === TRADE_CONCURRENCY_CODES.staleVersion) await load();
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
    [canManage, editing, isSubmitting, runWrite, describe, toast, t, load],
  );

  /**
   * The board's column move. There is no lifecycle route for an item — its
   * status is an ordinary `PATCH /items/:id` field guarded by `If-Match`, so a
   * failed move reverts by refetching rather than by a local undo.
   */
  const moveToStatus = useCallback(
    async (itemId: string, status: ItemStatus): Promise<void> => {
      const item = items.find((candidate) => candidate.id === itemId);
      if (!canManage || !item || item.status === status || movingId) return;
      setMovingId(itemId);
      const previous = items;
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === itemId ? { ...candidate, status } : candidate,
        ),
      );
      const outcome = await runWrite(
        () =>
          tradePatch(
            itemPath(itemId),
            { status },
            { headers: { "if-match": tradeIfMatch(item.version) } },
          ),
        { failureTitle: t.trade.itemMoveFailed, describe },
      );
      setMovingId(null);
      if (!outcome.ok) {
        // Reverts AND explains: the toast the write path raised names the
        // refusal, and the row goes back to the value the server still holds.
        setItems(previous);
        return;
      }
      await load();
    },
    [items, canManage, movingId, runWrite, describe, t, load],
  );

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  const reload = useCallback(() => load(), [load]);
  useRealtimeResync(reload);

  const hasFilters = Boolean(search.trim() || kindFilter || statusFilter);
  const resetFilters = () => {
    setPage(1);
    setSearch("");
    setKindFilter(undefined);
    setStatusFilter(undefined);
  };
  const openCreate = () => {
    setFormError(null);
    setCreateOpen(true);
  };
  const openEdit = useCallback(async (item: Item): Promise<void> => {
    if (!canManage || isSubmitting || editLoadingId) return;
    setFormError(null);
    setEditLoadingId(item.id);
    try {
      // Identity edits are tenant-master writes. Fetch the authoritative
      // detail first because list projections intentionally omit relations;
      // opening the drawer from a list row would otherwise clear them.
      const result = await tradeGet(itemPath(item.id), {
        headers: {},
        maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
      });
      setEditing(parseItemDetailResponse(result.data));
    } catch (thrown) {
      toast.errorFromApi(t.trade.itemLoadFailed, normalizeApiError(thrown));
    } finally {
      setEditLoadingId(null);
    }
  }, [canManage, editLoadingId, isSubmitting, t, toast]);

  return {
    t,
    lang,
    canManage,
    items,
    pageInfo: { page, limit: ITEM_PAGE_SIZE, total },
    kindFilter,
    statusFilter,
    search,
    emptyTitle: hasFilters
      ? t.trade.itemEmpty
      : context.companyId ? t.trade.itemScopeEmpty : t.trade.itemMasterEmpty,
    emptyDescription: hasFilters
      ? t.trade.itemFilterEmptyDescription
      : context.companyId ? t.trade.itemScopeEmptyDescription : t.trade.itemMasterEmptyDescription,
    emptyAction: hasFilters
      ? { label: t.trade.clearFilters, onClick: resetFilters }
      : context.companyId
        ? { label: t.trade.scopeItemMaster, onClick: () => selectCompany(null) }
        : canManage ? { label: t.trade.itemCreate, onClick: openCreate } : undefined,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isSubmitting,
    movingId,
    queryError,
    formError,
    createOpen,
    editing,
    editLoadingId,
    setPage,
    setKindFilter: (next: ItemKind | undefined) => {
      setPage(1);
      setKindFilter(next);
    },
    setStatusFilter: (next: ItemStatus | undefined) => {
      setPage(1);
      setStatusFilter(next);
    },
    setSearch: (next: string) => {
      setPage(1);
      setSearch(next);
    },
    openCreate,
    closeCreate: () => {
      if (isSubmitting) return;
      setFormError(null);
      setCreateOpen(false);
    },
    openEdit,
    closeEdit: () => {
      if (isSubmitting) return;
      setFormError(null);
      setEditing(null);
    },
    create,
    update,
    moveToStatus,
    reload,
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

function replayMessage(replayed: boolean, t: Dictionary): string {
  return replayed ? t.trade.replayedDescription : t.trade.savedDescription;
}

function formMessage(error: unknown, t: Dictionary): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "ITEM_FORM_CODE") return t.trade.itemFormCode;
  if (reason === "ITEM_FORM_NAMES") return t.trade.itemFormNames;
  if (reason === "ITEM_FORM_UOM") return t.trade.itemFormUom;
  if (reason === "ITEM_FORM_CATEGORY") return t.trade.itemFormCategory;
  if (reason === "ITEM_FORM_VARIANT") return t.trade.itemFormVariant;
  if (reason === "ITEM_FORM_BARCODE") return t.trade.itemFormBarcode;
  if (reason === "ITEM_FORM_NOTES") return t.trade.itemFormNotes;
  if (reason === "ITEM_FORM_OWNER") return t.trade.itemFormOwner;
  if (reason === "ITEM_FORM_DECIMAL") return t.trade.itemFormPositiveDecimal;
  if (reason === "ITEM_FORM_DESCRIPTION") return t.trade.itemFormDescription;
  if (reason === "ITEM_FORM_COMBO") return t.trade.itemFormComboComponents;
  if (reason === "ITEM_FORM_OPTIONAL_PRODUCTS") return t.trade.itemFormOptionalProducts;
  return t.trade.itemCreateFailed;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
