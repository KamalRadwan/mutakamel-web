"use client";

import { useId } from "react";
import { X } from "lucide-react";
import {
  Button,
  cn,
  DatePicker,
  Field,
  FieldControlBoundary,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { fromLocalDate, toLocalDate } from "./activity-form";
import { activityValidationMessage } from "./activity-form-rules";
import { activityTypeTraits } from "./activity-presentation";
import type { ActivityFormState } from "./hooks/useActivityFormState";

export interface ActivityScheduleFieldsProps {
  form: ActivityFormState;
  disabled: boolean;
}

/**
 * When the activity happens: a day picker and a clock time per edge, in the
 * viewer's own zone. A call or a meeting has a start and an optional end; a
 * task has one due moment.
 *
 * One `Field` per edge names the day picker. The time input beside it opts out
 * of that field and is named by the visible caption plus "Time", so a screen
 * reader hears "Start Time" and "End Time" rather than two identical "Time"s.
 */
export function ActivityScheduleFields({ form, disabled }: ActivityScheduleFieldsProps) {
  const { t } = useI18n();
  const copy = t.activities;
  const id = useId();
  const { values, errors } = form;
  const traits = activityTypeTraits(values.type);
  const startLabel = traits.startLabel === "start" ? copy.form.start : copy.form.due;
  const hasEnd = values.endDate !== "" || values.endTime !== "";

  return (
    <div className={cn("grid gap-2", traits.hasEnd && "md:grid-cols-2")}>
      <span id={`${id}-time`} className="sr-only">{copy.form.time}</span>
      <div className="flex flex-col gap-1">
        <span id={`${id}-start`} aria-hidden="true" className="text-xs font-medium text-muted-foreground">
          {startLabel} <span className="text-destructive">*</span>
        </span>
        <Field label={startLabel} error={activityValidationMessage(copy, "start", errors.start)} required>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1.5">
            <div className="min-w-0">
              <DatePicker
                size="xs"
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
                size="xs"
                type="time"
                dir="ltr"
                className="w-28"
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
        <div className="flex flex-col gap-1">
          <span id={`${id}-end`} aria-hidden="true" className="text-xs font-medium text-muted-foreground">
            {copy.form.end} <span className="font-normal">· {copy.form.endOptional}</span>
          </span>
          <Field label={`${copy.form.end} (${copy.form.endOptional})`} error={activityValidationMessage(copy, "end", errors.end)}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1.5">
              <div className="min-w-0">
                <DatePicker
                  size="xs"
                  value={fromLocalDate(values.endDate)}
                  onValueChange={(date) => form.setField("endDate", date ? toLocalDate(date) : "")}
                  onBlur={() => form.touch("end")}
                  placeholder={copy.form.datePlaceholder}
                  disabled={disabled}
                />
              </div>
              <FieldControlBoundary>
                <div className="flex items-center gap-0.5">
                  <Input
                    size="xs"
                    type="time"
                    dir="ltr"
                    className="w-28"
                    value={values.endTime}
                    onChange={(event) => form.setField("endTime", event.target.value)}
                    onBlur={() => form.touch("end")}
                    aria-labelledby={`${id}-end ${id}-time`}
                    aria-invalid={errors.end ? true : undefined}
                    disabled={disabled}
                  />
                  {hasEnd && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="xs" aria-label={copy.form.clearEnd} onClick={form.clearEnd} disabled={disabled}>
                          <X className={iconSize({ size: "xs" })} aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{copy.form.clearEnd}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </FieldControlBoundary>
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}
