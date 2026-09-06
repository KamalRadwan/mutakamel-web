"use client";

import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  LEAD_ACTIVITY_DESCRIPTION_MAX,
  LEAD_ACTIVITY_PRIORITIES,
  LEAD_ACTIVITY_SUBJECT_MAX,
  LEAD_ACTIVITY_TYPES,
  type LeadActivityErrors,
  type LeadActivityForm,
} from "../../lead-activity-contract";

export interface LeadActivityCreateFormProps {
  values: LeadActivityForm;
  onChange: (patch: Partial<LeadActivityForm>) => void;
  errors: LeadActivityErrors;
  disabled: boolean;
}

/**
 * The dialog's trailing half: one new activity on this lead.
 *
 * Five fields and no target picker — the lead is the target, fixed by the card
 * the dialog was opened from, so there is nothing here that could point the
 * activity somewhere else. Every control is wrapped in `Field`, which is what
 * gives it a real `<label for>`: the visible prompt riding in the placeholder
 * is only the LOOK of that label, never a substitute for it.
 */
export function LeadActivityCreateForm({
  values,
  onChange,
  errors,
  disabled,
}: LeadActivityCreateFormProps) {
  const { t } = useI18n();
  const copy = t.crmLeads.activities;

  function messageFor(field: "subject" | "dueAt"): string | undefined {
    const code = errors[field];
    if (!code) return undefined;
    if (code === "maxLength") {
      return formatTemplate(copy.errors.maxLength, { max: LEAD_ACTIVITY_SUBJECT_MAX });
    }
    return copy.errors[code];
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label={copy.typeLabel} required>
        <Select
          value={values.type}
          onValueChange={(value) => onChange({ type: value as LeadActivityForm["type"] })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_ACTIVITY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {copy.types[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={copy.subject} error={messageFor("subject")} required>
        <Input
          value={values.subject}
          onChange={(event) => onChange({ subject: event.target.value })}
          maxLength={LEAD_ACTIVITY_SUBJECT_MAX}
          disabled={disabled}
          required
        />
      </Field>

      {/* dir="ltr" on the control only: a datetime-local's segment order is
          the browser's, and mirroring the box puts the year where the day
          belongs. The label beside it still reads right-to-left. */}
      <Field label={copy.dueAt} hint={copy.dueAtHint} error={messageFor("dueAt")} required>
        <Input
          dir="ltr"
          type="datetime-local"
          value={values.dueAt}
          onChange={(event) => onChange({ dueAt: event.target.value })}
          disabled={disabled}
          required
        />
      </Field>

      <Field label={copy.priority}>
        <Select
          value={values.priority}
          onValueChange={(value) =>
            onChange({ priority: value as LeadActivityForm["priority"] })
          }
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_ACTIVITY_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {copy.priorities[priority]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={copy.notes}>
        <Textarea
          value={values.description}
          onChange={(event) => onChange({ description: event.target.value })}
          maxLength={LEAD_ACTIVITY_DESCRIPTION_MAX}
          rows={3}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}
