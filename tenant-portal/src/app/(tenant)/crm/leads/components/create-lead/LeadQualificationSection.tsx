"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
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
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import { LEAD_CREATE_LIMITS, type CreateLeadForm } from "../../lead-create-contract";
import { LeadFieldGuide } from "./LeadFieldGuide";

type LeadQualificationField =
  | "description"
  | "interestSummary"
  | "expectedNeed";

interface LeadQualificationSectionProps {
  form: CreateLeadForm;
  errors: CrmFormErrors;
  disabled: boolean;
  defaultOpen?: boolean;
  onChange: (key: LeadQualificationField, value: string) => void;
  onBlur: (path: string) => void;
}

/**
 * Section 04 — Qualification Narrative & Internal Notes (Violet Theme).
 *
 * Collapsible card for Interest Summary (4000 chars), Expected Need (4000 chars),
 * and Internal Notes (2000 chars). Auto-expands whenever any of its fields has
 * a validation error.
 */
export function LeadQualificationSection({
  form,
  errors,
  disabled,
  defaultOpen = false,
  onChange,
  onBlur,
}: LeadQualificationSectionProps) {
  const { t } = useI18n();
  const limits = LEAD_CREATE_LIMITS;
  const [open, setOpen] = useState(defaultOpen);

  const hasError = Boolean(
    errors.description || errors.interestSummary || errors.expectedNeed,
  );
  const isOpen = open || hasError;

  return (
    <section
      data-form-section="qualification"
      className="relative overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-colors"
    >
      {/* Top 3px accent bar */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-primary"
      />

      <Collapsible open={isOpen} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tabIndex={0}
            className="flex h-auto w-full cursor-pointer items-center justify-between gap-3 rounded-none border-b border-border/60 bg-muted/20 px-4 py-3 text-start transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-foreground">
                <Sparkles className="size-4" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {t.crmLeads.create.sections.qualification}
                  </span>
                  <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {t.crmLeads.create.optionalBadge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.crmLeads.create.qualificationCollapsibleSubtitle}
                </p>
              </div>
            </div>

            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            {/* Interest Summary */}
            <div className="relative">
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {form.interestSummary.length}/{limits.interestSummary}
                </span>
                <LeadFieldGuide field="interestSummary" />
              </div>
              <Field
                label={t.crmLeads.create.interestSummary}
                error={errors.interestSummary}
                showLabel
              >
                <Textarea
                  rows={3}
                  placeholder={t.crmLeads.create.interestSummary}
                  value={form.interestSummary}
                  maxLength={limits.interestSummary}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange("interestSummary", event.target.value)
                  }
                  onBlur={() => onBlur("interestSummary")}
                />
              </Field>
            </div>

            {/* Expected Need */}
            <div className="relative">
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {form.expectedNeed.length}/{limits.expectedNeed}
                </span>
                <LeadFieldGuide field="expectedNeed" />
              </div>
              <Field
                label={t.crmLeads.create.expectedNeed}
                error={errors.expectedNeed}
                showLabel
              >
                <Textarea
                  rows={3}
                  placeholder={t.crmLeads.create.expectedNeed}
                  value={form.expectedNeed}
                  maxLength={limits.expectedNeed}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange("expectedNeed", event.target.value)
                  }
                  onBlur={() => onBlur("expectedNeed")}
                />
              </Field>
            </div>

            {/* Internal Qualification Notes (full width) */}
            <div className="relative md:col-span-2">
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {form.description.length}/{limits.description}
                </span>
                <LeadFieldGuide field="description" />
              </div>
              <Field
                label={t.crmLeads.create.description}
                error={errors.description}
                showLabel
              >
                <Textarea
                  rows={3}
                  placeholder={t.crmLeads.create.description}
                  value={form.description}
                  maxLength={limits.description}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange("description", event.target.value)
                  }
                  onBlur={() => onBlur("description")}
                />
              </Field>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
