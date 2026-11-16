"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import type { TradePath } from "@/lib/api/envelope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { channelPath, parseChannelDetailResponse } from "../../channels/channel-contract";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import { tradeGet } from "../../trade-api";
import {
  PRICE_BOOKS_PATH, PRICING_READ_PERMISSION, PRICING_REFERENCE_DATA_PATH,
  parsePriceBooksResponse, parsePricingReferenceData,
  type PriceBook, type PricingReferenceData,
} from "../pricing-contract";

interface ReferenceOptions { enabled?: boolean; includeBooks?: boolean }
const EMPTY_BOOKS: PriceBook[] = [];

export function usePricingReferenceData(options: boolean | ReferenceOptions = {}) {
  const enabled = typeof options === "boolean" ? options : options.enabled !== false;
  const includeBooks = typeof options === "boolean" ? false : options.includeBooks === true;
  const scope = useTradeScope("COMPANY", null);
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const requestKey = JSON.stringify([user?.id, realtimeAuthGeneration, scope.headers, scope.permissions, scope.isTenantOwner]);
  const [loadedKey, setLoadedKey] = useState("");
  const canRead = hasTradePermission(scope.permissions, scope.isTenantOwner, PRICING_READ_PERMISSION);
  const canReadCatalog = hasTradePermission(scope.permissions, scope.isTenantOwner, "trade.items.read");
  const [data, setData] = useState<PricingReferenceData | null>(null);
  const [books, setBooks] = useState<PriceBook[]>(EMPTY_BOOKS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [booksError, setBooksError] = useState<NormalizedApiError | null>(null);
  const [channelBranchIdsByChannel, setChannelBranchIdsByChannel] = useState<Record<string, string[]>>({});

  const load = useCallback(async (signal: AbortSignal) => {
    setLoadedKey(requestKey);
    if (!enabled || !canRead || !scope.isResolved) {
      setData(null); setBooks(EMPTY_BOOKS); setError(null); setBooksError(null);
      setChannelBranchIdsByChannel({}); setIsLoading(false);
      return;
    }
    setIsLoading(true); setError(null); setBooksError(null);
    // A company change must never expose the prior company's reference choices.
    setData(null); setBooks(EMPTY_BOOKS); setChannelBranchIdsByChannel({});
    const references = async () => {
      try {
        const response = await tradeGet(PRICING_REFERENCE_DATA_PATH, {
          signal, headers: scope.headers, maxResponseBytes: 2_000_000,
        });
        const parsed = parsePricingReferenceData(response.data);
        if (signal.aborted) return;
        setData(parsed);
        if (!canReadCatalog) return;
        const result = await Promise.allSettled(parsed.channels.map(async (channel) => {
          const response = await tradeGet(channelPath(channel.id), {
            signal, headers: scope.headers, maxResponseBytes: 100_000,
          });
          return [channel.id, parseChannelDetailResponse(response.data).branches.filter(b => b.isActive).map(b => b.branchId)] as const;
        }));
        if (!signal.aborted) setChannelBranchIdsByChannel(Object.fromEntries(
          result.flatMap(row => row.status === "fulfilled" ? [row.value] : []),
        ));
      } catch (err) {
        if (!signal.aborted) setError(normalizeApiError(err));
      }
    };
    const loadBooks = async () => {
      if (!includeBooks) return;
      try {
        // The DTO caps each page at100. Search remains local after the list loads.
        const collected: PriceBook[] = [];
        for (let page = 1; !signal.aborted; page += 1) {
          const response = await tradeGet(`${PRICE_BOOKS_PATH}?page=${page}&limit=100` as TradePath, {
            signal, headers: scope.headers, maxResponseBytes: 500_000,
          });
          const parsed = parsePriceBooksResponse(response.data);
          collected.push(...parsed.items);
          if (collected.length >= parsed.total || parsed.items.length === 0) break;
        }
        if (!signal.aborted) setBooks(collected);
      } catch (err) {
        if (!signal.aborted) setBooksError(normalizeApiError(err));
      }
    };
    await Promise.allSettled([references(), loadBooks()]);
    if (!signal.aborted) setIsLoading(false);
  }, [enabled, includeBooks, canRead, canReadCatalog, scope.isResolved, scope.headers, requestKey]);

  const [reloadCount, setReloadCount] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load, reloadCount]);
  const reload = useCallback(() => setReloadCount(value => value + 1), []);
  const current = requestKey === loadedKey;
  const visibleData = current ? data : null;
  const visibleBooks = current ? books : EMPTY_BOOKS;
  const maps = useMemo(() => ({
    itemById: new Map(visibleData?.items.map(item => [item.itemId, item]) ?? []),
    uomById: new Map(visibleData?.uoms.map(unit => [unit.id, unit]) ?? []),
    accountByPartyId: new Map(visibleData?.commercialAccounts.map(account => [account.partyId, account]) ?? []),
    bookById: new Map(visibleBooks.map(book => [book.id, book])),
  }), [visibleData, visibleBooks]);

  return { data: visibleData, books: visibleBooks,
    isLoading: isLoading || (!current && enabled && canRead && scope.isResolved),
    error: current ? error : null, booksError: current ? booksError : null, reload,
    channelBranchIdsByChannel: current ? channelBranchIdsByChannel : {}, ...maps };
}
