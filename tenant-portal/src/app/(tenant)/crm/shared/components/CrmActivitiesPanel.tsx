"use client";

import { useState } from "react";
import {
  Button,
  ConfirmActionModal,
  DetailSection,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type {
  CrmActivityTarget,
  CrmPlannedActivity,
} from "../crm-activity-contract";
import { useCrmActivities } from "../hooks/useCrmActivities";
import { CrmActivityDialog } from "./CrmActivityDialog";
import { CrmActivityList } from "./CrmActivityList";

export interface CrmActivitiesPanelProps {
  target: CrmActivityTarget;
  readOnly: boolean;
}

export function CrmActivitiesPanel({ target, readOnly }: CrmActivitiesPanelProps) {
  const { t } = useI18n();
  const copy = t.crmLeads.activities;
  const activities = useCrmActivities(target.id, target.targetType);

  const [editing, setEditing] = useState<CrmPlannedActivity | null>(null);
  const [discarding, setDiscarding] = useState<CrmPlannedActivity | null>(null);

  function edit(activity: CrmPlannedActivity) {
    if (!readOnly && activities.canUpdate) setEditing(activity);
  }

  async function complete(activity: CrmPlannedActivity) {
    if (!readOnly) await activities.complete(activity);
  }

  function discard(activity: CrmPlannedActivity) {
    if (!readOnly && activities.canCancel) setDiscarding(activity);
  }

  async function confirmDiscard() {
    if (readOnly || !discarding) return;
    if (await activities.cancel(discarding)) setDiscarding(null);
  }

  return (
    <>
      <DetailSection title={copy.title} density="compact">
        <div className="flex flex-col gap-2">
          {activities.writeError && (
            <p role="alert" className="text-xs text-destructive">
              {activities.writeError}
            </p>
          )}

          <CrmActivityList
            activities={activities.activities}
            isLoading={activities.isLoading}
            error={activities.canRead ? activities.loadError : copy.readNotPermitted}
            canEdit={!readOnly && activities.canUpdate}
            canComplete={!readOnly && activities.canComplete}
            canDiscard={!readOnly && activities.canCancel}
            editingId={editing?.id ?? null}
            pendingId={activities.pendingActivityId}
            onEdit={edit}
            onComplete={(item) => void complete(item)}
            onDiscard={discard}
          />

          {activities.canRead && activities.loadError && (
            <Button variant="outline" size="sm" onClick={activities.reload}>
              {t.common.retry}
            </Button>
          )}
        </div>
      </DetailSection>

      {!readOnly && editing && activities.canUpdate && (
        <CrmActivityDialog
          key={`activity:${editing.id}:${editing.version}`}
          density="compact"
          target={target}
          initialActivity={editing}
          onClose={() => setEditing(null)}
          onCreated={activities.reload}
        />
      )}

      <ConfirmActionModal
        open={!readOnly && activities.canCancel && discarding !== null}
        onOpenChange={(open) => {
          if (!open) setDiscarding(null);
        }}
        title={copy.discardTitle}
        description={copy.discardDescription}
        confirmLabel={copy.discardConfirm}
        cancelLabel={t.common.cancel}
        loading={activities.isSubmitting}
        onConfirm={() => void confirmDiscard()}
      />
    </>
  );
}
