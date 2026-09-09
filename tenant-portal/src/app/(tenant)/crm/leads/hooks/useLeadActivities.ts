"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { readAllLeadActivities } from "./readLeadActivities";
import { useI18n } from "@/i18n/I18nContext";
import {
  createCrmWriteAttempt,
  runCrmWrite,
} from "../../shared/crm-write";
import {
  LEAD_ACTIVITIES_PATH,
  LEAD_ACTIVITY_CANCEL_PERMISSION,
  LEAD_ACTIVITY_COMPLETE_PERMISSION,
  LEAD_ACTIVITY_CREATE_PERMISSION,
  LEAD_ACTIVITY_READ_PERMISSION,
  LEAD_ACTIVITY_RESPONSE_LIMIT_BYTES,
  LEAD_ACTIVITY_UPDATE_PERMISSION,
  buildLeadActivityRequest,
  buildLeadActivityUpdateRequest,
  leadActivityCancelPath,
  leadActivityCompletePath,
  leadActivityPath,
  parseCreatedLeadActivity,
  validateLeadActivityForm,
  type LeadActivityErrors,
  type LeadActivityForm,
  type LeadPlannedActivity,
} from "../lead-activity-contract";

export interface LeadActivitiesState {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canComplete: boolean;
  canCancel: boolean;
  activities: LeadPlannedActivity[];
  isLoading: boolean;
  /** The list half's own failure. It never blocks the form half beside it. */
  loadError: string | null;
  reload: () => void;
  isSubmitting: boolean;
  /** The write's non-field failure, for the modal's error summary. */
  writeError: string | null;
  fieldErrors: LeadActivityErrors;
  create: (form: LeadActivityForm) => Promise<boolean>;
  /**
   * Reschedules or rewrites one row, and answers with the SAVED row so a
   * caller can chain — its version has moved, and the next write's `If-Match`
   * needs the new one. `null` is any outcome that must not be chained onto.
   */
  update: (
    activity: LeadPlannedActivity,
    form: LeadActivityForm,
  ) => Promise<LeadPlannedActivity | null>;
  /** Moves an open row to completed. Nothing else about it changes. */
  complete: (activity: LeadPlannedActivity) => Promise<boolean>;
  /** Moves an open row to cancelled — the list is PLANNED-only, so it leaves. */
  cancel: (activity: LeadPlannedActivity) => Promise<boolean>;
  /** The row a write is in flight for, so its own controls can say so. */
  pendingActivityId: string | null;
}

/**
 * One lead's PLANNED activities, and the write that adds one.
 *
 * Scoped to a single lead and mounted with the dialog rather than with the
 * board: fifty cards must not each hold a list they are not showing. `leadId`
 * is null while the dialog is closed, which is what keeps the fetch from
 * running at all.
 */
