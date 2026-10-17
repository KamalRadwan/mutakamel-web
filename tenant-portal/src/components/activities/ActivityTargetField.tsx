"use client";

import { Link2, Lock } from "lucide-react";
import {
  Button,
  cn,
  Combobox,
  Field,
  iconSize,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { ActivityScope, ActivityTargetSelection } from "./activity-contract";
import { activityLabel, activityTargetTypeBadgeClasses } from "./activity-presentation";
import { useActivityTargetOptions } from "./hooks/useActivityTargetOptions";

export interface ActivityTargetFieldProps {
  scope: ActivityScope;
  /** Narrows the search to one branch; null searches every branch the actor may act in. */
  branchId?: string | null;
  value: ActivityTargetSelection | null;
  onChange: (target: ActivityTargetSelection | null) => void;
  onBlur: () => void;
  error?: string;
  disabled: boolean;
  /** When true (e.g. in Edit mode), renders the fixed target as a locked read-only banner. */
  locked?: boolean;
}

/**
 * The record an activity is about:
 * - On create (`locked = false`), shows colorful target-type quick pills +
 *   explicitly labeled Record Type and Record search controls.
 * - On edit (`locked = true`), shows the immutable target record (`UpdateActivityDto`
 *   does not mutate `target`).
 */
export function ActivityTargetField({
  scope,
  branchId,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  locked = false,
}: ActivityTargetFieldProps) {
  const { t } = useI18n();
  const copy = t.activities;
  const picker = useActivityTargetOptions(scope, value, branchId);

  if (locked && value) {
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">{copy.form.relatedTo}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-2xs font-semibold text-muted-foreground">
            <Lock className={iconSize({ size: "xs" })} aria-hidden="true" />
            {copy.form.lockedTarget}
          </span>
        </div>
        <div className="flex min-h-8 items-center justify-between gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-2xs font-semibold",
                activityTargetTypeBadgeClasses(value.type, true),
              )}
            >
              {activityLabel(copy, "targetTypes", value.type)}
            </span>
            <span className="truncate text-xs font-semibold text-foreground">
              {value.label ?? value.id}
            </span>
          </div>
          <Lock className={cn(iconSize({ size: "xs" }), "shrink-0 text-muted-foreground")} aria-hidden="true" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-swatch-indigo/25 bg-swatch-indigo/5 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Link2 className={cn(iconSize({ size: "sm" }), "text-swatch-indigo")} aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground">
            {copy.form.relatedTo} <span className="text-destructive">*</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {picker.kinds.map((kind) => {
            const active = picker.kind.type === kind.type;
            return (
              <Button
                key={`pill-${kind.type}`}
                type="button"
                variant="outline"
                size="xs"
                disabled={disabled}
                onClick={() => {
                  picker.chooseKind(kind.type);
                  if (value && value.type !== kind.type) onChange(null);
                }}
                className={cn(
                  "h-6 rounded-full px-2.5 text-2xs font-semibold",
                  activityTargetTypeBadgeClasses(kind.type, active),
                )}
              >
                {activityLabel(copy, "targetTypes", kind.type)}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <Field label={copy.form.relatedType} showLabel>
          <Select
            value={picker.kind.type}
            onValueChange={(type) => {
              picker.chooseKind(type);
              if (value && value.type !== type) onChange(null);
            }}
            disabled={disabled}
          >
            <SelectTrigger size="sm" className="bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {picker.kinds.map((kind) => (
                <SelectItem key={kind.type} value={kind.type}>
                  {activityLabel(copy, "targetTypes", kind.type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={copy.form.relatedRecord} error={error} required showLabel>
          <Combobox
            size="sm"
            value={value?.id}
            selectedLabel={value?.label}
            leadingSlot={
              value ? (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 text-2xs font-semibold",
                    activityTargetTypeBadgeClasses(value.type, true),
                  )}
                >
                  {activityLabel(copy, "targetTypes", value.type)}
                </span>
              ) : undefined
            }
            onValueChange={(id) => {
              const option = picker.options.find((candidate) => candidate.targetId === id);
              onChange(
                option
                  ? { app: picker.kind.app, type: picker.kind.type, id: option.targetId, label: option.label }
                  : null,
              );
            }}
            options={picker.options.map((option) => ({ value: option.targetId, label: option.label }))}
            onSearch={picker.search}
            loading={picker.isLoading}
            placeholder={copy.form.relatedRecordPlaceholder}
            searchPlaceholder={copy.form.relatedSearchPlaceholder}
            loadingLabel={copy.form.relatedLoading}
            emptyLabel={picker.failed ? copy.form.relatedUnavailable : copy.form.relatedEmpty}
            onBlur={onBlur}
            disabled={disabled}
          />
        </Field>
      </div>
    </div>
  );
}
