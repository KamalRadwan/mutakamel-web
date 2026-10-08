"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradePost } from "../../trade-api";
import { tradeLocalizedName } from "../../trade-validation";
import {
  buildItemReferenceSearchRequest,
  ITEMS_SEARCH_PATH,
  itemPath,
  itemsListPath,
  parseItemResponse,
  parseItemsResponse,
  type Item,
} from "../item-contract";

const RESPONSE_LIMIT_BYTES = 800_000;

export function useItemReferenceOptions(
  enabled: boolean,
  selectedIds: readonly string[],
  excludeItemId?: string,
) {
  const { lang } = useI18n();
  const [visible, setVisible] = useState<Item[]>([]);
  const [known, setKnown] = useState<Record<string, Item>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const requestId = useRef(0);
  const selectedKey = [...new Set(selectedIds)].sort().join("|");

  const mergeKnown = useCallback((items: Item[]) => {
    setKnown((current) => {
      const next = { ...current };
      for (const item of items) next[item.id] = item;
      return next;
    });
  }, []);

  const search = useCallback(
    async (query: string): Promise<void> => {
      if (!enabled) return;
      const currentRequest = requestId.current + 1;
      requestId.current = currentRequest;
      const trimmed = query.trim();
      setIsLoading(true);
      setError(null);
      try {
        // Item relationships belong to the tenant master, not the currently
        // selected operating company. Explicit empty headers prevent a stale
        // company/branch selection from hiding valid component candidates.
        const result = trimmed
          ? await tradePost(
              ITEMS_SEARCH_PATH,
              buildItemReferenceSearchRequest(trimmed),
              { headers: {}, maxResponseBytes: RESPONSE_LIMIT_BYTES },
            )
          : await tradeGet(itemsListPath(1, "PRODUCT", "ACTIVE"), {
              headers: {},
              maxResponseBytes: RESPONSE_LIMIT_BYTES,
            });
        if (requestId.current !== currentRequest) return;
        const parsed = parseItemsResponse(result.data).items.filter((item) => item.id !== excludeItemId);
        mergeKnown(parsed);
        setVisible(parsed);
      } catch (thrown) {
        if (requestId.current !== currentRequest) return;
        setVisible([]);
        setError(normalizeApiError(thrown));
      } finally {
        if (requestId.current === currentRequest) setIsLoading(false);
      }
    },
    [enabled, excludeItemId, mergeKnown],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    queueMicrotask(() => {
      if (active) void search("");
    });
    return () => {
      active = false;
      requestId.current += 1;
    };
  }, [enabled, search]);

  useEffect(() => {
    if (!enabled || !selectedKey) return;
    const missing = selectedKey.split("|").filter((id) => id && id !== excludeItemId && !known[id]);
    if (missing.length === 0) return;
    let active = true;
    void Promise.all(
      missing.map((id) =>
        tradeGet(itemPath(id), { headers: {}, maxResponseBytes: RESPONSE_LIMIT_BYTES }).then((result) =>
          parseItemResponse(result.data),
        ),
      ),
    )
      .then((items) => {
        if (active) mergeKnown(items);
      })
      .catch((thrown: unknown) => {
        if (active) setError(normalizeApiError(thrown));
      });
    return () => {
      active = false;
    };
  }, [enabled, excludeItemId, known, mergeKnown, selectedKey]);

  const labelFor = (id: string): string => {
    const item = known[id];
    if (!item) return id;
    const name = tradeLocalizedName(item.localizedNames, lang);
    return name ? `${name} · ${item.canonicalCode}` : item.canonicalCode;
  };

  return {
    items: visible,
    isLoading,
    error,
    search,
    labelFor,
  };
}