export function useLeadActivities(leadId: string | null): LeadActivitiesState {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const copy = t.crmLeads.activities;
  const permissions = user?.permissions ?? [];
  const canRead = permissions.includes(LEAD_ACTIVITY_READ_PERMISSION);
  const canCreate = permissions.includes(LEAD_ACTIVITY_CREATE_PERMISSION);
  const canUpdate = permissions.includes(LEAD_ACTIVITY_UPDATE_PERMISSION);
  const canComplete = permissions.includes(LEAD_ACTIVITY_COMPLETE_PERMISSION);
  const canCancel = permissions.includes(LEAD_ACTIVITY_CANCEL_PERMISSION);

  const [activities, setActivities] = useState<LeadPlannedActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LeadActivityErrors>({});
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null);
  // Bumped to ask for the list again. A counter rather than a callback the
  // effect depends on: the effect owns the AbortController, so a reload has to
  // go through it or a slow first response can land after a fast second one.
  const [reloadCount, setReloadCount] = useState(0);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  useEffect(() => {
    if (!leadId || !canRead) return;
    const controller = new AbortController();
    // Deferred past the effect body: a synchronous setState there cascades an
    // extra render (react-hooks/set-state-in-effect), which is the same rule
    // the Core activity form obeys.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      void (async () => {
        try {
          const rows = await readAllLeadActivities(leadId, controller.signal);
          if (controller.signal.aborted) return;
          setActivities(rows);
          setLoadError(null);
        } catch (error) {
          if (controller.signal.aborted) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          setActivities([]);
          setLoadError(copy.loadFailed);
        } finally {
          if (!controller.signal.aborted) setIsLoading(false);
        }
      })();
    });
    return () => controller.abort();
  }, [leadId, canRead, reloadCount, copy.loadFailed]);

  const create = useCallback(
    async (form: LeadActivityForm): Promise<boolean> => {
      if (!leadId) return false;
      if (!canCreate) {
        setWriteError(copy.createNotPermitted);
        return false;
      }

      const errors = validateLeadActivityForm(form);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        // No key is spent and no request is sent: the fields carry the reason,
        // and `useFormShell` puts focus on the first of them.
        setWriteError(null);
        return false;
      }

      setIsSubmitting(true);
      setWriteError(null);
      // One key per Save press, reused across the transport's retries of that
      // press — crm-write.ts rule 1. A fresh key per retry books the same
      // activity twice, which is a duplicate a human has to cancel by hand.
      const attempt = createCrmWriteAttempt();
      const outcome = await runCrmWrite({
        attempt,
        method: "post",
        path: LEAD_ACTIVITIES_PATH,
        body: buildLeadActivityRequest(leadId, form),
        parse: parseCreatedLeadActivity,
        config: { maxResponseBytes: LEAD_ACTIVITY_RESPONSE_LIMIT_BYTES },
      });
      setIsSubmitting(false);

      if (outcome.kind === "success") {
        // The list is re-read rather than patched with the row just returned:
        // the server decides where a new activity sorts among the ones already
        // booked, and a locally spliced row would claim an order it has not
        // been given. `Idempotency-Replayed: true` arrives here too — the
        // Gateway served a write that already ran, which is a success and not
        // an "already exists" (crm-write.ts rule 2).
        reload();
        return true;
      }

      if (outcome.kind === "failed") {
        setWriteError(outcome.error.message || copy.createFailed);
        return false;
      }

      // `ambiguous` and `applied_unreadable` share this exit. Under one the
      // activity may exist and under the other it does exist; in both, the
      // wrong move is a fresh Save, which would carry a fresh key and book a
      // second one. The list is re-read so the user can see what landed.
      reload();
      setWriteError(copy.createAmbiguous);
      return false;
    },
    [leadId, canCreate, copy.createFailed, copy.createAmbiguous, copy.createNotPermitted, reload],
  );

  /**
   * The three row writes, which differ only in path, body and permission.
   *
   * All of them carry `If-Match: <version>` off the row the dialog is already
   * holding — Core answers 428 without it and 409 when someone else has moved
   * on — plus one idempotency key per press, the same rule the create obeys.
   *
   * The ambiguous exit is deliberately NOT an error state for these three.
   * `complete` and `cancel` are idempotent moves to a fixed status, so a write
   * that may or may not have landed leaves the row either done or still
   * planned, and the re-read says which; telling the user "this may have
   * failed" when the list beside them already shows the answer is noise.
   */
  const runRowWrite = useCallback(
    async <T,>(options: {
      activity: LeadPlannedActivity;
      permitted: boolean;
      method: "patch" | "post";
      path: string;
      body: Record<string, unknown>;
      parse: (payload: unknown) => T;
      failedMessage: string;
    }): Promise<T | null> => {
      if (!options.permitted) {
        setWriteError(copy.rowNotPermitted);
        return null;
      }
      setIsSubmitting(true);
      setPendingActivityId(options.activity.id);
      setWriteError(null);
      const attempt = createCrmWriteAttempt();
      const outcome = await runCrmWrite({
        attempt,
        method: options.method,
        path: options.path,
        body: options.body,
        parse: options.parse,
        config: {
          maxResponseBytes: LEAD_ACTIVITY_RESPONSE_LIMIT_BYTES,
          // The row's optimistic lock. A quoted ETag and a bare number are both
          // accepted by `parseIfMatch`; the bare version is what the row holds.
          headers: { "If-Match": String(options.activity.version) },
        },
      });
      setIsSubmitting(false);
      setPendingActivityId(null);

      if (outcome.kind === "failed") {
        setWriteError(outcome.error.message || options.failedMessage);
        // Someone else moved the row on: the version in hand is stale and the
        // only honest next step is to look at what it says now.
        if (outcome.error.status === 409 || outcome.error.status === 412) reload();
        return null;
      }

      // `applied_unreadable` lands here too, and deliberately returns null: the
      // write applied, so the list is re-read, but the caller gets nothing to
      // chain a second write onto — a "save and mark as done" whose save came
      // back unreadable must stop rather than complete a row it cannot name.
      reload();
      return outcome.kind === "success" ? outcome.value : null;
    },
    [copy.rowNotPermitted, reload],
  );

  const update = useCallback(
    async (
      activity: LeadPlannedActivity,
      form: LeadActivityForm,
    ): Promise<LeadPlannedActivity | null> => {
      const errors = validateLeadActivityForm(form, activity.dueAt);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        setWriteError(null);
        return null;
      }
      return runRowWrite({
        activity,
        permitted: canUpdate,
        method: "patch",
        path: leadActivityPath(activity.id),
        body: buildLeadActivityUpdateRequest(form),
        // The saved row, because its VERSION moved: "Save and mark as done" is
        // two writes, and the second one's `If-Match` has to be the version the
        // first one produced. Reading it out of the list state instead would
        // read the version from before this save — React has not re-rendered
        // yet, and the reload is still in flight.
        parse: parseCreatedLeadActivity,
        failedMessage: copy.updateFailed,
      });
    },
    [canUpdate, copy.updateFailed, runRowWrite],
  );

  const complete = useCallback(
    async (activity: LeadPlannedActivity): Promise<boolean> =>
      (await runRowWrite({
        activity,
        permitted: canComplete,
        method: "post",
        // No outcome text. `CompleteActivityDto.outcome` is optional, and a
        // dialog that opened on a card has nowhere to ask for one — the
        // activities screen is where a completion gets a note.
        path: leadActivityCompletePath(activity.id),
        body: {},
        // Nothing to chain onto, so the response is not read: the row leaves
        // the PLANNED list either way, and the re-read is what says so.
        parse: () => true,
        failedMessage: copy.completeFailed,
      })) === true,
    [canComplete, copy.completeFailed, runRowWrite],
  );

  const cancel = useCallback(
    async (activity: LeadPlannedActivity): Promise<boolean> =>
      (await runRowWrite({
        activity,
        permitted: canCancel,
        method: "post",
        // Same reasoning as the outcome above: `reason` is optional.
        path: leadActivityCancelPath(activity.id),
        body: {},
        parse: () => true,
        failedMessage: copy.cancelFailed,
      })) === true,
    [canCancel, copy.cancelFailed, runRowWrite],
  );

  return {
    canRead,
    canCreate,
    canUpdate,
    canComplete,
    canCancel,
    activities,
    isLoading,
    loadError,
    reload,
    isSubmitting,
    writeError,
    fieldErrors,
    update,
    complete,
    cancel,
    pendingActivityId,
    create,
  };
}
