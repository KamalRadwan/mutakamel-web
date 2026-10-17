"use client";

import { useId, type ReactNode } from "react";
import { Calendar, Clock, X } from "lucide-react";
import {
  Button,
  cn,
  DatePicker,
  Field,
  FieldControlBoundary,
  Input,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { ACTIVITY_MAX_DURATION_DAYS } from "./activity-contract";
import {
  activityFormDurationMinutes,
  fromLocalDate,
  isActivityFieldModified,
  toLocalDate,
  type ActivityDatePreset,
} from "./activity-form";
import { activityValidationMessage } from "./activity-form-rules";
import { activityTypePalette, activityTypeTraits } from "./activity-presentation";
import type { ActivityFormState } from "./hooks/useActivityFormState";

export interface ActivityScheduleFieldsProps {
  form: ActivityFormState;
  disabled: boolean;
  mode?: "create" | "edit";
  assigneeSlot?: ReactNode;
}

const DATE_PRESETS: readonly ActivityDatePreset[] = [
  "todayEvening",
  "tomorrowMorning",
  "inTwoDays",
  "nextWeek",
];

const DURATION_PRESETS: ReadonlyArray<{ minutes: number; key: "m15" | "m30" | "h1" | "h1_5" | "h2" }> = [
  { minutes: 15, key: "m15" },
  { minutes: 30, key: "m30" },
  { minutes: 60, key: "h1" },
  { minutes: 90, key: "h1_5" },
  { minutes: 120, key: "h2" },
];

function isDatePresetActive(preset: ActivityDatePreset, startDate: string): boolean {
  if (!startDate) return false;
  const target = new Date();
  const offsetDays =
    preset === "todayEvening"
      ? 0
      : preset === "tomorrowMorning"
        ? 1
        : preset === "inTwoDays"
          ? 2
          : 7;
  target.setDate(target.getDate() + offsetDays);
  return startDate === toLocalDate(target);
}

/**
 * When the activity happens: a day picker and a clock time per edge, in the
 * viewer's own zone, wrapped in a structured Schedule & Assignment card with
 * quick date or duration presets.
 */
export function ActivityScheduleFields({
  form,
  disabled,
  mode = "create",
  assigneeSlot,
}: ActivityScheduleFieldsProps) {
  const { t } = useI18n();
  const copy = t.activities;
  const id = useId();
  const { values, seed, errors } = form;
  const traits = activityTypeTraits(values.type);
  const palette = activityTypePalette(values.type);
  const startLabel = traits.startLabel === "start" ? copy.form.start : copy.form.dueDateTime;
  const hasEnd = values.endDate !== "" || values.endTime !== "";
  const activeDuration = activityFormDurationMinutes(values);
  const startModified = mode === "edit" && isActivityFieldModified(values, seed, "start");
  const endModified = mode === "edit" && isActivityFieldModified(values, seed, "end");

  const cardHeading =
    mode === "edit"
      ? copy.form.rescheduleWindow
      : values.type === "MEETING"
        ? copy.form.meetingWindow
        : values.type === "CALL"
          ? copy.form.callTimeDuration
          : traits.hasEnd
            ? copy.form.windowTitle
            : copy.form.scheduleTitle;

  const visibleDurationPresets =
    values.type === "CALL"
      ? DURATION_PRESETS
      : DURATION_PRESETS.filter((preset) => preset.minutes >= 30);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
      <span id={`${id}-time`} className="sr-only">
        {copy.form.time}
      </span>

      {/* Schedule Header + Quick Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {mode === "edit" || !traits.hasEnd ? (
            <Calendar
              className={cn(
                iconSize({ size: "sm" }),
                mode === "edit" ? "text-warning-subtle-foreground" : palette.iconText,
              )}
              aria-hidden="true"
            />
          ) : (
            <Clock className={cn(iconSize({ size: "sm" }), palette.iconText)} aria-hidden="true" />
          )}
          <span className="text-xs font-semibold text-foreground">{cardHeading}</span>
          {traits.hasEnd && (
            <span className="text-2xs font-medium text-muted-foreground">
              · {formatTemplate(copy.form.maxWindowHint, { days: ACTIVITY_MAX_DURATION_DAYS })}
            </span>
          )}
        </div>

        {/* Presets Bar */}
        {traits.hasEnd ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-2xs font-medium text-muted-foreground">{copy.form.durationLabel}</span>
            {visibleDurationPresets.map((preset) => {
              const isSelected = activeDuration === preset.minutes;
              const isDefault = mode === "create" && traits.defaultMinutes === preset.minutes;
              return (
                <Button
                  key={preset.key}
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={disabled}
                  onClick={() => form.setDurationMinutes(preset.minutes)}
                  className={cn(
                    "h-6 rounded-full px-2.5 text-2xs font-semibold tabular-nums",
                    isSelected
                      ? mode === "edit"
                        ? "border-warning/50 bg-warning-subtle text-warning-subtle-foreground"
                        : "border-primary bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 hover:text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary hover:bg-selected hover:text-primary",
                  )}
                >
                  {copy.form.durations[preset.key]}
                  {isSelected && isDefault ? ` (${copy.form.defaultSuffix})` : ""}
                </Button>
              );
            })}
            {hasEnd && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={disabled}
                onClick={form.clearEnd}
                className="h-6 rounded-full border-border bg-card px-2.5 text-2xs font-semibold text-muted-foreground hover:border-destructive/40 hover:bg-destructive-subtle hover:text-destructive-subtle-foreground"
              >
                {copy.form.clearEndShort}
              </Button>
            )}
          </div>
        ) : values.status !== "DONE" ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {DATE_PRESETS.map((preset) => {
              const isSelected = isDatePresetActive(preset, values.startDate);
              return (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={disabled}
                  onClick={() => form.setDatePreset(preset)}
                  className={cn(
                    "h-6 rounded-full px-2.5 text-2xs font-semibold",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 hover:text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary hover:bg-selected hover:text-primary",
                  )}
                >
                  {copy.form.presets[preset]}
                </Button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Date / Time / Assignee Grid */}
      <div className={cn("grid gap-3", traits.hasEnd ? "md:grid-cols-2" : assigneeSlot ? "md:grid-cols-2" : undefined)}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span id={`${id}-start`} aria-hidden="true" className="text-xs font-semibold text-foreground">
              {startLabel} <span className="text-destructive">*</span>
            </span>
            {startModified && (
              <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning-subtle px-1.5 py-0.5 text-2xs font-semibold text-warning-subtle-foreground">
                {copy.form.modified}
              </span>
            )}
          </div>
          <Field label={startLabel} error={activityValidationMessage(copy, "start", errors.start)} required>
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] items-start gap-2">
              <div className="min-w-0">
                <DatePicker
                  size="sm"
                  value={fromLocalDate(values.startDate)}
                  onValueChange={(date) => form.setStart({ startDate: date ? toLocalDate(date) : "" })}
                  onBlur={() => form.touch("start")}
                  placeholder={copy.form.datePlaceholder}
                  disabled={disabled}
                />
              </div>
              <FieldControlBoundary>
                {/* dir="ltr" on the control only: the browser owns a time input's
                    segment order, and mirroring it swaps the hour and the minute. */}
                <Input
                  size="sm"
                  type="time"
                  dir="ltr"
                  className="w-full bg-card"
                  value={values.startTime}
                  onChange={(event) => form.setStart({ startTime: event.target.value })}
                  onBlur={() => form.touch("start")}
                  aria-labelledby={`${id}-start ${id}-time`}
                  aria-invalid={errors.start ? true : undefined}
                  required
                  disabled={disabled}
                />
              </FieldControlBoundary>
            </div>
          </Field>
        </div>

        {traits.hasEnd && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span id={`${id}-end`} aria-hidden="true" className="text-xs font-semibold text-foreground">
                {copy.form.end} <span className="font-normal text-muted-foreground">· {copy.form.endOptional}</span>
              </span>
              {endModified && (
                <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning-subtle px-1.5 py-0.5 text-2xs font-semibold text-warning-subtle-foreground">
                  {copy.form.modified}
                </span>
              )}
            </div>
            <Field label={`${copy.form.end} (${copy.form.endOptional})`} error={activityValidationMessage(copy, "end", errors.end)}>
              <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] items-start gap-2">
                <div className="min-w-0">
                  <DatePicker
                    size="sm"
                    value={fromLocalDate(values.endDate)}
                    onValueChange={(date) => form.setField("endDate", date ? toLocalDate(date) : "")}
                    onBlur={() => form.touch("end")}
                    placeholder={copy.form.datePlaceholder}
                    disabled={disabled}
                  />
                </div>
                <FieldControlBoundary>
                  <div className="flex items-center gap-1">
                    <Input
                      size="sm"
                      type="time"
                      dir="ltr"
                      className="w-full bg-card"
                      value={values.endTime}
                      onChange={(event) => form.setField("endTime", event.target.value)}
                      onBlur={() => form.touch("end")}
                      aria-labelledby={`${id}-end ${id}-time`}
                      aria-invalid={errors.end ? true : undefined}
                      disabled={disabled}
                    />
                    {hasEnd && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              aria-label={copy.form.clearEnd}
                              onClick={form.clearEnd}
                              disabled={disabled}
                            >
                              <X className={iconSize({ size: "xs" })} aria-hidden="true" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{copy.form.clearEnd}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </FieldControlBoundary>
              </div>
            </Field>
          </div>
        )}

        {assigneeSlot && (
          <div className={cn(traits.hasEnd && "md:col-span-2")}>{assigneeSlot}</div>
        )}
      </div>
    </div>
  );
}
