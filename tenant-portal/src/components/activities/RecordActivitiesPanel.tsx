"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { AmbiguousOutcomePanel, Button, DetailSection, PermissionGate, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { ActivityTargetSelection } from "./activity-contract";
import { activitiesWorkspaceHref } from "./activity-presentation";
import { ActivityAgenda } from "./ActivityAgenda";
import { ActivityModal } from "./ActivityModal";
import { ActivityOutcomeDialog } from "./ActivityOutcomeDialog";
import { useRecordActivitiesPanel } from "./hooks/useRecordActivitiesPanel";

export interface RecordActivitiesPanelProps {
  target: ActivityTargetSelection;
  /** The page's own read-only answer — access mode, or a record that can no longer change. */
  readOnly: boolean;
  /** After any activity on this record changed, for a page that shows a count or a next-activity mark. */
  onChanged?: () => void;
}

/**
 * The activity section of a record's detail side panel: its open activities,
 * "New activity", quick complete / cancel per row, and a way through to the
 * Activities workspace filtered to this record. It hosts its own template
 * modal, so a record page adds one component and nothing else.
 */
export function RecordActivitiesPanel({ target, readOnly, onChanged }: RecordActivitiesPanelProps) {
  const { t } = useI18n();
  const copy = t.activities;
  const panel = useRecordActivitiesPanel(target, readOnly, onChanged);
  const { commands } = panel;
  const ambiguous = commands.ambiguous;

  return (
    <>
      <DetailSection
        title={copy.panel.title}
        density="compact"
        action={panel.canCreate ? (
          <Button variant="outline" size="xs" onClick={panel.openCreate}>
            <Plus className={iconSize({ size: "xs" })} aria-hidden="true" />
            {copy.panel.newActivity}
          </Button>
        ) : undefined}
      >
        <PermissionGate require="activities.read" scoped denied={panel.records.denied}>
          <div className="flex flex-col gap-2">
            {ambiguous ? (
              <AmbiguousOutcomePanel
                operation={ambiguous.kind === "cancel" ? copy.actions.cancelActivity : copy.actions.markDone}
                idempotencyKey={ambiguous.idempotencyKey}
                correlationId={ambiguous.correlationId}
                description={copy.ambiguous.description}
                onRetry={() => void panel.retry()}
                onDismiss={panel.dismissAmbiguous}
                retrying={commands.pendingKind !== null}
                labels={{
                  title: copy.ambiguous.title,
                  operation: copy.ambiguous.operation,
                  idempotencyKey: copy.ambiguous.key,
                  correlationId: copy.ambiguous.reference,
                  retry: copy.ambiguous.retry,
                  dismiss: t.common.dismiss,
                }}
              />
            ) : (
              commands.error && !panel.outcome.open && (
                <p role="alert" className="text-xs text-destructive">{commands.error}</p>
              )
            )}
            <ActivityAgenda
              records={panel.records}
              emptyLabel={copy.panel.empty}
              errorLabel={copy.panel.loadFailed}
              canEdit={(activity) => panel.can("update", activity)}
              canComplete={(activity) => panel.can("complete", activity)}
              canCancel={(activity) => panel.can("cancel", activity)}
              pendingId={commands.pendingActivityId}
              onView={panel.openView}
              onEdit={panel.openEdit}
              onComplete={(activity) => panel.outcome.start("complete", activity)}
              onCancel={(activity) => panel.outcome.start("cancel", activity)}
            />
            <Button variant="link" size="sm" className="self-start" asChild>
              <Link href={activitiesWorkspaceHref(target)}>{copy.panel.viewAll}</Link>
            </Button>
          </div>
        </PermissionGate>
      </DetailSection>

      <ActivityModal
        request={panel.request}
        scope={target.app === "CRM" ? "CRM" : "ALL"}
        onClose={panel.closeModal}
        onChanged={panel.modalChanged}
      />
      <ActivityOutcomeDialog
        open={panel.outcome.open}
        mode={panel.outcome.mode}
        activity={panel.outcome.activity}
        onClose={panel.outcome.close}
        onConfirm={(text) => void panel.outcome.confirm(text)}
        loading={panel.outcome.loading}
        error={panel.outcome.error}
      />
    </>
  );
}
