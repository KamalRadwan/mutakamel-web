"use client";

import { useCallback, useMemo, useState } from "react";
import { useTenantBranchLabels } from "@/hooks/useTenantBranchLabels";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { formatNumber } from "@/lib/format/number";

const ALL_BRANCHES = "__all__";

export type TenantBranchSelectProps = {
  branchIds: readonly string[];
  branchId: string | null;
  disabled?: boolean;
} & (
  | { allowAll?: false; onChange: (branchId: string) => void }
  | { allowAll: true; onChange: (branchId: string | null) => void }
);

export function useTenantBranchSelect(props: TenantBranchSelectProps) {
  const { t, lang } = useI18n();
  const labels = useTenantBranchLabels(props.branchIds.length >= 2);
  const [query, setQuery] = useState("");
  const options = useMemo(() => {
    const branches = props.branchIds.map((value, index) => ({
      value,
      label: labels.get(value) ?? formatTemplate(t.common.branchNameFallback, {
        number: formatNumber(index + 1, lang),
      }),
    }));
    return props.allowAll
      ? [{ value: ALL_BRANCHES, label: t.common.allBranches }, ...branches]
      : branches;
  }, [labels, lang, props.allowAll, props.branchIds, t.common.allBranches, t.common.branchNameFallback]);
  const normalizedQuery = query.trim().toLocaleLowerCase(lang);
  const filteredOptions = useMemo(
    () => options.filter(({ label }) => label.toLocaleLowerCase(lang).includes(normalizedQuery)),
    [lang, normalizedQuery, options],
  );
  const value = props.branchId ?? (props.allowAll ? ALL_BRANCHES : undefined);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? t.common.selectBranch;

  const change = useCallback((next: string | undefined) => {
    if (next === undefined) return;
    if (props.allowAll) props.onChange(next === ALL_BRANCHES ? null : next);
    else if (next !== ALL_BRANCHES) props.onChange(next);
    setQuery("");
  }, [props]);

  return { options, filteredOptions, value, selectedLabel, change, search: setQuery };
}
