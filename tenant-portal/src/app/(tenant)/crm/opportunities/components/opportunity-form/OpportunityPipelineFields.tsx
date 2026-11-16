"use client";

import { Workflow } from "lucide-react";
import { DossierFormCard, DossierFormChoices, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { OpportunityFormCardsProps } from "./opportunity-form-types";

export function OpportunityPipelineFields(props: OpportunityFormCardsProps) {
  const { t, lang } = useI18n();
  if (props.mode === "edit") return props.pipelineSlot;
  return <DossierFormCard title={t.crmOpportunityDetail.form.pipeline} icon={Workflow} tone="cyan">
    <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[1fr_2fr]">
      <Field showLabel label={t.crmOpportunities.pipeline} required error={props.errors.pipelineId}>
        <Select value={props.form.pipelineId || undefined} disabled={props.disabled}
          onValueChange={(value) => { props.onPipelineChange?.(value); props.onBlur("pipelineId"); }}>
          <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>{props.pipelines?.map((pipeline) => <SelectItem key={pipeline.id} value={pipeline.id}>{localizedName(pipeline, lang)}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <DossierFormChoices label={t.crmOpportunities.stage} value={props.form.stageId} disabled={props.disabled}
        error={props.errors.stageId} emptyLabel={t.crmOpportunityDetail.form.noEligibleStages}
        options={(props.selectableStages ?? []).map((stage) => ({ value: stage.id, label: localizedName(stage, lang) }))}
        onChange={(value) => { props.onFieldChange("stageId", value); props.onBlur("stageId"); }} />
    </div>
  </DossierFormCard>;
}
