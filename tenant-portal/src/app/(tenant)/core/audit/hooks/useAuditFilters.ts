"use client";
import { useState } from "react";
import type { DateRangeValue } from "@/design-system";
import type { AuditFilters } from "@/lib/audit/audit-contract";

export function useAuditFilters(filters: AuditFilters, onApply: (value: AuditFilters) => void) {
  const [draft, setDraft] = useState(filters);
  const [range, setRange] = useState<DateRangeValue | undefined>(() => {
    const from = filters.from ? new Date(filters.from) : undefined;
    const to = filters.to ? new Date(filters.to) : undefined;
    if (to) to.setDate(to.getDate() - 1);
    return from || to ? { from, to } : undefined;
  });
  const change = (patch: Partial<AuditFilters>) => setDraft((current) => ({ ...current, ...patch }));
  const applyRange = (value: DateRangeValue | undefined) => {
    setRange(value);
    // The picker selects calendar days; Core's upper bound is exclusive.
    const to = value?.to ? new Date(value.to) : undefined;
    if (to) to.setDate(to.getDate() + 1);
    change({ from: value?.from?.toISOString(), to: to?.toISOString() });
  };
  return { draft, range, change, applyRange, apply: () => onApply(draft),
    clear: () => { setDraft({}); setRange(undefined); onApply({}); } };
}
