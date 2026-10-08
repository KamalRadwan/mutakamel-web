"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { readCategories } from "../category-api";
import type { Category, CategoryDetail } from "../category-contract";

export function useCategoryTargets(mode: "parent" | "before", source: CategoryDetail | null) {
  const { lang } = useI18n();
  const [items, setItems] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [selected, setSelected] = useState<Category | null>(null);
  const query = useRef("");
  const pending = useRef<AbortController | null>(null);
  const sourceId = source?.id;
  const parentId = source?.parentId;
  const load = useCallback(async (search: string, nextPage = 1) => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    query.current = search.trim(); setLoading(true); setError(null); setItems([]);
    try {
      const result = await readCategories({ locale: lang, page: nextPage, search: search.trim() || undefined,
        ...(mode === "before" ? { parentId: parentId ?? "ROOT" } : sourceId ? { moveSourceId: sourceId } : {}),
      }, controller.signal);
      if (controller.signal.aborted) return;
      setItems(result.items); setPage(result.page); setTotal(result.total);
    } catch (thrown) { if (!controller.signal.aborted) setError(normalizeApiError(thrown)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [lang, mode, parentId, sourceId]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(""); });
    return () => { active = false; pending.current?.abort(); };
  }, [load]);
  return { items, page, total, loading, error, selected, search: load,
    retry: () => load(query.current, page), nextPage: (next: number) => load(query.current, next),
    choose: (id: string) => {
      const item = items.find((entry) => entry.id === id);
      if (!item || item.id === sourceId || (mode === "parent" && !item.effectiveActive)) return false;
      setSelected(item); return true;
    },
  };
}
