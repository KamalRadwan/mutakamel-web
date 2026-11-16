"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet } from "../../trade-api";
import {
  TRADE_ITEM_SEARCH_MAX_LENGTH, TRADE_LOOKUP_RESPONSE_BYTES,
  parseTradeItems, parseTradeUoms, tradeItemsPath, tradeUomCataloguePath,
  type TradeItemOption, type TradePricePurpose, type TradeUomOption,
} from "../trade-lookup-contract";
import { isAbortError } from "./useTradeDocumentList";

interface CatalogState {
  key: string;
  items: TradeItemOption[];
  itemsById: Record<string, TradeItemOption>;
  uomsByItem: Record<string, TradeUomOption[]>;
  itemError: NormalizedApiError | null;
  uomErrors: Record<string, NormalizedApiError>;
  loading: boolean;
}

function emptyCatalog(key: string): CatalogState {
  return { key, items: [], itemsById: {}, uomsByItem: {}, itemError: null, uomErrors: {}, loading: false };
}

export function useTradeLineCatalog(
  headers: Record<string, string>, purpose: TradePricePurpose, enabled: boolean,
) {
  const key = JSON.stringify([Object.entries(headers).sort(), purpose]);
  const [state, setState] = useState(() => emptyCatalog(key));
  const cache = useRef(state);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const pending = useRef(new Map<string, Promise<TradeUomOption[]>>());
  const requests = useRef(new Set<AbortController>());

  useEffect(() => { cache.current = state; }, [state]);

  useEffect(() => () => {
    for (const controller of requests.current) controller.abort();
    requests.current.clear();
    pending.current.clear();
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setState((current) => ({
        ...(current.key === key ? current : emptyCatalog(key)), loading: true, itemError: null,
      }));
      void tradeGet(tradeItemsPath(1, purpose, search), {
        signal: controller.signal, headers, maxResponseBytes: TRADE_LOOKUP_RESPONSE_BYTES,
      }).then((response) => {
        const page = parseTradeItems(response.data, purpose);
        if (controller.signal.aborted) return;
        setState((current) => ({
          ...(current.key === key ? current : emptyCatalog(key)),
          items: page.items,
          itemsById: {
            ...(current.key === key ? current.itemsById : {}),
            ...Object.fromEntries(page.items.map((item) => [item.id, item])),
          },
          loading: false, itemError: null,
        }));
      }).catch((error: unknown) => {
        if (isAbortError(error) || controller.signal.aborted) return;
        setState((current) => current.key === key
          ? { ...current, items: [], loading: false, itemError: normalizeApiError(error) }
          : current);
      });
    });
    return () => controller.abort();
  }, [enabled, headers, key, purpose, search, revision]);

  const visible = state.key === key ? state : emptyCatalog(key);
  const ensureItemUoms = useCallback(async (itemId: string): Promise<TradeUomOption[]> => {
    const current = cache.current;
    if (current.key === key && current.uomsByItem[itemId]) return current.uomsByItem[itemId];
    const requestKey = `${key}:${itemId}`;
    const active = pending.current.get(requestKey);
    if (active) return active;
    const controller = new AbortController();
    requests.current.add(controller);
    const request = (async () => {
      try {
        const response = await tradeGet(tradeUomCataloguePath(itemId, purpose), {
          headers, signal: controller.signal, maxResponseBytes: TRADE_LOOKUP_RESPONSE_BYTES,
        });
        const units = parseTradeUoms(response.data).items;
        if (controller.signal.aborted) return [];
        setState((current) => {
          const scoped = current.key === key ? current : emptyCatalog(key);
          const uomErrors = { ...scoped.uomErrors };
          delete uomErrors[itemId];
          return { ...scoped, uomsByItem: { ...scoped.uomsByItem, [itemId]: units }, uomErrors };
        });
        return units;
      } catch (error) {
        if (!isAbortError(error) && !controller.signal.aborted) {
          setState((current) => {
            const scoped = current.key === key ? current : emptyCatalog(key);
            return { ...scoped, uomErrors: { ...scoped.uomErrors, [itemId]: normalizeApiError(error) } };
          });
        }
        return [];
      } finally {
        requests.current.delete(controller);
        pending.current.delete(requestKey);
      }
    })();
    pending.current.set(requestKey, request);
    return request;
  }, [headers, key, purpose]);

  const retryLookups = useCallback(() => {
    setRevision((current) => current + 1);
    const current = cache.current;
    if (current.key === key) {
      for (const itemId of Object.keys(current.uomErrors)) void ensureItemUoms(itemId);
    }
  }, [ensureItemUoms, key]);

  const restoreCatalog = useCallback((items: TradeItemOption[], units: Record<string, TradeUomOption[]>) => {
    setState((current) => ({
      ...(current.key === key ? current : emptyCatalog(key)),
      itemsById: { ...Object.fromEntries(items.map((item) => [item.id, item])),
        ...(current.key === key ? current.itemsById : {}) },
      uomsByItem: { ...units, ...(current.key === key ? current.uomsByItem : {}) },
    }));
  }, [key]);

  return {
    items: visible.items, itemsById: visible.itemsById, uomsByItem: visible.uomsByItem,
    lookupError: visible.itemError ?? Object.values(visible.uomErrors)[0] ?? null,
    isLoadingItems: enabled && (visible.loading || state.key !== key),
    searchItems: (query: string) => setSearch(query.slice(0, TRADE_ITEM_SEARCH_MAX_LENGTH)),
    retryLookups,
    ensureItemUoms, restoreCatalog,
  };
}
