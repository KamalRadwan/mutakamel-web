"use client";

import { Search, X, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "../../lib/cn";
import { Input } from "../../primitives/Input";
import { Button } from "../../primitives/Button";
import { Switch } from "../../primitives/Switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../primitives/Select";
import { useFilterBar } from "./useFilterBar";
import type { FilterBarProps, FilterField } from "./types";

/** Implements docs/components/filter-bar.md. */
export function FilterBar({ fields, values, onChange, onReset, isLoading }: FilterBarProps) {
  const { lang } = useI18n();
  const { searchDraft, setSearchValue, setFieldValue, clearField, activeFields } = useFilterBar({
    fields,
    values,
    onChange,
  });

  return (
    <div className="flex flex-col gap-3 border-b border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        {fields.map((field) => (
          <FilterFieldControl
            key={field.key}
            field={field}
            value={values[field.key]}
            searchDraft={searchDraft}
            lang={lang}
            disabled={isLoading}
            onSearchChange={setSearchValue}
            onFieldChange={(v) => setFieldValue(field.key, v)}
          />
        ))}

        {onReset && (
          <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={isLoading}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {lang === "ar" ? "إعادة تعيين" : "Reset"}
          </Button>
        )}
      </div>

      {activeFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFields.map((field) => (
            <button
              key={field.key}
              type="button"
              onClick={() => clearField(field.key)}
              className="inline-flex items-center gap-1 rounded-sm bg-ink-100 px-2 py-0.5 text-2xs font-medium text-ink-700 transition-colors hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
            >
              {fieldValueLabel(field, values[field.key], lang)}
              <X className="size-3" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterFieldControl({
  field,
  value,
  searchDraft,
  lang,
  disabled,
  onSearchChange,
  onFieldChange,
}: {
  field: FilterField;
  value: unknown;
  searchDraft: string;
  lang: "ar" | "en";
  disabled?: boolean;
  onSearchChange: (v: string) => void;
  onFieldChange: (v: unknown) => void;
}) {
  const placeholder = lang === "ar" ? field.placeholderAr : field.placeholderEn;

  if (field.type === "search") {
    return (
      <div className="relative min-w-48 flex-1">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={searchDraft}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-(--size-control-lg) ps-9"
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <Select value={value ? String(value) : ""} onValueChange={onFieldChange} disabled={disabled}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {lang === "ar" ? opt.labelAr : opt.labelEn}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Switch checked={!!value} onCheckedChange={onFieldChange} disabled={disabled} />
        {placeholder}
      </label>
    );
  }

  // date-range
  const range = (value as { from?: string; to?: string } | undefined) ?? {};
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={range.from ?? ""}
        onChange={(e) => onFieldChange({ ...range, from: e.target.value })}
        disabled={disabled}
        className={cn(
          "h-(--size-control-lg) rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none",
        )}
      />
      <span className="text-muted-foreground">–</span>
      <input
        type="date"
        value={range.to ?? ""}
        onChange={(e) => onFieldChange({ ...range, to: e.target.value })}
        disabled={disabled}
        className={cn(
          "h-(--size-control-lg) rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none",
        )}
      />
    </div>
  );
}

function fieldValueLabel(field: FilterField, value: unknown, lang: "ar" | "en"): string {
  if (field.type === "select") {
    const opt = field.options?.find((o) => o.value === value);
    if (opt) return lang === "ar" ? opt.labelAr : opt.labelEn;
  }
  if (field.type === "date-range" && value && typeof value === "object") {
    const { from, to } = value as { from?: string; to?: string };
    return [from, to].filter(Boolean).join(" – ");
  }
  return String(value);
}
