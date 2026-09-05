"use client";

import { Field, FormSection, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { LEAD_CREATE_LIMITS, type CreateLeadForm } from "../../lead-create-contract";
import type { LeadCreateErrors } from "../../lead-create-validation";

type QualificationField = "description" | "interestSummary" | "expectedNeed";

export interface LeadQualificationSectionProps {
  form: CreateLeadForm;
  errors: LeadCreateErrors;
  disabled: boolean;
  onChange: (key: QualificationField, value: string) => void;
  onBlur: (path: string) => void;
}

/**
 * The three free-text columns `crm_leads` keeps in its own row.
 *
 * Interest and expected need sit side by side because they are read together —
 * what the lead wants against what they will need. Each still caps at
 * `max-w-prose`, so the two-column row shortens the line length rather than
 * stretching it: the rule is 65 characters per line, not one field per row —
 * docs/design/typography.md#prose-is-capped-at-65-characters. The description
 * is the long one and keeps the full width below them.
 */
export function LeadQualificationSection({
  form,
  errors,
  disabled,
  onChange,
  onBlur,
}: LeadQualificationSectionProps) {
  const { t } = useI18n();

  const paired: Array<{ key: QualificationField; label: string; max: number }> = [
    {
      key: "interestSummary",
      label: t.crmLeads.create.interestSummary,
      max: LEAD_CREATE_LIMITS.interestSummary,
    },
    {
      key: "expectedNeed",
      label: t.crmLeads.create.expectedNeed,
      max: LEAD_CREATE_LIMITS.expectedNeed,
    },
  ];

  const field = ({ key, label, max }: { key: QualificationField; label: string; max: number }) => (
    <Field key={key} label={label} error={errors[key]} className="max-w-prose">
      <Textarea
        rows={3}
        value={form[key]}
        maxLength={max}
        disabled={disabled}
        onChange={(event) => onChange(key, event.target.value)}
        onBlur={() => onBlur(key)}
      />
    </Field>
  );

  return (
    <FormSection
      id="qualification"
      title={t.crmLeads.create.sections.qualification}
      columns={2}
    >
      {paired.map(field)}
      {/* The second column only exists from `md` up — FormSection's grid. */}
      <div className="md:col-span-2">
        {field({
          key: "description",
          label: t.crmLeads.create.description,
          max: LEAD_CREATE_LIMITS.description,
        })}
      </div>
    </FormSection>
  );
}
