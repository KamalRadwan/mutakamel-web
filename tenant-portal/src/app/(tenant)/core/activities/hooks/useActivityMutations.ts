"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import {
  cancelActivity,
  completeActivity,
  createActivity,
  fetchActivity,
  updateActivity,
} from "../activities-api";
import type { Activity } from "../activities-contract";
import {
  buildCreateActivityRequest,
  buildUpdateActivityRequest,
  type ActivityFormValues,
} from "../activity-forms";
import type { ActivityGrants } from "./useActivities";

export type ActivityTransition = "complete" | "cancel";

/** A write that timed out may still have committed — its key is what makes a retry safe. */
export interface AmbiguousWrite {
  operation: string;
  idempotencyKey: string;
  correlationId?: string;
  retry: () => Promise<void>;
}

type Dictionary = ReturnType<typeof useI18n>["t"];

function formMessage(reason: string, t: Dictionary): string | undefined {
  const copy = t.coreOperations.activities;
  if (reason === "ACTIVITY_FORM_SUBJECT") return copy.subjectRequired;
  if (reason === "ACTIVITY_FORM_DUE_AT") return copy.dueAtRequired;
  if (reason === "ACTIVITY_FORM_TARGET") return copy.targetRequired;
  if (reason === "ACTIVITY_FORM_ASSIGNEE") return copy.assigneeRequired;
  return undefined;
}

/** No response reached the browser, so the write's outcome is genuinely unknown. */
function isAmbiguous(error: NormalizedApiError): boolean {
  return error.status === 0 || error.status === 408 || error.status === 504;
}

export function useActivityMutations(
  grants: ActivityGrants,
  onReplace: (activity: Activity) => void,
  onReload: () => void,
) {
  const { t } = useI18n();
  const toast = useToast();
  const copy = t.coreOperations.activities;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<{ activity: Activity; etag: string } | null>(null);
  const [transition, setTransition] = useState<
    { activity: Activity; kind: ActivityTransition } | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Activity | null>(null);
  const [ambiguous, setAmbiguous] = useState<AmbiguousWrite | null>(null);

  const handleFailure = useCallback(
    async (
      error: unknown,
      title: string,
      context: { activityId?: string; operation: string; key: string; retry: () => Promise<void> },
    ): Promise<void> => {
      const reason = error instanceof Error ? error.message : "";
      const text = formMessage(reason, t);
      if (text) {
        setFormError(text);
        return;
      }
      const normalized = normalizeApiError(error);
      if (normalized.status === 403) return;
      if (toast.outcomeFromApi(normalized)) return;
      if (isAmbiguous(normalized)) {
        setAmbiguous({
          operation: context.operation,
          idempotencyKey: context.key,
          correlationId: normalized.correlationId,
          retry: context.retry,
        });
        return;
      }
      // 409 — the activity moved under the caller. Refetch and show what is
      // stored instead of letting a retry overwrite an edit nobody saw.
      if (normalized.status === 409 && context.activityId) {
        try {
          const fresh = await fetchActivity(context.activityId);
          setConflict(fresh.activity);
          onReplace(fresh.activity);
          return;
        } catch {
          // Fall through when even the refetch fails.
        }
      }
      toast.errorFromApi(title, normalized);
    },
    [t, toast, onReplace],
  );

  const create = useCallback(
    async (values: ActivityFormValues): Promise<boolean> => {
      if (!grants.canCreate || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      const key = generateUUIDv7();
      const run = async () => {
        await createActivity(buildCreateActivityRequest(values), key);
        setIsCreateOpen(false);
        setAmbiguous(null);
        toast.success(copy.savedTitle, copy.created);
        onReload();
      };
      try {
        await run();
        return true;
      } catch (error) {
        await handleFailure(error, copy.createFailed, {
          operation: copy.operationCreate,
          key,
          retry: run,
        });
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [grants.canCreate, isSubmitting, toast, copy, onReload, handleFailure],
  );

  const save = useCallback(
    async (values: ActivityFormValues): Promise<boolean> => {
      if (!editing || !grants.canUpdate || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      const key = generateUUIDv7();
      const target = editing;
      const run = async () => {
        const body = buildUpdateActivityRequest(target.activity, values);
        if (Object.keys(body).length === 0) {
          setEditing(null);
          return;
        }
        const saved = await updateActivity(target.activity.id, body, target.etag, key);
        onReplace(saved.activity);
        setEditing(null);
        setAmbiguous(null);
        toast.success(copy.savedTitle, copy.updated);
      };
      try {
        await run();
        return true;
      } catch (error) {
        await handleFailure(error, copy.updateFailed, {
          activityId: target.activity.id,
          operation: copy.operationUpdate,
          key,
          retry: run,
        });
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [editing, grants.canUpdate, isSubmitting, toast, copy, onReplace, handleFailure],
  );

  const runTransition = useCallback(
    async (note: string): Promise<void> => {
      if (!transition || pendingId) return;
      const { activity, kind } = transition;
      if (kind === "complete" ? !grants.canComplete : !grants.canCancel) return;
      setPendingId(activity.id);
      const key = generateUUIDv7();
      const ifMatch = `"${activity.version}"`;
      const run = async () => {
        const result =
          kind === "complete"
            ? await completeActivity(activity.id, note || undefined, ifMatch, key)
            : await cancelActivity(activity.id, note || undefined, ifMatch, key);
        onReplace(result.activity);
        setTransition(null);
        setAmbiguous(null);
        toast.success(copy.savedTitle, kind === "complete" ? copy.completed : copy.cancelled);
      };
      try {
        await run();
      } catch (error) {
        await handleFailure(error, kind === "complete" ? copy.completeFailed : copy.cancelFailed, {
          activityId: activity.id,
          operation: kind === "complete" ? copy.operationComplete : copy.operationCancel,
          key,
          retry: run,
        });
      } finally {
        setPendingId(null);
      }
    },
    [transition, pendingId, grants, toast, copy, onReplace, handleFailure],
  );

  return {
    isCreateOpen,
    editing,
    transition,
    isSubmitting,
    formError,
    pendingId,
    conflict,
    ambiguous,
    openCreate: () => {
      setFormError(null);
      setIsCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setFormError(null);
      setIsCreateOpen(false);
    },
    openEdit: (activity: Activity) => {
      setFormError(null);
      setEditing({ activity, etag: `"${activity.version}"` });
    },
    closeEdit: () => {
      if (isSubmitting) return;
      setFormError(null);
      setEditing(null);
    },
    openTransition: (activity: Activity, kind: ActivityTransition) =>
      setTransition({ activity, kind }),
    closeTransition: () => {
      if (pendingId) return;
      setTransition(null);
    },
    dismissConflict: () => setConflict(null),
    dismissAmbiguous: () => setAmbiguous(null),
    create,
    save,
    runTransition,
  };
}
