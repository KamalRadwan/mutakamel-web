"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { createWriteAttempt, runIdempotentWrite, type WriteAttempt } from "@/lib/api/idempotent-write";
import {
  ACTIVITIES_PATH,
  ACTIVITY_ROW_RESPONSE_BYTES,
  activityCancelPath,
  activityCompletePath,
  activityPath,
  activityStatusPath,
  type Activity,
} from "../activity-contract";
import { parseActivityWriteResponse } from "../activity-parsers";
import { activityErrorMessage } from "../activity-presentation";
import { readActivity } from "./useActivityDetail";

export type ActivityCommandKind = "create" | "update" | "start" | "moveBack" | "complete" | "cancel";

export type ActivityCommandResult =
  | { kind: "saved"; activity: Activity }
  /** A 409: the activity moved on. This is its current copy; the caller keeps the user's edits. */
  | { kind: "reloaded"; activity: Activity; message: string }
  /** `message` is null when the transport has already said it (a 403). */
  | { kind: "failed"; message: string | null }
  /** Nothing definite came back. `retry()` replays the same key. */
  | { kind: "ambiguous" }
  /**
   * The write applied but neither its answer nor a re-read of the activity
   * could be read. It is on the server — never offer a fresh Save for it.
   */
  | { kind: "applied"; message: string };

interface ActivityAmbiguousWrite {
  kind: ActivityCommandKind;
  idempotencyKey: string;
  correlationId?: string;
}

export interface ActivityCommands {
  pendingKind: ActivityCommandKind | null;
  /** The activity a row write is in flight or unresolved for, so its own controls can say so. */
  pendingActivityId: string | null;
  /**
   * A write is in flight, or its outcome is unknown. No other write may start
   * until it is retried or dismissed: the unresolved write's key is the only
   * safe way forward, and a later write must not take its place.
   */
  busy: boolean;
  /** The last failure, translated, for the surface's error slot. */
  error: string | null;
  ambiguous: ActivityAmbiguousWrite | null;
  create: (body: Record<string, unknown>) => Promise<ActivityCommandResult>;
  update: (activity: Activity, body: Record<string, unknown>) => Promise<ActivityCommandResult>;
  setStatus: (activity: Activity, status: "PLANNED" | "IN_PROGRESS") => Promise<ActivityCommandResult>;
  complete: (activity: Activity, outcome: string) => Promise<ActivityCommandResult>;
  cancel: (activity: Activity, reason: string) => Promise<ActivityCommandResult>;
  retry: () => Promise<ActivityCommandResult>;
  dismissAmbiguous: () => void;
  clearError: () => void;
}

interface ActivityWrite {
  kind: ActivityCommandKind;
  /** One attempt per user intent; a retry of that intent replays it — lib/api/idempotent-write.ts rule 1. */
  attempt: WriteAttempt;
  method: "post" | "patch";
  path: string;
  body: Record<string, unknown>;
  /** The row's version, for `If-Match`. Null on create. */
  activity: Activity | null;
}

// Codes that prove Core refused inside its own transaction, which rolled back
// and released the idempotency key: a definite failure even when it arrives as
// a 5xx, so it reads as the refusal it is rather than as "it may have worked".
const DEFINITE_SERVER_REFUSALS = new Set(["ACTIVITY_TARGET_RESOLVER_UNAVAILABLE"]);
const RELOAD_CODES = new Set(["ACTIVITY_VERSION_CONFLICT", "ACTIVITY_TERMINAL"]);

/**
 * Every write the activity template makes, with one discipline for all of them.
 *
 * A write carries `If-Match: "<version>"` (except create) and one idempotency
 * key per user intent. The four outcomes of `runIdempotentWrite` each land on
 * their own surface: success toasts; a refusal becomes a translated message;
 * a 409 re-reads the activity so the caller can keep the user's edits over the
 * current version; an unknown outcome is held with its key until the user
 * retries it — the SAME key — or dismisses it.
 */
