"use client";

import { useState } from "react";
import type { Activity } from "../activity-contract";
import type { ActivityCommandResult, ActivityCommands } from "./useActivityCommands";

export type ActivityOutcomeMode = "complete" | "cancel";

export interface ActivityOutcome {
  open: boolean;
  /** Kept after close, so the dialog's copy does not change while it fades out. */
  mode: ActivityOutcomeMode;
  activity: Activity | null;
  loading: boolean;
  error: string | undefined;
  start: (mode: ActivityOutcomeMode, activity: Activity) => void;
  close: () => void;
  confirm: (text: string) => Promise<void>;
}

interface OutcomeState {
  open: boolean;
  mode: ActivityOutcomeMode;
  activity: Activity | null;
}

/**
 * Completing or cancelling one activity through `ActivityOutcomeDialog`.
 *
 * A refusal keeps the dialog open with its message, so the typed note is not
 * lost. Every other answer closes it and goes to the host: a success, a 409
 * (with the activity's current copy), or an unknown outcome — which the host
 * shows in-body with its idempotency key, because that evidence has to
 * outlive a dialog.
 */
export function useActivityOutcome(
  commands: ActivityCommands,
  onSettled: (result: ActivityCommandResult) => void,
): ActivityOutcome {
  const [state, setState] = useState<OutcomeState>({ open: false, mode: "complete", activity: null });
  const loading = commands.pendingKind === "complete" || commands.pendingKind === "cancel";

  return {
    open: state.open,
    mode: state.mode,
    activity: state.activity,
    loading,
    error: state.open ? commands.error ?? undefined : undefined,
    start: (mode, activity) => {
      commands.clearError();
      setState({ open: true, mode, activity });
    },
    close: () => {
      if (loading) return;
      commands.clearError();
      setState((current) => ({ ...current, open: false }));
    },
    confirm: async (text) => {
      const { activity, mode } = state;
      if (!activity) return;
      const result = mode === "complete" ? await commands.complete(activity, text) : await commands.cancel(activity, text);
      if (result.kind === "failed") return;
      setState((current) => ({ ...current, open: false }));
      onSettled(result);
    },
  };
}
