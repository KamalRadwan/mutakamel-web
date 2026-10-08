"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { readCategories, readCategory } from "../category-api";
import type { CategoryDetail, CategoryPage, CategoryStatus } from "../category-contract";

export function useCategoryList(page: number, search: string, status: CategoryStatus | undefined, locale: string, enabled: boolean) {
  const [data, setData] = useState<CategoryPage | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const pending = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    if (!enabled) return false;
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); setError(null);
    try {
      const next = await readCategories({ page, search: search.trim() || undefined, status, locale }, controller.signal);
      if (controller.signal.aborted) return false;
      setData(next); return true;
    } catch (thrown) {
      if (!controller.signal.aborted) { setData(null); setError(normalizeApiError(thrown)); }
      return false;
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [enabled, locale, page, search, status]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void reload(); });
    return () => { active = false; pending.current?.abort(); };
  }, [reload]);
  return { data, error, loading, reload };
}

export function useCategoryDetail(id: string | null, locale: string) {
  const [data, setData] = useState<CategoryDetail | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const pending = useRef<AbortController | null>(null);
  const reload = useCallback(async (): Promise<CategoryDetail | null> => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setError(null); setData(null); setLoading(Boolean(id));
    if (!id) return null;
    try {
      const next = await readCategory(id, locale, controller.signal);
      if (controller.signal.aborted) return null;
      setData(next); return next;
    } catch (thrown) {
      if (!controller.signal.aborted) setError(normalizeApiError(thrown));
      return null;
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [id, locale]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void reload(); });
    return () => { active = false; pending.current?.abort(); };
  }, [reload]);
  return { data: data?.id === id ? data : null, error, loading, reload };
}
