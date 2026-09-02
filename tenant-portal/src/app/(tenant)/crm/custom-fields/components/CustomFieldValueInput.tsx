"use client";

import {
  Input,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import type { CustomFieldItem } from "../custom-field-contract";

interface CustomFieldValueInputProps {
  field: CustomFieldItem;
  value: unknown;
  disabled: boolean;
  onChange: (next: unknown) => void;
}

/**
 * Renders one custom-field value with the primitive its type declares —
 * docs/reference/enums.md#crmcustomfieldtypeenum.
 *
 * The JS type of what is SENT is the contract, not a formatting choice:
 * `assertValueMatchesDefinition` requires a string for the text family, a
 * `number` for NUMBER, a `boolean` for BOOLEAN, a parseable date string for
 * DATE/DATETIME, one active option key for SELECT and an array of them for
 * MULTI_SELECT. Anything else is a 422 CUSTOM_FIELD_VALUE_INVALID.
 */
export function CustomFieldValueInput({
  field,
  value,
  disabled,
  onChange,
}: CustomFieldValueInputProps) {
  const { t, lang } = useI18n();

  if (field.type === "BOOLEAN") {
    return (
      <div className="flex items-center gap-2">
        {/* No aria-label: the enclosing `Field` already renders this exact
            string as a real <label>, and an aria-label would outrank it. Every
            branch below is named the same way — each returns a design-system
            primitive, and the primitive claims the field itself. */}
        <Switch checked={value === true} disabled={disabled} onCheckedChange={onChange} />
        <span className="text-sm text-foreground">
          {value === true ? t.common.active : t.common.inactive}
        </span>
      </div>
    );
  }

  if (field.type === "TEXTAREA") {
    return (
      <Textarea
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === "NUMBER") {
    return (
      <Input
        type="number"
        className="tabular-nums"
        value={typeof value === "number" ? String(value) : ""}
        disabled={disabled}
        onChange={(event) => {
          // A number the user just typed, not a decimal off the wire — the
          // DTO requires a JS number here, and S5's "never Number() a decimal
          // string" is about preserving server precision, which this is not.
          const next = event.target.value;
          onChange(next === "" ? null : Number(next));
        }}
      />
    );
  }

  if (field.type === "SELECT" || field.type === "MULTI_SELECT") {
    const options = field.options
      .filter((option) => option.isActive)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((option) => ({
        value: option.key,
        label: localizedValue(option.nameAr, option.nameEn, lang),
      }));

    if (field.type === "MULTI_SELECT") {
      return (
        <MultiSelect
          values={Array.isArray(value) ? (value as string[]) : []}
          onValuesChange={onChange}
          options={options}
          disabled={disabled}
          placeholder={t.crmCustomFields.valuePlaceholder}
          emptyLabel={t.crmCustomFields.noOptions}
          moreLabel={t.crmPipelines.moreChips}
          removeLabel={t.crmPipelines.removeChip}
          overflowLabel={t.crmPipelines.overflowChips}
        />
      );
    }

    return (
      <Select
        value={typeof value === "string" && value ? value : undefined}
        disabled={disabled || options.length === 0}
        onValueChange={onChange}
      >
        <SelectTrigger>
          <SelectValue placeholder={t.crmCustomFields.valuePlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const inputType =
    field.type === "DATE"
      ? "date"
      : field.type === "DATETIME"
        ? "datetime-local"
        : field.type === "EMAIL"
          ? "email"
          : field.type === "URL"
            ? "url"
            : field.type === "PHONE"
              ? "tel"
              : "text";

  return (
    <Input
      type={inputType}
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
