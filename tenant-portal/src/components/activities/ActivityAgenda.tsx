"use client";

import { ActivityList, Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import type { Activity } from "./activity-contract";
import { activityDueState, activityLabel, activityPriorityTone } from "./activity-presentation";
import type { RecordActivities } from "./hooks/useRecordActivities";

export interface ActivityAgendaProps {
  records: RecordActivities;
  /** Drawn above the list inside the modal; a panel that has its own title passes none. */
  heading?: string;
  emptyLabel: string;
  errorLabel: string;
  /** The row a write is in flight for; every row menu waits for it. */
  pendingId: string | null;
  /** A row opens its activity. */
  onView: (activity: Activity) => void;
  /**
   * Per-row admission: each menu offers only what the actor may do to THAT
   * activity (assignee or creator, or the `.all` grant). No edit entry at all
   * without `onEdit`.
   */
  canEdit?: (activity: Activity) => boolean;
  canComplete: (activity: Activity) => boolean;
  canCancel: (activity: Activity) => boolean;
  onEdit?: (activity: Activity) => void;
  onComplete: (activity: Activity) => void;
  onCancel: (activity: Activity) => void;
}

/**
 * A record's open activities as compact cards — soonest first, each with its
 * type, when it is due, and how that stands against the clock. A row opens the
 * activity; its menu carries the quick lifecycle actions the actor holds on it.
 */
export function ActivityAgenda({
  records,
  heading,
  emptyLabel,
  errorLabel,
  pendingId,
  onView,
  canEdit,
  canComplete,
  canCancel,
  onEdit,
  onComplete,
  onCancel,
}: ActivityAgendaProps) {
  const { t, lang } = useI18n();
  const copy = t.activities;

  return (
    <section className="flex min-w-0 flex-col gap-2">
      {heading && <h3 className="text-xs font-medium text-muted-foreground">{heading}</h3>}
      {/* Scrolls inside its own strip: a record with twenty open calls must not
          push the form below it out of the dialog. */}
      <div className="max-h-56 min-h-0 overflow-y-auto pe-1">
        <ActivityList
          density="compact"
          activities={records.activities}
          isLoading={records.isLoading}
          error={records.failed ? errorLabel : null}
          onOpen={onView}
          canEditItem={canEdit}
          canCompleteItem={canComplete}
          canDiscardItem={canCancel}
          editingId={null}
          pendingId={pendingId}
          onEdit={onEdit}
          onComplete={onComplete}
          onDiscard={onCancel}
          labels={{
            empty: emptyLabel,
            edit: copy.actions.edit,
            markDone: copy.actions.markDone,
            discard: copy.actions.cancelActivity,
          }}
          describe={(activity) => {
            const dueState = activityDueState(activity);
            return {
              type: activityLabel(copy, "types", activity.type),
              priority: activityLabel(copy, "priorities", activity.priority),
              priorityTone: activityPriorityTone(activity.priority),
              due: (
                <>
                  {formatDateTime(activity.dueAt, lang)}
                  {(dueState === "OVERDUE" || dueState === "TODAY") && (
                    <span className={dueState === "OVERDUE" ? "text-destructive" : "text-warning"}>
                      {" · "}
                      {copy.dueStates[dueState]}
                    </span>
                  )}
                </>
              ),
              actions: formatTemplate(copy.actions.menu, { subject: activity.subject }),
            };
          }}
        />
      </div>
      {records.failed && (
        <Button variant="outline" size="sm" className="self-start" onClick={records.reload}>
          {t.common.retry}
        </Button>
      )}
    </section>
  );
}
