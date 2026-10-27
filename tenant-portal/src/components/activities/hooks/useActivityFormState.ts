"use client";

import { useCallback, useState } from "react";
import type { ActivityCreateStatus, ActivityTargetSelection } from "../activity-contract";
import {
  rebaseActivityForm,
  withActivityDatePreset,
  withActivityDurationMinutes,
  withActivityStart,
  withActivityStatus,
  withActivityType,
  type ActivityDatePreset,
  type ActivityFormValues,
} from "../activity-form";
import { validateActivityForm, type ActivityFormErrors, type ActivityFormField } from "../activity-form-rules";

type ActivityTextField =
  | "subject" | "priority" | "direction" | "location" | "meetingUrl" | "description" | "outcome" | "endDate" | "endTime" | "reminderOffsetMinutes";

export interface ActivityFormState {
  values: ActivityFormValues;
  /** What the form opened with: the dirty baseline, and on edit the base of the diff. */
  seed: ActivityFormValues;
  /** The errors the user may see yet — a field once it has been left, every field after a submit. */
  errors: ActivityFormErrors;
  isDirty: boolean;
  setField: (key: ActivityTextField, value: string) => void;
  setType: (type: string) => void;
  setStart: (patch: { startDate?: string; startTime?: string }) => void;
  setDatePreset: (preset: ActivityDatePreset) => void;
  setDurationMinutes: (minutes: number) => void;
  setStatus: (status: ActivityCreateStatus) => void;
  setTarget: (target: ActivityTargetSelection | null) => void;
  setAssignee: (id: string | null, label: string | null) => void;
  clearEnd: () => void;
  touch: (field: ActivityFormField) => void;
  /** Shows every error and returns them, so a submit stops before it spends an idempotency key. */
  reveal: () => ActivityFormErrors;
  /** A new baseline — a reopened edit, or "save and add another". Starts silent again. */
  reset: (values: ActivityFormValues) => void;
  /** Keeps the user's edits over a newer copy of the activity after a 409. */
  rebase: (fresh: ActivityFormValues) => void;
}

interface FormModel {
  values: ActivityFormValues;
  seed: ActivityFormValues;
}

/**
 * One activity form's state. Validation runs on every render against the
 * current clock — it is pure and cheap — and a field stays silent until it
 * has been blurred, then re-checks on every change until it is valid:
 * docs/design/primitives.md#validate-on-blur-not-on-keystroke.
 */
export function useActivityFormState(
  initial: () => ActivityFormValues,
  context: { mode: "create" | "edit"; activityStatus?: string },
): ActivityFormState {
  const [model, setModel] = useState<FormModel>(() => {
    const values = initial();
    return { values, seed: values };
  });
  const [touched, setTouched] = useState<ReadonlySet<ActivityFormField>>(() => new Set());
  const [revealed, setRevealed] = useState(false);

  const all = validateActivityForm(model.values, { ...context, seed: model.seed });
  const errors: ActivityFormErrors = revealed
    ? all
    : Object.fromEntries(Object.entries(all).filter(([field]) => touched.has(field as ActivityFormField)));

  const transform = useCallback((next: (values: ActivityFormValues) => ActivityFormValues) => {
    setModel((current) => ({ ...current, values: next(current.values) }));
  }, []);
  const deriveEnd = context.mode === "create";

  const reset = useCallback((values: ActivityFormValues) => {
    setModel({ values, seed: values });
    setTouched(new Set());
    setRevealed(false);
  }, []);

  return {
    values: model.values,
    seed: model.seed,
    errors,
    isDirty: JSON.stringify(model.values) !== JSON.stringify(model.seed),
    setField: (key, value) => transform((values) => ({ ...values, [key]: value })),
    setType: (type) => transform((values) => withActivityType(values, type, deriveEnd)),
    setStart: (patch) => transform((values) => withActivityStart(values, patch)),
    setDatePreset: (preset) => transform((values) => withActivityDatePreset(values, preset)),
    setDurationMinutes: (minutes) => transform((values) => withActivityDurationMinutes(values, minutes)),
    setStatus: (status) => transform((values) => withActivityStatus(values, status)),
    // Who may hold the activity depends on the record, so a new record resets the assignee.
    setTarget: (target) => transform((values) => ({ ...values, target, assigneeUserId: null, assigneeLabel: null })),
    setAssignee: (id, label) => transform((values) => ({ ...values, assigneeUserId: id, assigneeLabel: label })),
    clearEnd: () => transform((values) => ({ ...values, endDate: "", endTime: "" })),
    touch: (field) => setTouched((current) => (current.has(field) ? current : new Set(current).add(field))),
    reveal: () => {
      setRevealed(true);
      return all;
    },
    reset,
    rebase: (fresh) => setModel((current) => ({ values: rebaseActivityForm(current.values, current.seed, fresh), seed: fresh })),
  };
}
