"use client";

import { FileText, History, ListTodo, Paperclip } from "lucide-react";
import { Button, cn } from "@/design-system";
import { RecordActivitiesPanel } from "@/components/activities/RecordActivitiesPanel";
import { RecordHistoryTab } from "@/components/audit/RecordHistoryTab";
import { useAuditAccess } from "@/components/audit/hooks/useAuditAccess";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { RecordAttachmentsSection } from "../../../shared/components/RecordAttachmentsSection";
import { RecordNotesSection } from "../../../shared/components/RecordNotesSection";
import { useCrmRecordCapabilities } from "../../../shared/hooks/useCrmRecordCapabilities";
import { useOpportunityDossierTabs } from "../hooks/useOpportunityDossierTabs";
import type { useOpportunitySavedWorkspace } from "../hooks/useOpportunitySavedWorkspace";
import { OpportunityStageHistory } from "./OpportunityStageHistory";

export function OpportunitySavedPanels({ workspace }: { workspace: ReturnType<typeof useOpportunitySavedWorkspace> }) {
  const { t, lang } = useI18n();
  const tabs = useOpportunityDossierTabs();
  const canReadHistory = useAuditAccess();
  const { item, canMutate, locked, edit, detail } = workspace;
  const attached = useCrmRecordCapabilities(item?.branchId ?? null);
  if (!item) return null;
  const readOnly = !canMutate || locked || edit.isDirty;
  const relatedPartyIds = [item.customerPartyId, item.contactPartyId].filter((id): id is string => Boolean(id));
  return <section className="rounded-card border border-line-card bg-card p-3 shadow-card">
    <div role="tablist" aria-label={item.title} className="mb-3 flex flex-wrap items-center gap-1 border-b border-line-divider pb-2">
      {([{ id: "activities", label: t.crmOpportunities.activitiesTab, Icon: ListTodo }, { id: "notes", label: t.crmLeadDetail.notes, Icon: FileText },
        { id: "attachments", label: t.attachments.title, Icon: Paperclip }, { id: "history", label: t.audit.historyTitle, Icon: History }] as const)
        .map(({ id, label, Icon }) => <Button key={id} id={`opportunity-tab-${id}`} aria-controls={`opportunity-panel-${id}`} role="tab" aria-selected={tabs.active === id} variant="ghost" size="sm" className={cn(tabs.active === id && "bg-info-subtle text-primary")} onClick={() => tabs.select(id)}><Icon className="size-4" aria-hidden="true" />{label}</Button>)}
    </div>
    {tabs.active === "activities" && <div id="opportunity-panel-activities" role="tabpanel" aria-labelledby="opportunity-tab-activities"><RecordActivitiesPanel target={{ app: "CRM", type: "OPPORTUNITY", id: item.id, label: item.title }} readOnly={readOnly} /></div>}
    {tabs.active === "notes" && <div id="opportunity-panel-notes" role="tabpanel" aria-labelledby="opportunity-tab-notes"><RecordNotesSection branchId={item.branchId} sourceType="OPPORTUNITY" sourceId={item.id} sourceOwnerUserId={item.ownerUserId} createCapability={attached.capabilities.notesCreate} readOnly={readOnly} /></div>}
    {tabs.active === "history" && <div id="opportunity-panel-history" role="tabpanel" aria-labelledby="opportunity-tab-history" className="grid gap-4"><OpportunityStageHistory item={item} />{canReadHistory && <RecordHistoryTab density="compact" entityType="Opportunity" entityId={item.id} relatedPartyIds={relatedPartyIds} refreshToken={item} valueLabels={{
      stageId: Object.fromEntries(detail.pipelines.flatMap((entry) => entry.stages.map((stage) => [stage.id, localizedName(stage, lang)]))),
      pipelineId: Object.fromEntries(detail.pipelines.map((entry) => [entry.id, localizedName(entry, lang)])),
    }} />}</div>}
    {(tabs.attachmentsVisited || tabs.active === "attachments") && <div id="opportunity-panel-attachments" role="tabpanel" aria-labelledby="opportunity-tab-attachments" hidden={tabs.active !== "attachments"}><RecordAttachmentsSection branchId={item.branchId} sourceType="OPPORTUNITY" sourceId={item.id} sourceOwnerUserId={item.ownerUserId} createCapability={attached.capabilities.attachmentsCreate} deleteCapability={attached.capabilities.attachmentsDelete} readOnly={readOnly} uploadVariant="button" density="compact" /></div>}
  </section>;
}
