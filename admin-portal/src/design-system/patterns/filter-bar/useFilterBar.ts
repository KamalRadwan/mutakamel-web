"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  FilterBarProps,
  FilterDateRangeValue,
  FilterDependencyRule,
  FilterField,
  FilterValidationContext,
  FilterValidationRule,
} from "./types";

type FilterAnnouncementKind = "" | "filter-removed" | "filters-reset";

function isDateRangeValue(value: unknown): value is FilterDateRangeValue {
  return typeof value === "object" && value !== null;
}

function isEmptyFilterValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isDateRangeValue(value) && ("from" in value || "to" in value)) {
    return !value.from && !value.to;
  }
  return false;
}

function fieldValuesEqual(field: FilterField, left: unknown, right: unknown): boolean {
  if (field.type !== "date-range") return left === right;
  const leftRange = isDateRangeValue(left) ? left : {};
  const rightRange = isDateRangeValue(right) ? right : {};
  return (leftRange.from ?? "") === (rightRange.from ?? "") && (leftRange.to ?? "") === (rightRange.to ?? "");
}

function fieldQueryKeys(field: FilterField): string[] {
  if (field.type === "date-range") {
    return [field.query?.fromKey ?? `${field.key}From`, field.query?.toKey ?? `${field.key}To`];
  }
  return [field.query?.key ?? field.key];
}

export function writeFilterParams(
  params: URLSearchParams,
  fields: readonly FilterField[],
  values: Record<string, unknown>,
): URLSearchParams {
  const nextParams = new URLSearchParams(params);

  for (const field of fields) {
    const value = values[field.key];
    const keys = fieldQueryKeys(field);
    const serialization = field.query?.serialization ?? "omit-empty";
    keys.forEach((key) => nextParams.delete(key));

    if (
      serialization === "omit-default" &&
      field.defaultValue !== undefined &&
      fieldValuesEqual(field, value, field.defaultValue)
    ) {
      continue;
    }

    if (field.type === "date-range") {
      const range = isDateRangeValue(value) ? value : {};
      if (serialization === "always") {
        nextParams.set(keys[0], range.from ?? "");
        nextParams.set(keys[1], range.to ?? "");
      } else {
        if (range.from) nextParams.set(keys[0], range.from);
        if (range.to) nextParams.set(keys[1], range.to);
      }
      continue;
    }

    if (serialization === "always") {
      nextParams.set(keys[0], value === undefined || value === null ? "" : String(value));
    } else if (!isEmptyFilterValue(value)) {
      nextParams.set(keys[0], String(value));
    }
  }

  return nextParams;
}

export function readFilterParams(
  params: URLSearchParams,
  fields: readonly FilterField[],
  currentValues: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...currentValues };

  for (const field of fields) {
    const keys = fieldQueryKeys(field);
    if (field.type === "date-range") {
      const from = params.get(keys[0]) ?? "";
      const to = params.get(keys[1]) ?? "";
      const explicitlyEmpty =
        field.query?.serialization === "always" && keys.some((key) => params.has(key));
      if (from || to || explicitlyEmpty) next[field.key] = { from, to };
      else if (field.defaultValue !== undefined) next[field.key] = field.defaultValue;
      else delete next[field.key];
      continue;
    }

    const raw = params.get(keys[0]);
    if (raw !== null) {
      next[field.key] = field.type === "boolean" ? raw === "true" : raw;
    } else if (field.defaultValue !== undefined) {
      next[field.key] = field.defaultValue;
    } else {
      delete next[field.key];
    }
  }

  return next;
}

function dependencyMatches(
  rule: FilterDependencyRule,
  values: Readonly<Record<string, unknown>>,
): boolean {
  const value = values[rule.fieldKey];
  switch (rule.operator) {
    case "present":
      return !isEmptyFilterValue(value);
    case "empty":
      return isEmptyFilterValue(value);
    case "equals":
      return Object.is(value, rule.value);
    case "not-equals":
      return !Object.is(value, rule.value);
    case "one-of":
      return rule.values.some((candidate) => Object.is(value, candidate));
    case "not-one-of":
      return !rule.values.some((candidate) => Object.is(value, candidate));
    case "custom":
      return rule.evaluate(value, values);
  }
}

/** Returns the rule that currently prevents a field from being enabled. */
export function getFilterDependencyFailure(
  field: FilterField,
  values: Readonly<Record<string, unknown>>,
): FilterDependencyRule | undefined {
  const rules = field.dependencies;
  if (!rules?.length) return undefined;

  if (field.dependencyMode === "any") {
    return rules.some((rule) => dependencyMatches(rule, values)) ? undefined : rules[0];
  }

  return rules.find((rule) => !dependencyMatches(rule, values));
}

function validationRuleFails(
  rule: FilterValidationRule<unknown>,
  value: unknown,
  context: FilterValidationContext,
): boolean {
  switch (rule.kind) {
    case "required":
      return isEmptyFilterValue(value);
    case "min-length":
      return !isEmptyFilterValue(value) && String(value).length < rule.value;
    case "max-length":
      return !isEmptyFilterValue(value) && String(value).length > rule.value;
    case "pattern":
      return !isEmptyFilterValue(value) && !new RegExp(rule.value.source, rule.value.flags).test(String(value));
    case "date-order": {
      const range = isDateRangeValue(value) ? value : {};
      return Boolean(range.from && range.to && range.from > range.to);
    }
    case "custom":
      return !rule.validate(value, context);
  }
}

