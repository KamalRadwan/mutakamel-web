"use client";

import { Ban, Check, CheckCircle2 } from "lucide-react";
import { Badge, cn, DateTime, iconSize, ReasonDialog } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { ACTIVITY_OUTCOME_MAX, type Activity } from "./activity-contract";
import { activityLabel, activityPriorityTone, activityTypePalette } from "./activity-presentation";
import { ActivityTypeIcon } from "./ActivityTypeIcon";
import type { ActivityOutcomeMode } from "./hooks/useActivityOutcome";

export interface ActivityOutcomeDialogProps {
  open: boolean;
  /** Kept by the host after close, so the copy does not switch while the dialog fades out. */
  mode: ActivityOutcomeMode;
  /** Optional activity being completed or cancelled, rendered as a summary banner. */
  activity?: Activity | null;
  onClose: () => void;
  onConfirm: (text: string) => void;
  loading?: boolean;
  /** A refusal, shown inside the dialog so the typed note survives it. */
  error?: string;
}

/**
 * Ends an activity — "Mark as done" with an optional outcome and quick templates,
 * or "Cancel activity" with an optional reason and quick cancellation templates.
 */
export function ActivityOutcomeDialog({
  open,
  mode,
  activity,
  onClose,
  onConfirm,
  loading,
  error,
}: ActivityOutcomeDialogProps) {
  const { t } = useI18n();
  const copy = t.activities;
  const cancelling = mode === "cancel";
  const palette = activity ? activityTypePalette(activity.type) : null;

  const templates = cancelling
    ? [
        copy.cancel.templates.rescheduled,
        copy.cancel.templates.noLongerNeeded,
        copy.cancel.templates.switchedChannel,
        copy.cancel.templates.createdByMistake,
      ]
    : [
        copy.complete.templates.completedSuccessfully,
        copy.complete.templates.followUpNeeded,
        copy.complete.templates.sentSummary,
        copy.complete.templates.leftMessage,
      ];

  return (
    <ReasonDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={cancelling ? copy.cancel.title : copy.complete.title}
      description={cancelling ? copy.cancel.description : copy.complete.description}
      headerIcon={
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-lg border",
            cancelling
              ? "border-destructive/35 bg-destructive-subtle text-destructive-subtle-foreground"
              : "border-success/35 bg-success-subtle text-success-subtle-foreground",
          )}
        >
          {cancelling ? (
            <Ban className={iconSize({ size: "md" })} aria-hidden="true" />
          ) : (
            <CheckCircle2 className={iconSize({ size: "md" })} aria-hidden="true" />
          )}
        </div>
      }
      summarySlot={
        activity && palette ? (
          <div className="flex items-center justify-between gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md border",
                  palette.iconBoxIdle,
                )}
              >
                <ActivityTypeIcon type={activity.type} size="sm" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-semibold text-foreground">{activity.subject}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
                  <span>{activityLabel(copy, "types", activity.type)}</span>
                  <span aria-hidden="true">·</span>
                  <DateTime value={activity.dueAt} />
                </span>
              </div>
            </div>
            <Badge tone={activityPriorityTone(activity.priority)}>
              {activityLabel(copy, "priorities", activity.priority)}
            </Badge>
          </div>
        ) : undefined
      }
      templatesLabel={cancelling ? copy.cancel.templatesLabel : copy.complete.templatesLabel}
      templates={templates}
      showLabel={true}
      // `CompleteActivityDto.outcome` and `CancelActivityDto.reason` are both @MaxLength(2000).
      maxLength={ACTIVITY_OUTCOME_MAX}
      destructive={cancelling}
      footerLeading={cancelling ? copy.cancel.footerNote : copy.complete.footerNote}
      confirmIcon={
        cancelling ? (
          <Ban className={iconSize({ size: "xs" })} aria-hidden="true" />
        ) : (
          <Check className={iconSize({ size: "xs" })} aria-hidden="true" />
        )
      }
      confirmClassName={!cancelling ? "bg-success text-primary-foreground hover:bg-success/90" : undefined}
      onConfirm={onConfirm}
      loading={loading}
      error={error}
      labels={{
        reason: cancelling ? copy.cancel.reason : copy.complete.outcome,
        reasonPlaceholder: cancelling ? undefined : copy.form.outcomePlaceholder,
        confirm: cancelling ? copy.cancel.confirm : copy.complete.confirm,
        // "Cancel" beside "Cancel activity" would read as the same action twice.
        cancel: copy.form.close,
      }}
    />
  );
}
