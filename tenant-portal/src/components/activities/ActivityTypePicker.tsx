"use client";

import { ToggleGroup, ToggleGroupItem } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { ACTIVITY_TYPES } from "./activity-contract";
import { ActivityTypeIcon } from "./ActivityTypeIcon";

export interface ActivityTypePickerProps {
  value: string;
  onChange: (type: string) => void;
  disabled?: boolean;
}

/**
 * The seven types as icon + label tiles — one radio group, arrow keys move
 * between them in reading order. Four to a row on a phone, all seven from
 * `sm` up. The chosen tile is marked by contrast and elevation, never a hue:
 * a type is a category (docs/design/anti-patterns.md#4-hue-coded-controls).
 */
export function ActivityTypePicker({ value, onChange, disabled }: ActivityTypePickerProps) {
  const { t } = useI18n();
  const copy = t.activities;
  return (
    <ToggleGroup
      type="single"
      value={value}
      // A single-select group lets the chosen tile be pressed off; a type is
      // required, so that press is ignored rather than clearing it.
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      disabled={disabled}
      aria-label={copy.form.type}
      className="grid w-full grid-cols-4 gap-1 sm:grid-cols-7"
    >
      {ACTIVITY_TYPES.map((type) => (
        <ToggleGroupItem
          key={type}
          value={type}
          className="h-auto min-w-0 flex-col gap-1 px-1 py-2 text-xs whitespace-normal"
        >
          <ActivityTypeIcon type={type} size="lg" />
          <span className="max-w-full text-center break-words">{copy.types[type]}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