/** Returns the first localized validation failure so one control has one clear error. */
export function getFilterValidationFailure(
  field: FilterField,
  value: unknown,
  values: Readonly<Record<string, unknown>>,
): { messageEn: string; messageAr: string } | undefined {
  const rules = (field.validation ?? []) as readonly FilterValidationRule<unknown>[];
  const context: FilterValidationContext = { fieldKey: field.key, values };
  return rules.find((rule) => validationRuleFails(rule, value, context));
}

function equivalentFilterValues(
  fields: readonly FilterField[],
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return fields.every((field) => fieldValuesEqual(field, left[field.key], right[field.key]));
}

function hasActiveValue(field: FilterField, value: unknown): boolean {
  if (isEmptyFilterValue(value)) return false;
  if (field.defaultValue !== undefined) return !fieldValuesEqual(field, value, field.defaultValue);
  return true;
}

/**
 * Debounces remote search (300ms by default), keeps local drafts immediate,
 * and synchronizes each field through its documented URL contract.
 */
export function useFilterBar({
  fields,
  values,
  onChange,
  onReset,
}: Pick<FilterBarProps, "fields" | "values" | "onChange" | "onReset">) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.toString();
  const [announcement, setAnnouncement] = useState<{
    kind: FilterAnnouncementKind;
    sequence: number;
  }>({ kind: "", sequence: 0 });
  const [searchDrafts, setSearchDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.filter((field) => field.type === "search").map((field) => [field.key, String(values[field.key] ?? "")]),
    ),
  );
  const debounceRefs = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latestValuesRef = useRef(values);

  const announce = useCallback((kind: Exclude<FilterAnnouncementKind, "">) => {
    setAnnouncement((current) => ({ kind, sequence: current.sequence + 1 }));
  }, []);

  useEffect(() => {
    latestValuesRef.current = values;
  }, [values]);

  useEffect(() => {
    const nextDrafts = Object.fromEntries(
      fields.filter((field) => field.type === "search").map((field) => [field.key, String(values[field.key] ?? "")]),
    );
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSearchDrafts((current) => {
        const keys = Object.keys(nextDrafts);
        return keys.length === Object.keys(current).length && keys.every((key) => current[key] === nextDrafts[key])
          ? current
          : nextDrafts;
      });
    });
    return () => {
      active = false;
    };
  }, [fields, values]);

  useEffect(() => () => {
    debounceRefs.current.forEach(clearTimeout);
    debounceRefs.current.clear();
  }, []);

  const commit = useCallback(
    (next: Record<string, unknown>) => {
      latestValuesRef.current = next;
      onChange(next);
      const params = writeFilterParams(new URLSearchParams(urlSearch), fields, next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [fields, onChange, pathname, router, urlSearch],
  );

  const setSearchValue = useCallback(
    (key: string, raw: string) => {
      setSearchDrafts((current) => ({ ...current, [key]: raw }));
      const field = fields.find((candidate) => candidate.key === key);
      if (!field || field.type !== "search") return;
      const existing = debounceRefs.current.get(key);
      if (existing) clearTimeout(existing);
      const delay = field.debounceMs ?? 300;
      if (delay === 0) {
        commit({ ...latestValuesRef.current, [key]: raw });
        return;
      }
      debounceRefs.current.set(
        key,
        setTimeout(() => {
          debounceRefs.current.delete(key);
          commit({ ...latestValuesRef.current, [key]: raw });
        }, delay),
      );
    },
    [commit, fields],
  );

  const setFieldValue = useCallback(
    (key: string, value: unknown) => {
      commit({ ...latestValuesRef.current, [key]: value });
    },
    [commit],
  );

  const clearField = useCallback(
    (key: string) => {
      const field = fields.find((candidate) => candidate.key === key);
      const next = { ...latestValuesRef.current };
      if (field?.defaultValue !== undefined) next[key] = field.defaultValue;
      else delete next[key];
      if (field?.type === "search") {
        const pending = debounceRefs.current.get(key);
        if (pending) clearTimeout(pending);
        debounceRefs.current.delete(key);
        setSearchDrafts((current) => ({ ...current, [key]: String(field.defaultValue ?? "") }));
      }
      commit(next);
      announce("filter-removed");
    },
    [announce, commit, fields],
  );

  const reset = useCallback(() => {
    const next = { ...latestValuesRef.current };
    for (const field of fields) {
      if (field.defaultValue !== undefined) next[field.key] = field.defaultValue;
      else delete next[field.key];
    }
    debounceRefs.current.forEach(clearTimeout);
    debounceRefs.current.clear();
    setSearchDrafts(
      Object.fromEntries(
        fields
          .filter((field) => field.type === "search")
          .map((field) => [field.key, String(field.defaultValue ?? "")]),
      ),
    );
    commit(next);
    onReset?.();
    announce("filters-reset");
  }, [announce, commit, fields, onReset]);

  const activeFields = useMemo(
    () => fields.filter((field) => hasActiveValue(field, values[field.key])),
    [fields, values],
  );

  // Back/forward navigation is authoritative for shareable filter state. The
  // dependency is intentionally the URL string: inline field arrays must not
  // retrigger synchronization on every parent render.
  useEffect(() => {
    const next = readFilterParams(new URLSearchParams(urlSearch), fields, values);
    if (!equivalentFilterValues(fields, next, values)) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);

  return {
    searchDrafts,
    setSearchValue,
    setFieldValue,
    clearField,
    reset,
    activeFields,
    announcement,
  };
}
