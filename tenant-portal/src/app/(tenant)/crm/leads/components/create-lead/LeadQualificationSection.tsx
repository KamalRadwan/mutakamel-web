"use client";

import { useState } from "react";
import { ChevronRight, Target } from "lucide-react";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Field,
  Textarea,
  cn,
} from "@/design-system";
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

  const hasErrors = Object.keys(errors).some(
    (key) => key === "description" || key === "interestSummary" || key === "expectedNeed",
  );
  const [open, setOpen] = useState(false);
  const sectionOpen = open || hasErrors;

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
    <Field key={key} label={label} error={errors[key]} showLabel className="w-full">
      <Textarea
        placeholder={label}
        rows={2}
        value={form[key]}
        maxLength={max}
        disabled={disabled}
        onChange={(event) => onChange(key, event.target.value)}
        onBlur={() => onBlur(key)}
      />
    </Field>
  );

  return (
    <Collapsible
      open={sectionOpen}
      onOpenChange={(next) => setOpen(hasErrors ? true : next)}
      data-form-section="qualification"
      className="scroll-mt-4 overflow-hidden rounded-lg border border-border bg-card"
    >
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          tabIndex={0}
          variant="ghost"
          size="sm"
          className="h-auto w-full justify-between rounded-none px-3 py-2 text-start font-normal"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <Target className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4
                  className="truncate text-sm font-semibold leading-tight text-foreground outline-none"
                >
                  {t.crmLeads.create.sections.qualification}
                </h4>
                <span className="shrink-0 text-xs text-muted-foreground">
                  · {t.crmLeads.create.optionalBadge}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs leading-normal text-muted-foreground">
                {t.crmLeads.create.qualificationCollapsibleSubtitle}
              </p>
            </div>
          </div>

          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200 rtl:-scale-x-100",
              sectionOpen && "rotate-90",
            )}
            aria-hidden="true"
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-border p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {paired.map(field)}
          <div className="md:col-span-2">
            {field({
              key: "description",
              label: t.crmLeads.create.description,
              max: LEAD_CREATE_LIMITS.description,
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
