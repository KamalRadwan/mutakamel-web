"use client";

import { cn, ToggleGroup, ToggleGroupItem } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { ACTIVITY_TYPES } from "./activity-contract";
import { activityTypePalette } from "./activity-presentation";
import { ActivityTypeIcon } from "./ActivityTypeIcon";

export interface ActivityTypePickerProps {
  value: string;
  onChange: (type: string) => void;
  disabled?: boolean;
  modified?: boolean;
  mode?: "create" | "edit";
}

/**
 * The seven types as colorful icon + label tiles — one radio group, arrow keys
 * move between them in reading order. Shows a dynamic traits hint for the
 * selected activity type.
 */
export function ActivityTypePicker({ value, onChange, disabled, modified, mode = "create" }: ActivityTypePickerProps) {
  const { t } = useI18n();
  const copy = t.activities;

  const traitSummary =
    mode === "edit"
      ? copy.form.traitEditNotice
      : value === "TODO"
        ? copy.form.traitSummaryTask
        : value === "MEETING"
          ? copy.form.traitSummaryMeeting
          : value === "CALL"
            ? copy.form.traitSummaryCall
            : value === "VISIT"
              ? copy.form.traitSummaryVisit
              : value === "EMAIL"
                ? copy.form.traitSummaryEmail
                : value === "FOLLOW_UP"
                  ? copy.form.traitSummaryFollowUp
                  : copy.form.traitSummaryOther;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            {copy.form.type} <span className="text-destructive">*</span>
          </span>
          {modified && (
            <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning-subtle px-1.5 py-0.5 text-2xs font-semibold text-warning-subtle-foreground">
              {copy.form.modified}
            </span>
          )}
        </div>
        <span
          className={cn(
            "text-2xs",
            mode === "create" && value !== "TODO"
              ? cn("font-semibold", activityTypePalette(value).iconText)
              : "font-medium text-muted-foreground",
          )}
        >
          {traitSummary}
        </span>
      </div>

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
        className="grid w-full grid-cols-4 gap-2 sm:grid-cols-7"
      >
        {ACTIVITY_TYPES.map((type) => {
          const selected = value === type;
          const palette = activityTypePalette(type);
          return (
            <ToggleGroupItem
              key={type}
              value={type}
              className={cn(
                "relative h-auto min-h-14 min-w-0 flex-col gap-1 rounded-lg border px-1.5 py-2 text-xs font-semibold whitespace-normal transition-all",
                "data-[state=on]:bg-transparent data-[state=on]:text-current",
                selected ? palette.tileActive : palette.tileIdle,
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-md border transition-colors",
                  selected ? palette.iconBoxActive : palette.iconBoxIdle,
                )}
              >
                <ActivityTypeIcon type={type} size="lg" className="size-4.5" />
              </span>
              <span className="max-w-full text-center text-xs font-semibold leading-tight break-words">
                {copy.types[type]}
              </span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
