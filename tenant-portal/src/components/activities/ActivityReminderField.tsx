"use client";

import { Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { activityValidationMessage } from "./activity-form-rules";
import type { ActivityFormState } from "./hooks/useActivityFormState";

export function ActivityReminderField({ form, disabled }: { form: ActivityFormState; disabled: boolean }) {
  const { t } = useI18n();
  return (
    <Field
      showLabel
      label={t.activities.form.reminderOffsetMinutes}
      hint={t.activities.form.reminderHint}
      error={activityValidationMessage(t.activities, "reminderOffsetMinutes", form.errors.reminderOffsetMinutes)}
    >
      <Input
        size="sm"
        type="number"
        min={0}
        max={2147483647}
        step={1}
        value={form.values.reminderOffsetMinutes}
        onChange={(event) => form.setField("reminderOffsetMinutes", event.target.value)}
        onBlur={() => form.touch("reminderOffsetMinutes")}
        disabled={disabled}
      />
    </Field>
  );
}
