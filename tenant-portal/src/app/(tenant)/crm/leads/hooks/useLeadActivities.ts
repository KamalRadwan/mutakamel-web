"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { readCorePage } from "@/lib/api/envelope";
import { useI18n } from "@/i18n/I18nContext";
import {
  createCrmWriteAttempt,
  runCrmWrite,
} from "../../shared/crm-write";
import {
  LEAD_ACTIVITIES_PATH,
  LEAD_ACTIVITY_CREATE_PERMISSION,
  LEAD_ACTIVITY_READ_PERMISSION,
  LEAD_ACTIVITY_RESPONSE_LIMIT_BYTES,
  buildLeadActivityRequest,
  leadPlannedActivitiesQuery,
  parseCreatedLeadActivity,
  parseLeadPlannedActivities,
  validateLeadActivityForm,
  type LeadActivityErrors,
  type LeadActivityForm,
  type LeadPlannedActivity,
} from "../lead-activity-contract";

export interface LeadActivitiesState {
  canRead: boolean;
  canCreate: boolean;
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

  const [activities, setActivities] = useState<LeadPlannedActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LeadActivityErrors>({});
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
          // `readCorePage` rather than `readCoreData`, for the query string:
          // composing it into the path at the call site produces a nested
          // template-literal type TypeScript cannot prove is still a
          // `CorePath`, and the only way past that is the cast the type exists
          // to prevent. Its `meta` is undefined here — `ActivitiesService.list`
          // returns no `hasPrev`, so Core's interceptor does not recognise the
          // result as paginated and leaves the counts inside `data`.
          const { data } = await readCorePage(
            LEAD_ACTIVITIES_PATH,
            leadPlannedActivitiesQuery(leadId),
            {
              signal: controller.signal,
              cache: "no-store",
              maxResponseBytes: LEAD_ACTIVITY_RESPONSE_LIMIT_BYTES,
            },
          );
          if (controller.signal.aborted) return;
          setActivities(parseLeadPlannedActivities(data));
          setLoadError(null);
        } catch (error) {
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

  return {
    canRead,
    canCreate,
    activities,
    isLoading,
    loadError,
    reload,
    isSubmitting,
    writeError,
    fieldErrors,
    create,
  };
}
