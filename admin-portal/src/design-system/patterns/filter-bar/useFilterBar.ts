"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FilterBarProps } from "./types";

/**
 * Debounces the search field (300ms) so typing doesn't trigger onChange —
 * and therefore a re-fetch — on every keystroke, and syncs every field's
 * value to a same-named URL search param (filter-bar.md's "search, status,
 * tier, from, to" example is one instance of this generic key -> param
 * mapping, not a hardcoded list).
 */
export function useFilterBar({ fields, values, onChange }: Pick<FilterBarProps, "fields" | "values" | "onChange">) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchField = fields.find((f) => f.type === "search");

  const [searchDraft, setSearchDraft] = useState(() =>
    searchField ? String(values[searchField.key] ?? "") : "",
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!searchField) return;
    // Only re-sync the draft when the *external* value changes, not on
    // every local keystroke (searchDraft is intentionally excluded).
    // queueMicrotask defers the update out of the synchronous effect body.
    queueMicrotask(() => setSearchDraft(String(values[searchField.key] ?? "")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchField, values[searchField?.key ?? ""]]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const commit = useCallback(
    (next: Record<string, unknown>) => {
      onChange(next);
      const params = new URLSearchParams(searchParams.toString());
      for (const field of fields) {
        const v = next[field.key];
        if (v === undefined || v === null || v === "") params.delete(field.key);
        else params.set(field.key, String(v));
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [onChange, fields, searchParams, router, pathname],
  );

  const setSearchValue = useCallback(
    (raw: string) => {
      setSearchDraft(raw);
      if (!searchField) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        commit({ ...values, [searchField.key]: raw });
      }, 300);
    },
    [searchField, values, commit],
  );

  const setFieldValue = useCallback(
    (key: string, value: unknown) => {
      commit({ ...values, [key]: value });
    },
    [values, commit],
  );

  const clearField = useCallback(
    (key: string) => {
      const next = { ...values };
      delete next[key];
      commit(next);
    },
    [values, commit],
  );

  const activeFields = fields.filter((f) => {
    const v = values[f.key];
    return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
  });

  return { searchDraft, setSearchValue, setFieldValue, clearField, activeFields };
}
