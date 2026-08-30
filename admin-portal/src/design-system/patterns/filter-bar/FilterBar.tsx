"use client";

import { useId } from "react";
import { Search, X, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
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
import {
  getFilterDependencyFailure,
  getFilterValidationFailure,
  useFilterBar,
} from "./useFilterBar";
import type { FilterBarProps, FilterField } from "./types";

/** Implements docs/components/filter-bar.md. */
export function FilterBar({
  labelEn,
  labelAr,
  fields,
  values,
  onChange,
  onReset,
  ariaControls,
  isLoading = false,
  isRefreshing = false,
}: FilterBarProps) {
  const { lang } = useI18n();
  const idPrefix = useId();
  const {
    searchDrafts,
    setSearchValue,
    setFieldValue,
    clearField,
    reset,
    activeFields,
    announcement,
  } = useFilterBar({
    fields,
    values,
    onChange,
    onReset,
  });
  const disabledForInitialLoad = isLoading && !isRefreshing;
  const regionLabel = lang === "ar" ? (labelAr ?? "عوامل التصفية") : (labelEn ?? "Filters");
  const validationValues = { ...values, ...searchDrafts };
  const announcementText =
    announcement.kind === "filter-removed"
      ? lang === "ar"
        ? "تمت إزالة عامل التصفية"
        : "Filter removed"
      : announcement.kind === "filters-reset"
        ? lang === "ar"
          ? "تمت إعادة عوامل التصفية إلى القيم الافتراضية"
          : "Filters reset to defaults"
        : "";

  return (
    <section
      aria-label={regionLabel}
      aria-controls={ariaControls}
      aria-busy={isLoading || isRefreshing || undefined}
      className="flex flex-col gap-3 border-b border-border bg-card p-4"
    >
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        <span key={announcement.sequence}>{announcementText}</span>
      </p>

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap">
        {fields.map((field) => {
          const dependencyFailure = getFilterDependencyFailure(field, values);
          const disabled = Boolean(disabledForInitialLoad || field.disabled || dependencyFailure);
          const disabledReason = disabledForInitialLoad
            ? lang === "ar"
              ? "ستتوفر عناصر التحكم بعد اكتمال التحميل الأولي."
              : "Controls become available after the initial load completes."
            : field.disabled
              ? lang === "ar"
                ? (field.disabledReasonAr ?? "عامل التصفية هذا غير متاح حالياً.")
                : (field.disabledReasonEn ?? "This filter is currently unavailable.")
              : dependencyFailure
                ? lang === "ar"
                  ? dependencyFailure.reasonAr
                  : dependencyFailure.reasonEn
                : undefined;
          const validationFailure = disabled
            ? undefined
            : getFilterValidationFailure(field, validationValues[field.key], validationValues);

          return (
            <FilterFieldControl
              key={field.key}
              id={`${idPrefix}-${field.key}`}
              field={field}
              value={values[field.key]}
              searchDraft={searchDrafts[field.key] ?? ""}
              lang={lang}
              disabled={disabled}
              disabledReason={disabledReason}
              error={
                validationFailure
                  ? lang === "ar"
                    ? validationFailure.messageAr
                    : validationFailure.messageEn
                  : undefined
              }
              onSearchChange={(value) => setSearchValue(field.key, value)}
              onFieldChange={(v) => setFieldValue(field.key, v)}
            />
          );
        })}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={disabledForInitialLoad || activeFields.length === 0}
          className="w-full sm:w-auto"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {lang === "ar" ? "إعادة تعيين" : "Reset"}
        </Button>
      </div>

      {activeFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label={lang === "ar" ? "عوامل التصفية النشطة" : "Active filters"}>
          {activeFields.map((field) => (
            <Button
              key={field.key}
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => clearField(field.key)}
              aria-label={
                lang === "ar"
                  ? `إزالة عامل التصفية ${fieldLabel(field, lang)}: ${fieldValueLabel(field, values[field.key], lang)}`
                  : `Remove ${fieldLabel(field, lang)} filter: ${fieldValueLabel(field, values[field.key], lang)}`
              }
              className="h-auto rounded-full px-2.5 py-1"
            >
              <span className="text-muted-foreground">{fieldLabel(field, lang)}:</span>
              <span>{fieldValueLabel(field, values[field.key], lang)}</span>
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}

function FilterFieldControl({
  id,
  field,
  value,
  searchDraft,
  lang,
  disabled,
  disabledReason,
  error,
  onSearchChange,
  onFieldChange,
}: {
  id: string;
  field: FilterField;
  value: unknown;
  searchDraft: string;
  lang: "ar" | "en";
  disabled?: boolean;
  disabledReason?: string;
  error?: string;
  onSearchChange: (v: string) => void;
  onFieldChange: (v: unknown) => void;
}) {
  const placeholder = lang === "ar" ? field.placeholderAr : field.placeholderEn;
  const label = fieldLabel(field, lang);
  const hint = lang === "ar" ? field.hintAr : field.hintEn;
  const hintId = hint ? `${id}-hint` : undefined;
  const disabledReasonId = disabledReason ? `${id}-disabled-reason` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, disabledReasonId, errorId].filter(Boolean).join(" ") || undefined;

  if (field.type === "search") {
    return (
      <div className="flex min-w-0 flex-col gap-1 xl:min-w-56 xl:flex-1">
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {label}
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={id}
            name={field.key}
            type="search"
            value={searchDraft}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            invalid={Boolean(error)}
            aria-describedby={describedBy}
            className="ps-9"
          />
        </div>
        <FieldSupport
          lang={lang}
          hint={hint}
          hintId={hintId}
          disabledReason={disabledReason}
          disabledReasonId={disabledReasonId}
          error={error}
          errorId={errorId}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="flex min-w-0 flex-col gap-1 xl:min-w-44">
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {label}
        </label>
        <Select
          name={field.key}
          value={value === undefined || value === null ? "" : String(value)}
          onValueChange={onFieldChange}
          disabled={disabled}
        >
          <SelectTrigger id={id} aria-describedby={describedBy} aria-invalid={Boolean(error) || undefined}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {lang === "ar" ? option.labelAr : option.labelEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldSupport
          lang={lang}
          hint={hint}
          hintId={hintId}
          disabledReason={disabledReason}
          disabledReasonId={disabledReasonId}
          error={error}
          errorId={errorId}
        />
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="flex min-w-0 flex-col gap-1 xl:min-w-36">
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {label}
        </label>
        <div className="flex h-(--size-control-lg) items-center gap-2">
          <Switch
            id={id}
            name={field.key}
            checked={Boolean(value)}
            onCheckedChange={onFieldChange}
            disabled={disabled}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
          />
          <span className="text-sm text-foreground">
            {Boolean(value)
              ? lang === "ar"
                ? "مفعّل"
                : "On"
              : lang === "ar"
                ? "غير مفعّل"
                : "Off"}
          </span>
        </div>
        <FieldSupport
          lang={lang}
          hint={hint}
          hintId={hintId}
          disabledReason={disabledReason}
          disabledReasonId={disabledReasonId}
          error={error}
          errorId={errorId}
        />
      </div>
    );
  }

  const range = (value as { from?: string; to?: string } | undefined) ?? {};
  const groupLabel = lang === "ar" ? (field.groupLabelAr ?? label) : (field.groupLabelEn ?? label);
  const fromLabel = lang === "ar" ? (field.fromLabelAr ?? "من") : (field.fromLabelEn ?? "From");
  const toLabel = lang === "ar" ? (field.toLabelAr ?? "إلى") : (field.toLabelEn ?? "To");
  return (
    <fieldset
      className="min-w-0 xl:min-w-80"
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      aria-invalid={Boolean(error) || undefined}
    >
      <legend className="mb-1 text-xs font-medium text-foreground">{groupLabel}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-from`} className="text-xs text-muted-foreground">
            {fromLabel}
          </label>
          <Input
            id={`${id}-from`}
            name={`${field.key}From`}
            type="date"
            value={range.from ?? ""}
            onChange={(event) => onFieldChange({ ...range, from: event.target.value })}
            disabled={disabled}
            invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-to`} className="text-xs text-muted-foreground">
            {toLabel}
          </label>
          <Input
            id={`${id}-to`}
            name={`${field.key}To`}
            type="date"
            value={range.to ?? ""}
            onChange={(event) => onFieldChange({ ...range, to: event.target.value })}
            disabled={disabled}
            invalid={Boolean(error)}
            aria-describedby={describedBy}
          />
        </div>
      </div>
      <div className="mt-1">
        <FieldSupport
          lang={lang}
          hint={hint}
          hintId={hintId}
          disabledReason={disabledReason}
          disabledReasonId={disabledReasonId}
          error={error}
          errorId={errorId}
        />
      </div>
    </fieldset>
  );
}

function FieldSupport({
  lang,
  hint,
  hintId,
  disabledReason,
  disabledReasonId,
  error,
  errorId,
}: {
  lang: "ar" | "en";
  hint?: string;
  hintId?: string;
  disabledReason?: string;
  disabledReasonId?: string;
  error?: string;
  errorId?: string;
}) {
  if (!hint && !disabledReason && !error) return null;

  return (
    <div className="space-y-1 text-xs">
      {hint ? <p id={hintId} className="text-muted-foreground">{hint}</p> : null}
      {disabledReason ? (
        <p id={disabledReasonId} className="text-muted-foreground">
          <span className="font-medium text-foreground">{lang === "ar" ? "غير متاح:" : "Unavailable:"}</span>{" "}
          {disabledReason}
        </p>
      ) : null}
      {error ? <p id={errorId} className="text-destructive">{error}</p> : null}
    </div>
  );
}

function fieldLabel(field: FilterField, lang: "ar" | "en"): string {
  if (field.type === "date-range") {
    const groupLabel = lang === "ar" ? field.groupLabelAr : field.groupLabelEn;
    if (groupLabel) return groupLabel;
  }
  const explicit = lang === "ar" ? field.labelAr : field.labelEn;
  const placeholder = lang === "ar" ? field.placeholderAr : field.placeholderEn;
  if (explicit) return explicit;
  if (field.type === "search" && (!placeholder || placeholder.length > 32)) {
    return lang === "ar" ? "بحث" : "Search";
  }
  if (field.type === "date-range" && !placeholder) return lang === "ar" ? "نطاق التاريخ" : "Date range";
  if (placeholder) return placeholder.replace(/\.{3}$/, "");
  return field.key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
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
  if (field.type === "boolean") {
    return value
      ? lang === "ar"
        ? "مفعّل"
        : "On"
      : lang === "ar"
        ? "غير مفعّل"
        : "Off";
  }
  return String(value);
}
