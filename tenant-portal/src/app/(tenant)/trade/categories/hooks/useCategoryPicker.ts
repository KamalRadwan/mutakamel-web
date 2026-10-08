"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { useTradeScopeRequest } from "../../useTradeScope";
import { readCategoryOptions } from "../category-api";
import type { CategoryIntent, CategoryOption, ItemCategorySummary } from "../category-contract";

export function useCategoryPicker(intent: CategoryIntent, enabled: boolean,
  scope: "TENANT" | "OPERATING_CONTEXT", currentSummary?: ItemCategorySummary | null) {
  const { lang } = useI18n();
  const { headers } = useTradeScopeRequest(scope);
  const [items, setItems] = useState<CategoryOption[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [picked, setPicked] = useState<CategoryOption | null>(null);
  const query = useRef("");
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const load = useCallback(async (search: string, nextPage = 1) => {
    if (!enabled) return;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    const requestEpoch = ++epoch.current;
    query.current = search.trim();
    setLoading(true); setError(null); setItems([]);
    try {
      const result = await readCategoryOptions({ page: nextPage, locale: lang, search: search.trim() || undefined }, headers, request.signal);
      if (request.signal.aborted || requestEpoch !== epoch.current) return;
      setItems(result.items); setPage(result.page); setTotal(result.total);
    } catch (thrown) {
      if (!request.signal.aborted && requestEpoch === epoch.current) setError(normalizeApiError(thrown));
    } finally { if (!request.signal.aborted && requestEpoch === epoch.current) setLoading(false); }
  }, [enabled, headers, lang]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setItems([]); setPage(1); setTotal(0); setPicked(null); setError(null); setLoading(false);
      if (enabled) void load("");
    });
    return () => { active = false; epoch.current += 1; controller.current?.abort(); };
  }, [enabled, load]);
  const selected = intent.kind === "selected"
    ? items.find((item) => item.id === intent.id) ?? (picked?.id === intent.id ? picked : null)
      ?? (currentSummary?.id === intent.id ? currentSummary : null)
    : null;
  return { items, page, total, loading, error, selected,
    search: load, setPage: (next: number) => load(query.current, next), retry: () => load(query.current, page),
    choose: (id: string) => { const item = items.find((entry) => entry.id === id); if (item) setPicked(item); return item; },
  };
}
