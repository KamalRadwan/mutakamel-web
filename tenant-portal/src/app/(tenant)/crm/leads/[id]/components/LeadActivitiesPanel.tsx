"use client";

import { Button, ConfirmActionModal, DetailSection } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { LeadActivityDialog, type LeadActivityTarget } from "../../components/lead-activity/LeadActivityDialog";
import { LeadActivityList } from "../../components/lead-activity/LeadActivityList";
import { useLeadActivitiesPanel } from "../hooks/useLeadActivitiesPanel";

export function LeadActivitiesPanel({ lead, readOnly }: { lead: LeadActivityTarget; readOnly: boolean }) {
  const { t } = useI18n();
  const copy = t.crmLeads.activities;
  const panel = useLeadActivitiesPanel(lead.id, readOnly);
  const { activities } = panel;
  return (
    <>
      <DetailSection title={copy.title} density="compact">
        <div className="flex flex-col gap-2">
          {activities.writeError && <p role="alert" className="text-xs text-destructive">{activities.writeError}</p>}
          <LeadActivityList density="compact" activities={activities.activities}
            isLoading={activities.isLoading}
            error={activities.canRead ? activities.loadError : copy.readNotPermitted}
            canEdit={!readOnly && activities.canUpdate}
            canComplete={!readOnly && activities.canComplete}
            canDiscard={!readOnly && activities.canCancel}
            editingId={panel.editing?.id ?? null} pendingId={activities.pendingActivityId}
            onEdit={panel.edit} onComplete={panel.complete} onDiscard={panel.discard} />
          {activities.canRead && activities.loadError && (
            <Button variant="outline" size="sm" onClick={activities.reload}>{t.common.retry}</Button>
          )}
        </div>
      </DetailSection>
      {!readOnly && panel.editing && activities.canUpdate && (
        <LeadActivityDialog key={`activity:${panel.editing.id}:${panel.editing.version}`}
          density="compact" lead={lead} initialActivity={panel.editing}
          onClose={panel.closeEdit} onCreated={activities.reload} />
      )}
      <ConfirmActionModal open={!readOnly && activities.canCancel && panel.discarding !== null}
        onOpenChange={(open) => { if (!open) panel.closeDiscard(); }}
        title={copy.discardTitle} description={copy.discardDescription}
        confirmLabel={copy.discardConfirm} cancelLabel={t.common.cancel}
        loading={activities.isSubmitting} onConfirm={panel.confirmDiscard} />
    </>
  );
}
