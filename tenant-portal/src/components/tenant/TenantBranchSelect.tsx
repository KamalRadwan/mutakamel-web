"use client";

import {
  Combobox,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useTenantBranchSelect, type TenantBranchSelectProps } from "@/hooks/useTenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";

// Every CRM read is branch-scoped — one of these per workspace. Hidden when
// the account only has one accessible branch, since there is nothing to
// choose. See docs/design/views.md#shared-behavior--identical-across-all-three-views.
export function TenantBranchSelect(props: TenantBranchSelectProps) {
  const { branchIds, disabled = false } = props;
  const { t, dir } = useI18n();
  const selector = useTenantBranchSelect(props);
  if (branchIds.length < 2) return null;

  if (branchIds.length > 3) {
    return (
      <Field label={t.common.branch} className="w-56">
        <Combobox
          value={selector.value}
          selectedLabel={selector.selectedLabel}
          onValueChange={selector.change}
          options={selector.filteredOptions}
          onSearch={selector.search}
          debounceMs={0}
          placeholder={t.common.selectBranch}
          searchPlaceholder={t.common.searchBranches}
          loadingLabel={t.common.loading}
          emptyLabel={t.common.noMatchingBranches}
          disabled={disabled}
          size="sm"
          textSize="compact"
        />
      </Field>
    );
  }

  return (
    <Select
      dir={dir}
      value={selector.value}
      onValueChange={selector.change}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label={t.common.branch}
        textSize="compact"
        className="w-56"
      >
        <SelectValue placeholder={t.common.selectBranch} />
      </SelectTrigger>
      <SelectContent textSize="compact">
        {selector.options.map(({ value, label }) => (
          <SelectItem key={value} value={value} textValue={label} className="text-caption">
            <bdi>{label}</bdi>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
