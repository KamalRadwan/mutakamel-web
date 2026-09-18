"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { createCrmWriteAttempt, runCrmWrite } from "../crm-write";
import {
  CRM_ACTIVITIES_PATH,
  CRM_ACTIVITY_CANCEL_PERMISSION,
  CRM_ACTIVITY_COMPLETE_PERMISSION,
  CRM_ACTIVITY_CREATE_PERMISSION,
  CRM_ACTIVITY_READ_PERMISSION,
  CRM_ACTIVITY_RESPONSE_LIMIT_BYTES,
  CRM_ACTIVITY_UPDATE_PERMISSION,
  buildCrmActivityRequest,
  buildCrmActivityUpdateRequest,
  crmActivityCancelPath,
  crmActivityCompletePath,
  crmActivityPath,
  parseCreatedCrmActivity,
  validateCrmActivityForm,
  type CrmActivityErrors,
  type CrmActivityForm,
  type CrmPlannedActivity,
  type CrmTargetType,
} from "../crm-activity-contract";
import { readAllCrmActivities } from "./readCrmActivities";

export interface CrmActivitiesState {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canComplete: boolean;
  canCancel: boolean;
  activities: CrmPlannedActivity[];
  isLoading: boolean;
  loadError: string | null;
  reload: () => void;
  isSubmitting: boolean;
  writeError: string | null;
  fieldErrors: CrmActivityErrors;
  create: (form: CrmActivityForm) => Promise<boolean>;
  update: (
    activity: CrmPlannedActivity,
    form: CrmActivityForm,
  ) => Promise<CrmPlannedActivity | null>;
  complete: (activity: CrmPlannedActivity) => Promise<boolean>;
  cancel: (activity: CrmPlannedActivity) => Promise<boolean>;
  pendingActivityId: string | null;
}

export function useCrmActivities(
  targetId: string | null,
  targetType: CrmTargetType,
): CrmActivitiesState {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const copy = t.crmLeads.activities;
  const permissions = user?.permissions ?? [];
  const canRead = permissions.includes(CRM_ACTIVITY_READ_PERMISSION);
  const canCreate = permissions.includes(CRM_ACTIVITY_CREATE_PERMISSION);
  const canUpdate = permissions.includes(CRM_ACTIVITY_UPDATE_PERMISSION);
  const canComplete = permissions.includes(CRM_ACTIVITY_COMPLETE_PERMISSION);
  const canCancel = permissions.includes(CRM_ACTIVITY_CANCEL_PERMISSION);

  const [activities, setActivities] = useState<CrmPlannedActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CrmActivityErrors>({});
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  useEffect(() => {
    if (!targetId || !canRead) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      void (async () => {
        try {
          const rows = await readAllCrmActivities(targetId, targetType, controller.signal);
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
  }, [targetId, targetType, canRead, reloadCount, copy.loadFailed]);

  const create = useCallback(
    async (form: CrmActivityForm): Promise<boolean> => {
      if (!targetId) return false;
      if (!canCreate) {
        setWriteError(copy.createNotPermitted);
        return false;
      }

      const errors = validateCrmActivityForm(form);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        setWriteError(null);
        return false;
      }

      setIsSubmitting(true);
      setWriteError(null);
      const attempt = createCrmWriteAttempt();
      const outcome = await runCrmWrite({
        attempt,
        method: "post",
        path: CRM_ACTIVITIES_PATH,
        body: buildCrmActivityRequest(form, targetId, targetType),
        parse: parseCreatedCrmActivity,
        config: { maxResponseBytes: CRM_ACTIVITY_RESPONSE_LIMIT_BYTES },
      });
      setIsSubmitting(false);

      if (outcome.kind === "success") {
        reload();
        return true;
      }

      if (outcome.kind === "failed") {
        setWriteError(outcome.error.message || copy.createFailed);
        return false;
      }

      reload();
      setWriteError(copy.createAmbiguous);
      return false;
    },
    [targetId, targetType, canCreate, copy.createFailed, copy.createAmbiguous, copy.createNotPermitted, reload],
  );

  const runRowWrite = useCallback(
    async <T,>(options: {
      activity: CrmPlannedActivity;
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
          headers: { "If-Match": String(options.activity.version) },
          maxResponseBytes: CRM_ACTIVITY_RESPONSE_LIMIT_BYTES,
        },
      });
      setIsSubmitting(false);
      setPendingActivityId(null);

      if (outcome.kind === "success") {
        reload();
        return outcome.value;
      }

      if (outcome.kind === "failed") {
        setWriteError(outcome.error.message || options.failedMessage);
        return null;
      }

      reload();
      return null;
    },
    [copy.rowNotPermitted, reload],
  );

  const update = useCallback(
    async (
      activity: CrmPlannedActivity,
      form: CrmActivityForm,
    ): Promise<CrmPlannedActivity | null> => {
      const errors = validateCrmActivityForm(form, {
        allowPastDue: activity.dueAt.slice(0, 16) === form.dueAt,
      });
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        setWriteError(null);
        return null;
      }

      return runRowWrite({
        activity,
        permitted: canUpdate,
        method: "patch",
        path: crmActivityPath(activity.id),
        body: buildCrmActivityUpdateRequest(activity, form),
        parse: parseCreatedCrmActivity,
        failedMessage: copy.updateFailed,
      });
    },
    [canUpdate, copy.updateFailed, runRowWrite],
  );

  const complete = useCallback(
    async (activity: CrmPlannedActivity): Promise<boolean> => {
      const outcome = await runRowWrite({
        activity,
        permitted: canComplete,
        method: "post",
        path: crmActivityCompletePath(activity.id),
        body: {},
        parse: () => true,
        failedMessage: copy.completeFailed,
      });
      return outcome === true;
    },
    [canComplete, copy.completeFailed, runRowWrite],
  );

  const cancel = useCallback(
    async (activity: CrmPlannedActivity): Promise<boolean> => {
      const outcome = await runRowWrite({
        activity,
        permitted: canCancel,
        method: "post",
        path: crmActivityCancelPath(activity.id),
        body: {},
        parse: () => true,
        failedMessage: copy.cancelFailed,
      });
      return outcome === true;
    },
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
    create,
    update,
    complete,
    cancel,
    pendingActivityId,
  };
}
