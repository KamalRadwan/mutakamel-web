"use client";

import { ReasonDialog } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { ACTIVITY_OUTCOME_MAX } from "./activity-contract";
import type { ActivityOutcomeMode } from "./hooks/useActivityOutcome";

export interface ActivityOutcomeDialogProps {
  open: boolean;
  /** Kept by the host after close, so the copy does not switch while the dialog fades out. */
  mode: ActivityOutcomeMode;
  onClose: () => void;
  onConfirm: (text: string) => void;
  loading?: boolean;
  /** A refusal, shown inside the dialog so the typed note survives it. */
  error?: string;
}

/**
 * Ends an activity — "Mark as done" with an optional outcome, or "Cancel
 * activity" with an optional reason. Cancelling is the destructive variant,
 * but nothing is deleted: the activity stays on the record as cancelled
 * (discard means cancel, never delete — docs/design/patterns.md).
 *
 * Mounted beside the host's own dialog, never inside it: a dialog nested in
 * another inherits its focus trap and hands focus back to a trigger that has
 * already unmounted.
 */
export function ActivityOutcomeDialog({ open, mode, onClose, onConfirm, loading, error }: ActivityOutcomeDialogProps) {
  const { t } = useI18n();
  const copy = t.activities;
  const cancelling = mode === "cancel";

  return (
    <ReasonDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={cancelling ? copy.cancel.title : copy.complete.title}
      description={cancelling ? copy.cancel.description : copy.complete.description}
      // `CompleteActivityDto.outcome` and `CancelActivityDto.reason` are both @MaxLength(2000).
      maxLength={ACTIVITY_OUTCOME_MAX}
      destructive={cancelling}
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
