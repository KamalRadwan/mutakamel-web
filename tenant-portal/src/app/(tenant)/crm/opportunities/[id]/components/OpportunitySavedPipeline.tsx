"use client";

import { ArrowRightLeft, Workflow } from "lucide-react";
import { Button, DossierFormCard, Field, Input, StageBar } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { useOpportunitySavedWorkspace } from "../hooks/useOpportunitySavedWorkspace";

export function OpportunitySavedPipeline({ workspace }: { workspace: ReturnType<typeof useOpportunitySavedWorkspace> }) {
  const { t, lang } = useI18n();
  const { item, pipeline, currentStage, canUpdate, locked, requestCommand, requestStage, transfer, detail } = workspace;
  if (!item) return null;
  const copy = t.crmOpportunityDetail.form;
  return <DossierFormCard title={copy.pipeline} icon={Workflow} tone="cyan" action={canUpdate && <Button size="sm" variant="outline" disabled={locked || !detail.pipelines.some((candidate) => candidate.isActive && candidate.id !== item.pipelineId)} onClick={() => requestCommand(transfer.openDialog)}><ArrowRightLeft className="size-3.5" aria-hidden="true" />{t.crmOpportunityDetail.transferAction}</Button>}>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Field showLabel label={copy.currentPipeline} readOnly><Input value={pipeline ? localizedName(pipeline, lang) : copy.pipelineUnavailable} readOnly /></Field>
      <Field showLabel label={copy.currentStage} readOnly><Input value={currentStage ? localizedName(currentStage, lang) : copy.stageUnavailable} readOnly /></Field>
    </div>
    <StageBar value={item.stageId} label={t.crmOpportunities.stage} disabled={!canUpdate || locked || !pipeline}
      steps={(pipeline?.stages ?? []).map((stage) => ({ id: stage.id, label: localizedName(stage, lang), tone: stage.flag === "WON" ? "positive" : stage.flag === "LOST" ? "negative" : undefined }))}
      onChange={(id) => { if (pipeline && id) requestStage(id); }} />
  </DossierFormCard>;
}
