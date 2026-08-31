"use client";

import { useMemo, useState } from "react";
import { Combobox, Input, type ComboboxOption } from "@/design-system";

export interface CatalogueEntry {
  key: string;
  en: string;
  ar: string;
}

interface CatalogueSelectProps {
  id: string;
  name?: string;
  /** The stored free-text value, which is what Core persists. */
  value: string;
  onChange: (value: string) => void;
  entries: readonly CatalogueEntry[];
  /** Resolves a stored value back to an entry, or null when it is custom. */
  match: (value: string) => CatalogueEntry | null;
  lang: string;
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  otherLabel: string;
  otherPlaceholder: string;
  /** Keep catalogue order (most-common first) instead of sorting the list. */
  preserveOrder?: boolean;
  maxLength?: number;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

const OTHER_KEY = "__other__";

/**
 * A curated picker that still accepts anything.
 *
 * Core stores these fields as free text, so the catalogue is a consistency
 * aid rather than a constraint. Choosing "Other" reveals a text field beside
 * the list rather than replacing it, so it stays obvious that the value is
 * outside the catalogue.
 */
export function CatalogueSelect({
  id,
  name,
  value,
  onChange,
  entries,
  match,
  lang,
  label,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  otherLabel,
  otherPlaceholder,
  preserveOrder = false,
  maxLength = 160,
  disabled = false,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: CatalogueSelectProps) {
  const matched = match(value);
  // A stored value outside the catalogue is "Other" with the text preserved,
  // so editing an existing record never silently discards it.
  const [isOther, setIsOther] = useState(() => Boolean(value) && !matched);

  const options = useMemo<ComboboxOption[]>(() => {
    const mapped = entries.map((entry) => ({
      value: entry.key,
      label: lang === "ar" ? entry.ar : entry.en,
      keywords: [entry.en, entry.ar, entry.key],
    }));
    if (!preserveOrder) {
      mapped.sort((left, right) => left.label.localeCompare(right.label));
    }
    return [...mapped, { value: OTHER_KEY, label: otherLabel, keywords: ["other", "أخرى"] }];
  }, [entries, lang, otherLabel, preserveOrder]);

  const selectedKey = isOther ? OTHER_KEY : (matched?.key ?? "");

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <Combobox
        id={id}
        value={selectedKey}
        options={options}
        onValueChange={(key) => {
          if (key === OTHER_KEY) {
            setIsOther(true);
            // Start the free-text field empty rather than pre-filled with the
            // catalogue entry that was just deselected.
            onChange("");
            return;
          }
          setIsOther(false);
          const entry = entries.find((candidate) => candidate.key === key);
          // The English label is what reaches the API, so retranslating a
          // label can never repartition existing records.
          if (entry) onChange(entry.en);
        }}
        label={label}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyLabel={emptyLabel}
        disabled={disabled}
        preferDownward
        className={isOther ? "sm:w-48 sm:shrink-0" : "w-full"}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
      />
      {isOther ? (
        <Input
          id={`${id}-other`}
          name={name}
          type="text"
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          placeholder={otherPlaceholder}
          aria-label={otherPlaceholder}
          className="flex-1"
          aria-invalid={ariaInvalid}
        />
      ) : (
        <input type="hidden" name={name} value={value} />
      )}
    </div>
  );
}
