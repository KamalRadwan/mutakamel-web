"use client";

import {
  Combobox,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { ActivityScope, ActivityTargetSelection } from "./activity-contract";
import { activityLabel } from "./activity-presentation";
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
}

/**
 * The record an activity is about, for a create that was not opened from one:
 * a record type, then a search over the records of that type the actor could
 * book an activity on. Changing the type drops a record of the old type.
 */
export function ActivityTargetField({ scope, branchId, value, onChange, onBlur, error, disabled }: ActivityTargetFieldProps) {
  const { t } = useI18n();
  const copy = t.activities;
  const picker = useActivityTargetOptions(scope, value, branchId);

  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">{copy.form.relatedTo}</span>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
        <Field label={copy.form.relatedType}>
          <Select
            value={picker.kind.type}
            onValueChange={(type) => {
              picker.chooseKind(type);
              if (value && value.type !== type) onChange(null);
            }}
            disabled={disabled}
          >
            <SelectTrigger size="sm">
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
        <Field label={copy.form.relatedRecord} error={error} required>
          <Combobox
            value={value?.id}
            selectedLabel={value?.label}
            onValueChange={(id) => {
              const option = picker.options.find((candidate) => candidate.targetId === id);
              onChange(option
                ? { app: picker.kind.app, type: picker.kind.type, id: option.targetId, label: option.label }
                : null);
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
