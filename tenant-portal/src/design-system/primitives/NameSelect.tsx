"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Combobox, type ComboboxOption } from "./Combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { useNameSelect } from "./hooks/useNameSelect";
import type { ControlSizeProps } from "../lib/variants";

interface NameSelectProps extends ControlSizeProps {
  value?: string;
  options: readonly ComboboxOption[];
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

/** Compact name-only picker; identifiers remain in option values. */
export function NameSelect({ value, options, onValueChange, placeholder, searchPlaceholder,
  disabled, className, id, "aria-label": ariaLabel, size = "sm" }: NameSelectProps) {
  const { t, dir } = useI18n();
  const picker = useNameSelect(options, value);
  const textSize = size === "sm" || size === "xs" ? "compact" : "default";
  if (options.length > 3) {
    return <Combobox value={value} selectedLabel={picker.selectedLabel ?? t.common.nameUnavailable}
      options={picker.options} onSearch={picker.search} debounceMs={0}
      onValueChange={(next) => { if (next !== undefined) onValueChange(next); picker.resetSearch(); }}
      placeholder={placeholder} searchPlaceholder={searchPlaceholder ?? t.common.search}
      loadingLabel={t.common.loading} emptyLabel={t.common.noData} disabled={disabled}
      className={className} id={id} aria-label={ariaLabel} size={size} textSize={textSize} wrapLabels />;
  }
  return <Select dir={dir} value={value ?? ""} disabled={disabled} onValueChange={onValueChange}>
    <SelectTrigger size={size} textSize={textSize} className={className} id={id} aria-label={ariaLabel}>
      <SelectValue placeholder={placeholder}>{value ? picker.selectedLabel ?? t.common.nameUnavailable : undefined}</SelectValue>
    </SelectTrigger>
    <SelectContent textSize={textSize}>
      {options.map((option) => <SelectItem key={option.value} value={option.value} disabled={option.disabled} textValue={option.label}>
        <bdi>{option.label}</bdi>
      </SelectItem>)}
    </SelectContent>
  </Select>;
}
