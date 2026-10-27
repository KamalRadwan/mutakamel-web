"use client";

import {
  DatePicker,
  Input,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { fromIsoDate, toIsoDate } from "../iso-date";
import {
  crmOperatorTakesManyValues,
  crmOperatorTakesNoValue,
  crmOperatorTakesTwoValues,
  type CrmSearchCondition,
  type CrmSearchFieldDef,
} from "../search/filter-tree";
import type { CrmSearchCatalogueOption } from "./CrmAdvancedSearchCard";

interface CrmSearchValueControlProps<Id extends string> {
  condition: CrmSearchCondition<Id>;
  definition: CrmSearchFieldDef<Id>;
  label: string;
  enumLabel: (field: Id, wireValue: string) => string;
  catalogueOptions: (field: Id) => readonly CrmSearchCatalogueOption[];
  disabled?: boolean;
  onPatch: (patch: Partial<CrmSearchCondition<Id>>) => void;
}

/**
 * The value half of a condition: nothing, one control, a list, or a pair.
 *
 * Widths are deliberately compact — the card lays every AND-ed condition of a
 * group on one line, so a value box sized for a form field would push the
 * second condition onto a line of its own.
 */
export function CrmSearchValueControl<Id extends string>({
  condition,
  definition,
  label,
  enumLabel,
  catalogueOptions,
  disabled,
  onPatch,
}: CrmSearchValueControlProps<Id>) {
  const { t, lang } = useI18n();
  const copy = t.crmAdvancedSearch;

  // `isNull`/`isNotNull` carry NO value key at all; the compiler drops it and
  // the row must not offer a box that would silently be ignored.
  if (crmOperatorTakesNoValue(condition.operator)) {
    return <span className="text-2xs text-muted-foreground">{copy.noValueNeeded}</span>;
  }

  if (crmOperatorTakesManyValues(condition.operator)) {
    // Scalar lists without a catalogue are typed as comma-separated values.
    // The compiler converts number parts while preserving text, dates and ids.
    if (definition.kind !== "enum" && definition.kind !== "catalogue") {
      return (
        <Input
          size="sm"
          className={cn("w-48", definition.kind === "uuid" && "font-mono")}
          dir={definition.kind === "uuid" || definition.kind === "date" ? "ltr" : undefined}
          inputMode={definition.kind === "number" ? "decimal" : undefined}
          value={condition.value}
          disabled={disabled}
          placeholder={copy.listPlaceholder}
          aria-label={label}
          onChange={(event) => onPatch({ value: event.target.value })}
        />
      );
    }

    const selectable =
      definition.kind === "enum"
        ? (definition.values ?? []).map((wireValue) => ({
            value: wireValue,
            label: enumLabel(definition.id, wireValue),
          }))
        : catalogueOptions(definition.id).map((option) => ({
            value: option.id,
            label: option.label,
          }));

    return (
      <MultiSelect
        className="w-48"
        values={splitList(condition.value)}
        options={selectable}
        disabled={disabled || selectable.length === 0}
        placeholder={selectable.length > 0 ? copy.selectValue : copy.catalogueUnavailable}
        emptyLabel={copy.catalogueUnavailable}
        moreLabel={copy.multiMore}
        removeLabel={copy.multiRemove}
        overflowLabel={copy.multiOverflow}
        clearAllLabel={`${copy.multiClearAll}: ${label}`}
        ariaLabel={label}
        onValuesChange={(next) => onPatch({ value: next.join(",") })}
      />
    );
  }

  const isRange = crmOperatorTakesTwoValues(condition.operator);
  // A range's two boxes would otherwise share one name.
  const fromLabel = isRange ? `${label} — ${copy.valueFrom}` : label;
  const toLabel = `${label} — ${copy.valueTo}`;

  if (definition.kind === "date") {
    return (
      <>
        <DatePicker
          className="w-40"
          value={fromIsoDate(condition.value)}
          language={lang}
          disabled={disabled}
          placeholder={isRange ? copy.valueFrom : copy.datePlaceholder}
          ariaLabel={fromLabel}
          clearLabel={`${copy.clearDate}: ${fromLabel}`}
          onValueChange={(next) => onPatch({ value: toIsoDate(next) })}
        />
        {isRange && (
          <DatePicker
            className="w-40"
            value={fromIsoDate(condition.valueTo)}
            language={lang}
            disabled={disabled}
            placeholder={copy.valueTo}
            ariaLabel={toLabel}
            clearLabel={`${copy.clearDate}: ${toLabel}`}
            onValueChange={(next) => onPatch({ valueTo: toIsoDate(next) })}
          />
        )}
      </>
    );
  }

  if (definition.kind === "number") {
    return (
      <>
        <Input
          size="sm"
          className="w-24 tabular-nums"
          dir="ltr"
          inputMode="decimal"
          value={condition.value}
          disabled={disabled}
          placeholder={isRange ? copy.valueFrom : copy.numberPlaceholder}
          aria-label={fromLabel}
          onChange={(event) => onPatch({ value: event.target.value })}
        />
        {isRange && (
          <Input
            size="sm"
            className="w-24 tabular-nums"
            dir="ltr"
            inputMode="decimal"
            value={condition.valueTo}
            disabled={disabled}
            placeholder={copy.valueTo}
            aria-label={toLabel}
            onChange={(event) => onPatch({ valueTo: event.target.value })}
          />
        )}
      </>
    );
  }

  if (definition.kind === "enum" || definition.kind === "catalogue") {
    const options =
      definition.kind === "enum"
        ? (definition.values ?? []).map((wireValue) => ({
            id: wireValue,
            label: enumLabel(definition.id, wireValue),
          }))
        : catalogueOptions(definition.id);
    const hasOptions = options.length > 0;

    return (
      <Select
        value={condition.value}
        disabled={disabled || !hasOptions}
        onValueChange={(next) => onPatch({ value: next })}
      >
        <SelectTrigger size="sm" className="w-40" aria-label={label}>
          <SelectValue placeholder={hasOptions ? copy.selectValue : copy.catalogueUnavailable} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {("content" in option && option.content) || option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // `uuid` and `text` alike: a single box. A uuid is typed left-to-right in
  // both languages, which `dir="ltr"` is what states.
  return (
    <Input
      size="sm"
      className={cn("w-40", definition.kind === "uuid" && "font-mono")}
      dir={definition.kind === "uuid" ? "ltr" : undefined}
      value={condition.value}
      disabled={disabled}
      maxLength={definition.maxLength}
      placeholder={definition.kind === "uuid" ? copy.uuidPlaceholder : copy.textValuePlaceholder}
      aria-label={label}
      onChange={(event) => onPatch({ value: event.target.value })}
    />
  );
}

/** The comma-joined list a multi-value row stores, back as its parts. */
function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