export function useActivityCommands(): ActivityCommands {
  const { t } = useI18n();
  const toast = useToast();
  const [pending, setPending] = useState<ActivityWrite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState<{ write: ActivityWrite; error: NormalizedApiError } | null>(null);
  // Guards a second press that lands before React re-renders the first one's pending state.
  const inFlight = useRef(false);
  // The write whose outcome is unknown, for the guard in `run` — state lags a render behind.
  const unresolved = useRef<ActivityWrite | null>(null);
  // A create whose unknown outcome the user dismissed. Saving the same body
  // again is the same intent, so it replays that key: if the first one landed,
  // Core answers with it instead of creating the activity twice.
  const dismissedCreate = useRef<ActivityWrite | null>(null);

  const toastFor = useCallback((kind: ActivityCommandKind): string => {
    const toasts = t.activities.toasts;
    const byKind: Record<ActivityCommandKind, string> = {
      create: toasts.created,
      update: toasts.updated,
      start: toasts.started,
      moveBack: toasts.movedBack,
      complete: toasts.completed,
      cancel: toasts.cancelled,
    };
    return byKind[kind];
  }, [t]);

  const refuse = useCallback(async (write: ActivityWrite, failure: NormalizedApiError): Promise<ActivityCommandResult> => {
    const message = activityErrorMessage(t, failure);
    setError(message);
    if (message && write.activity && failure.code && RELOAD_CODES.has(failure.code)) {
      try {
        return { kind: "reloaded", activity: await readActivity(write.activity.id), message };
      } catch {
        // The re-read failing leaves the refusal itself as the whole answer.
      }
    }
    return { kind: "failed", message };
  }, [t]);

  const hold = useCallback((next: { write: ActivityWrite; error: NormalizedApiError } | null) => {
    unresolved.current = next?.write ?? null;
    setAmbiguous(next);
  }, []);

  const run = useCallback(async (write: ActivityWrite): Promise<ActivityCommandResult> => {
    // Every surface disables its writes while `busy`; this catches the press
    // that lands before that render.
    if (inFlight.current || (unresolved.current !== null && unresolved.current !== write)) {
      return { kind: "failed", message: null };
    }
    inFlight.current = true;
    setPending(write);
    setError(null);
    try {
      const outcome = await runIdempotentWrite({
        attempt: write.attempt,
        method: write.method,
        path: write.path,
        body: write.body,
        parse: parseActivityWriteResponse,
        config: {
          maxResponseBytes: ACTIVITY_ROW_RESPONSE_BYTES,
          ...(write.activity ? { headers: { "If-Match": `"${write.activity.version}"` } } : {}),
        },
      });
      // A definite answer settles a create's intent — except "still in flight",
      // which says the first attempt is alive and its key is still the one to use.
      const stillInFlight = outcome.kind === "failed" && outcome.error.code === "ACTIVITY_IDEMPOTENCY_IN_FLIGHT";
      if (write.kind === "create" && outcome.kind !== "ambiguous" && !stillInFlight) dismissedCreate.current = null;
      if (outcome.kind === "success") {
        hold(null);
        // `Idempotency-Replayed: true` lands here too: the write ran once and
        // this is its stored result, which is a success (idempotent-write.ts rule 2).
        toast.success(toastFor(write.kind));
        return { kind: "saved", activity: outcome.value };
      }
      if (outcome.kind === "failed") {
        hold(null);
        return await refuse(write, outcome.error);
      }
      if (outcome.kind === "ambiguous") {
        if (outcome.error.code && DEFINITE_SERVER_REFUSALS.has(outcome.error.code)) {
          if (write.kind === "create") dismissedCreate.current = null;
          hold(null);
          return await refuse(write, outcome.error);
        }
        hold({ write, error: outcome.error });
        return { kind: "ambiguous" };
      }
      // applied_unreadable. The write happened; only its answer is unreadable.
      hold(null);
      if (write.activity) {
        try {
          const activity = await readActivity(write.activity.id);
          toast.success(toastFor(write.kind));
          return { kind: "saved", activity };
        } catch {
          // Falls through to the message below: saved, but not shown.
        }
      }
      const message = t.activities.errors.appliedUnreadable;
      setError(message);
      return { kind: "applied", message };
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }, [hold, refuse, t, toast, toastFor]);

  const create = useCallback((body: Record<string, unknown>) => {
    const dismissed = dismissedCreate.current;
    const attempt = dismissed && JSON.stringify(dismissed.body) === JSON.stringify(body)
      ? dismissed.attempt
      : createWriteAttempt();
    return run({ kind: "create", attempt, method: "post", path: ACTIVITIES_PATH, body, activity: null });
  }, [run]);

  const update = useCallback((activity: Activity, body: Record<string, unknown>) =>
    run({ kind: "update", attempt: createWriteAttempt(), method: "patch", path: activityPath(activity.id), body, activity }), [run]);

  const setStatus = useCallback((activity: Activity, status: "PLANNED" | "IN_PROGRESS") => run({
    kind: status === "IN_PROGRESS" ? "start" : "moveBack",
    attempt: createWriteAttempt(),
    method: "post",
    path: activityStatusPath(activity.id),
    body: { status },
    activity,
  }), [run]);

  // Both notes are optional on the DTO; a blank one is simply not sent.
  const complete = useCallback((activity: Activity, outcome: string) => run({
    kind: "complete",
    attempt: createWriteAttempt(),
    method: "post",
    path: activityCompletePath(activity.id),
    body: outcome.trim() ? { outcome: outcome.trim() } : {},
    activity,
  }), [run]);

  const cancel = useCallback((activity: Activity, reason: string) => run({
    kind: "cancel",
    attempt: createWriteAttempt(),
    method: "post",
    path: activityCancelPath(activity.id),
    body: reason.trim() ? { reason: reason.trim() } : {},
    activity,
  }), [run]);

  const retry = useCallback(async (): Promise<ActivityCommandResult> =>
    ambiguous ? run(ambiguous.write) : { kind: "failed", message: null }, [ambiguous, run]);
  const dismissAmbiguous = useCallback(() => {
    if (unresolved.current?.kind === "create") dismissedCreate.current = unresolved.current;
    hold(null);
  }, [hold]);
  const clearError = useCallback(() => setError(null), []);

  return {
    pendingKind: pending?.kind ?? null,
    pendingActivityId: (pending ?? ambiguous?.write)?.activity?.id ?? null,
    busy: pending !== null || ambiguous !== null,
    error,
    ambiguous: ambiguous
      ? {
          kind: ambiguous.write.kind,
          idempotencyKey: ambiguous.write.attempt.idempotencyKey,
          correlationId: ambiguous.error.correlationId,
        }
      : null,
    create,
    update,
    setStatus,
    complete,
    cancel,
    retry,
    dismissAmbiguous,
    clearError,
  };
}
