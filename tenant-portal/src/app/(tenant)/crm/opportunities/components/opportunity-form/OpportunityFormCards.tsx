"use client";

import { Tags } from "lucide-react";
import { DossierFormCard, DossierFormGrid, Field, Input, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { OpportunityCustomFieldInputs } from "./OpportunityCustomFieldInputs";
import { OpportunityDealFields } from "./OpportunityDealFields";
import { OpportunityPeopleFields } from "./OpportunityPeopleFields";
import { OpportunityPipelineFields } from "./OpportunityPipelineFields";
import type { OpportunityFormCardsProps } from "./opportunity-form-types";

export type { OpportunityFormCardsProps } from "./opportunity-form-types";

export function OpportunityFormCards(props: OpportunityFormCardsProps) {
  const { t } = useI18n();
  return <div className="grid min-w-0 content-start gap-3">
    <Field showLabel label={t.crmOpportunities.title} required error={props.errors.title}>
      <Input size="sm" placeholder="" value={props.form.title} maxLength={180} disabled={props.disabled}
        onChange={(event) => props.onFieldChange("title", event.target.value)} onBlur={() => props.onBlur("title")} />
    </Field>
    <DossierFormGrid><OpportunityPeopleFields {...props} /><OpportunityDealFields {...props} /></DossierFormGrid>
    <OpportunityPipelineFields {...props} />
    {props.view === "full" ? <DossierFormGrid>
      <DossierFormCard title={t.crmOpportunityDetail.form.tagsNotes} icon={Tags} tone="amber"
        className={props.customFields.definitions.length === 0 && !props.customFields.loading && !props.customFields.degraded ? "lg:col-span-2" : undefined}>
        {props.tagsSlot}
        <Field showLabel label={t.crmLeadDetail.description} error={props.errors.description}>
          <Textarea placeholder="" value={props.form.description} rows={3} maxLength={2000} disabled={props.disabled}
            onChange={(event) => props.onFieldChange("description", event.target.value)} onBlur={() => props.onBlur("description")} />
        </Field>
      </DossierFormCard>
      <OpportunityCustomFieldInputs {...props} />
    </DossierFormGrid> : <OpportunityCustomFieldInputs {...props} />}
  </div>;
}
