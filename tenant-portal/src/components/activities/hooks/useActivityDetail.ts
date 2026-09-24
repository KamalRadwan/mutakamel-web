"use client";

import { useCallback, useEffect, useState } from "react";
import { readCoreData } from "@/lib/api/envelope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { ACTIVITY_ROW_RESPONSE_BYTES, activityPath, type Activity } from "../activity-contract";
import { parseActivity } from "../activity-parsers";

/** `GET activities/:id` — the current version of one activity. */
export async function readActivity(id: string, signal?: AbortSignal): Promise<Activity> {
  return parseActivity(await readCoreData(activityPath(id), {
    signal,
    cache: "no-store",
    maxResponseBytes: ACTIVITY_ROW_RESPONSE_BYTES,
  }));
}

interface DetailState {
  id: string;
  activity: Activity | null;
  error: NormalizedApiError | null;
}

export interface ActivityDetail {
  /** The freshest copy this hook holds for the requested id, or null until one arrives. */
  activity: Activity | null;
  isLoading: boolean;
  error: NormalizedApiError | null;
  reload: () => void;
  /** Adopts the activity a write answered with, so a successful save costs no second read. */
  replace: (activity: Activity) => void;
}

/**
 * One activity, re-read from Core whenever a surface opens it.
 *
 * A list row is a snapshot: it may carry the version from before somebody
 * else's change, and every row write sends that version back as `If-Match`.
 * Reading the row again on open is what turns a stale snapshot into the
 * current one before the user acts on it rather than after a 409.
 */
export function useActivityDetail(activityId: string | null): ActivityDetail {
  const [state, setState] = useState<DetailState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // A counter the effect depends on, so a reload goes through the effect that
  // owns the AbortController — a slow first read can never land after a fast second.
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!activityId) return;
    const controller = new AbortController();
    // Deferred past the effect body: a synchronous setState there cascades an
    // extra render (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      readActivity(activityId, controller.signal)
        .then((activity) => {
          if (controller.signal.aborted) return;
          // Never step backwards: a write that answered while this read was
          // in flight already holds a newer version.
          setState((current) => current?.id === activityId && current.activity && current.activity.version > activity.version
            ? current
            : { id: activityId, activity, error: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setState((current) => ({
            id: activityId,
            activity: current?.id === activityId ? current.activity : null,
            error: normalizeApiError(error),
          }));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [activityId, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const replace = useCallback((activity: Activity) => {
    setState((current) => current?.id === activity.id && current.activity && current.activity.version > activity.version
      ? current
      : { id: activity.id, activity, error: null });
  }, []);

  const current = state && state.id === activityId ? state : null;
  return {
    activity: current?.activity ?? null,
    isLoading: isLoading && activityId !== null,
    error: current?.error ?? null,
    reload,
    replace,
  };
}
