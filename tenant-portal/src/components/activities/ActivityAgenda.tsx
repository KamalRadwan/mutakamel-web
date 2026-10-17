"use client";

import Link from "next/link";
import { Activity as ActivityPulseIcon, ExternalLink, Inbox, Plus } from "lucide-react";
import { ActivityList, Button, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import type { Activity, ActivityType } from "./activity-contract";
import {
  activityDueState,
  activityLabel,
  activityPriorityTone,
  activityTypeIcon,
  activityTypePalette,
  computeOpenAgendaCounts,
} from "./activity-presentation";
import type { RecordActivities } from "./hooks/useRecordActivities";

export interface ActivityAgendaProps {
  records: RecordActivities;
  /** Drawn above the list inside the modal; a panel that has its own title passes none. */
  heading?: string;
  /** Optional record display name for the contextual empty state description. */
  recordName?: string | null;
  emptyLabel: string;
  errorLabel: string;
  /** The row a write is in flight for; every row menu waits for it. */
  pendingId: string | null;
  /** Currently inspected activity ID in the modal's right pane. */
  selectedId?: string | null;
  /** Currently edited activity ID in the modal's right pane. */
  editingId?: string | null;
  /** Renders the full split-workspace rail with KPI counters and footer link. */
  variant?: "panel" | "rail";
  /** A row opens its activity. */
  onView: (activity: Activity) => void;
  /** Switches the modal right pane to New Activity mode. */
  onNew?: () => void;
  /** Quick-starts a new activity of a specific type from the empty state. */
  onQuickType?: (type: ActivityType) => void;
  /** Optional link to the full Activities workspace filtered to the record. */
  viewAllHref?: string | null;
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

const QUICK_STARTER_TYPES: readonly ActivityType[] = ["CALL", "MEETING", "FOLLOW_UP"];

function dueStateClasses(state: "OVERDUE" | "TODAY" | "UPCOMING"): {
  badge: string;
  accent: string;
} {
  if (state === "OVERDUE") {
    return {
      badge: "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground",
      accent: "border-s-destructive",
    };
  }
  if (state === "TODAY") {
    return {
      badge: "border-warning/30 bg-warning-subtle text-warning-subtle-foreground",
      accent: "border-s-warning",
    };
  }
  return {
    badge: "border-success/30 bg-success-subtle text-success-subtle-foreground",
    accent: "border-s-success",
  };
}

/**
 * A record's open activities as colorful due-state cards — soonest first, each
 * with its type icon, when it is due, and how that stands against the clock.
 * In `variant="rail"`, renders the persistent Left Rail of `ActivityModal` with
 * mini KPI counters (`Overdue`, `Due today`, `Upcoming`) and quick-starter pills.
 */
export function ActivityAgenda({
  records,
  heading,
  recordName,
  emptyLabel,
  errorLabel,
  pendingId,
  selectedId = null,
  editingId = null,
  variant = "panel",
  onView,
  onNew,
  onQuickType,
  viewAllHref,
  canEdit,
  canComplete,
  canCancel,
  onEdit,
  onComplete,
  onCancel,
}: ActivityAgendaProps) {
  const { t, lang } = useI18n();
  const copy = t.activities;
  const counts = computeOpenAgendaCounts(records.activities);

  const listElement = (
    <ActivityList
      density="compact"
      activities={records.activities}
      isLoading={records.isLoading}
      error={records.failed ? errorLabel : null}
      onOpen={onView}
      canEditItem={canEdit}
      canCompleteItem={canComplete}
      canDiscardItem={canCancel}
      selectedId={selectedId}
      editingId={editingId}
      pendingId={pendingId}
      inlineQuickActions={variant === "rail"}
      onEdit={onEdit}
      onComplete={onComplete}
      onDiscard={onCancel}
      emptySlot={
        variant === "rail" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-7 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-swatch-indigo-soft text-swatch-indigo-deep">
              <Inbox className={iconSize({ size: "xl" })} aria-hidden="true" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm font-semibold text-foreground">{emptyLabel}</p>
              <p className="max-w-[260px] text-xs leading-relaxed text-muted-foreground">
                {recordName
                  ? formatTemplate(copy.agenda.emptyForRecord, { name: recordName })
                  : copy.agenda.emptyHint}
              </p>
            </div>
            {onQuickType && (
              <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                {QUICK_STARTER_TYPES.map((starterType) => {
                  const starterPalette =
                    starterType === "CALL"
                      ? activityTypePalette("EMAIL")
                      : activityTypePalette(starterType);
                  const starterLabel =
                    starterType === "CALL"
                      ? copy.agenda.quickCall
                      : activityLabel(copy, "types", starterType);
                  return (
                    <Button
                      key={starterType}
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => onQuickType(starterType)}
                      className={cn(
                        "h-6 gap-1 rounded-full border px-2.5 text-2xs font-semibold transition-colors",
                        starterPalette.badge,
                      )}
                    >
                      <span>+ {starterLabel}</span>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        ) : undefined
      }
      labels={{
        empty: emptyLabel,
        edit: copy.actions.edit,
        markDone: copy.actions.markDone,
        doneShort: copy.actions.doneShort,
        discard: copy.actions.cancelActivity,
      }}
      describe={(activity) => {
        const dueState = activityDueState(activity);
        const { icon: TypeIcon } = activityTypeIcon(activity.type);
        const palette = activityTypePalette(activity.type);
        const stateVisual = dueState ? dueStateClasses(dueState) : null;
        const isRowEditing = editingId === activity.id;
        const isRowInspecting = selectedId === activity.id && !isRowEditing;

        return {
          type: activityLabel(copy, "types", activity.type),
          typeIcon: <TypeIcon className={iconSize({ size: "lg" })} aria-hidden="true" />,
          typeBadgeClassName: variant === "rail" ? palette.iconBoxIdle : palette.badge,
          accentClassName: stateVisual?.accent ?? palette.accentBorder,
          dueStateLabel: dueState ? copy.dueStates[dueState] : undefined,
          dueStateClassName: stateVisual?.badge,
          stateBadge: isRowEditing ? (
            <span className="inline-flex items-center rounded-md border border-warning/40 bg-warning-subtle px-2 py-0.5 text-2xs font-semibold text-warning-subtle-foreground">
              {copy.agenda.editingNow}
            </span>
          ) : isRowInspecting ? (
            <span className="inline-flex items-center rounded-md border border-info/40 bg-info-subtle px-2 py-0.5 text-2xs font-semibold text-info-subtle-foreground">
              {copy.agenda.inspectingNow}
            </span>
          ) : undefined,
          statusLabel: activityLabel(copy, "statuses", activity.status),
          assignee: activity.assigneeName,
          priority: activityLabel(copy, "priorities", activity.priority),
          priorityTone:
            activity.priority === "URGENT"
              ? "negative"
              : activityPriorityTone(activity.priority),
          due: formatDateTime(activity.dueAt, lang),
          actions: formatTemplate(copy.actions.menu, { subject: activity.subject }),
        };
      }}
    />
  );

  if (variant === "rail") {
    return (
      <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col justify-between gap-3.5 p-4">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Rail Header — no subtitle on the right so the uppercase heading never truncates */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ActivityPulseIcon className={cn(iconSize({ size: "sm" }), "shrink-0 text-muted-foreground")} aria-hidden="true" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {heading ?? copy.agenda.currentTitle}
              </h3>
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-2xs font-semibold tabular-nums",
                  counts.total > 0
                    ? "bg-foreground text-background"
                    : "border border-border bg-card text-muted-foreground",
                )}
              >
                {counts.total}
              </span>
            </div>
            {onNew && (
              <Button type="button" variant="outline" size="xs" onClick={onNew} className="shrink-0 gap-1">
                <Plus className={iconSize({ size: "xs" })} aria-hidden="true" />
                {copy.agenda.newButton}
              </Button>
            )}
          </div>

          {/* 3-Column Mini KPI Strip — Title Case labels like prototype.html */}
          <div className="grid grid-cols-3 gap-2">
            <div
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2",
                counts.overdue > 0
                  ? "border-destructive/30 bg-destructive-subtle/60"
                  : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "text-xl font-semibold leading-tight tabular-nums",
                  counts.overdue > 0 ? "text-destructive-subtle-foreground" : "text-muted-foreground",
                )}
              >
                {counts.overdue}
              </span>
              <span
                className={cn(
                  "truncate text-2xs font-semibold",
                  counts.overdue > 0 ? "text-destructive-subtle-foreground" : "text-muted-foreground",
                )}
              >
                {copy.dueStates.OVERDUE}
              </span>
            </div>

            <div
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2",
                counts.today > 0
                  ? "border-warning/30 bg-warning-subtle/60"
                  : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "text-xl font-semibold leading-tight tabular-nums",
                  counts.today > 0 ? "text-warning-subtle-foreground" : "text-muted-foreground",
                )}
              >
                {counts.today}
              </span>
              <span
                className={cn(
                  "truncate text-2xs font-semibold",
                  counts.today > 0 ? "text-warning-subtle-foreground" : "text-muted-foreground",
                )}
              >
                {copy.dueStates.TODAY}
              </span>
            </div>

            <div
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2",
                counts.upcoming > 0
                  ? "border-success/30 bg-success-subtle/60"
                  : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "text-xl font-semibold leading-tight tabular-nums",
                  counts.upcoming > 0 ? "text-success-subtle-foreground" : "text-muted-foreground",
                )}
              >
                {counts.upcoming}
              </span>
              <span
                className={cn(
                  "truncate text-2xs font-semibold",
                  counts.upcoming > 0 ? "text-success-subtle-foreground" : "text-muted-foreground",
                )}
              >
                {copy.dueStates.UPCOMING}
              </span>
            </div>
          </div>

          {/* Scrollable Cards Area */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {listElement}
            {records.failed && (
              <Button variant="outline" size="sm" className="self-start" onClick={records.reload}>
                {t.common.retry}
              </Button>
            )}
          </div>
        </div>

        {/* Footer Link */}
        {viewAllHref && (
          <div className="border-t border-border pt-3">
            <Button variant="link" size="xs" className="h-auto w-full justify-between p-0 text-xs font-semibold text-primary hover:no-underline" asChild>
              <Link href={viewAllHref} className="flex w-full items-center justify-between gap-2">
                <span>{copy.agenda.viewAllRecord}</span>
                <ExternalLink className={iconSize({ size: "xs" })} aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-2">
      {heading && <h3 className="text-xs font-medium text-muted-foreground">{heading}</h3>}
      <div className="max-h-56 min-h-0 overflow-y-auto pe-1">{listElement}</div>
      {records.failed && (
        <Button variant="outline" size="sm" className="self-start" onClick={records.reload}>
          {t.common.retry}
        </Button>
      )}
    </section>
  );
}
