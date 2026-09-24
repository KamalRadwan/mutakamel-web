"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { readCoreData } from "@/lib/api/envelope";
import { normalizeApiError } from "@/lib/api/errors";
import {
  ACTIVITY_LIST_RESPONSE_BYTES,
  OPEN_ACTIVITY_STATUSES,
  activityListPath,
  type Activity,
  type ActivityTargetSelection,
} from "../activity-contract";
import { parseActivityPage } from "../activity-parsers";

/**
 * Every open activity of one record, soonest first, across all pages.
 *
 * No partial success: a failed page fails the read, because a list that
 * silently stopped at page two looks exactly like a record with less work on it.
 */
async function readRecordActivities(
  target: Pick<ActivityTargetSelection, "app" | "type" | "id">,
  signal: AbortSignal,
): Promise<Activity[]> {
  const activities: Activity[] = [];
  const seen = new Set<string>();
  for (let page = 1; ; page += 1) {
    signal.throwIfAborted();
    const path = activityListPath({
      page,
      sortDir: "ASC",
      statuses: OPEN_ACTIVITY_STATUSES,
      targetApp: target.app,
      targetType: target.type,
      targetId: target.id,
    });
    const result = parseActivityPage(await readCoreData(path, {
      signal,
      cache: "no-store",
      maxResponseBytes: ACTIVITY_LIST_RESPONSE_BYTES,
    }));
    for (const activity of result.items) {
      // A row seen twice means the set moved between pages — a retryable
      // failure is more honest than a list that doubled or skipped a row.
      if (seen.has(activity.id)) throw new Error("Activity pagination changed during read.");
      seen.add(activity.id);
      activities.push(activity);
    }
    if (result.page !== page || !result.hasNext) return activities;
  }
}

export interface RecordActivities {
  /** The session holds `activities.read` at all; without it nothing is read and nothing is listed. */
  readable: boolean;
  activities: Activity[];
  isLoading: boolean;
  /** The read failed for a reason other than access. */
  failed: boolean;
  /** Core refused the read. 403 is not an empty state, so a surface gates on this. */
  denied: boolean;
  reload: () => void;
}

interface RecordAnswer {
  key: string;
  activities: Activity[];
  failed: boolean;
  denied: boolean;
}

/**
 * The open activities of one record, for the modal's agenda and a detail
 * page's side panel. `target` null (or `enabled` false) reads nothing, so a
 * closed modal or a list of fifty cards does not hold fifty lists it is not
 * showing.
 */
export function useRecordActivities(target: ActivityTargetSelection | null, enabled: boolean): RecordActivities {
  const { user } = useTenantAuth();
  const canRead = user !== null
    && (user.isTenantOwner || user.permissions.includes("activities.read") || user.permissions.includes("activities.read.all"));
  const live = enabled && canRead ? target : null;
  // The record's identity as primitives: a caller that rebuilds the same
  // selection object on every render must not restart the read every render.
  const app = live?.app;
  const type = live?.type;
  const id = live?.id;
  const key = app && type && id ? `${app}|${type}|${id}` : null;
  const [answer, setAnswer] = useState<RecordAnswer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Bumped to ask again. The effect owns the AbortController, so a reload goes
  // through it and a slow earlier read can never overwrite a newer one.
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!key || !app || !type || !id) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      readRecordActivities({ app, type, id }, controller.signal)
        .then((activities) => {
          if (!controller.signal.aborted) setAnswer({ key, activities, failed: false, denied: false });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const denied = normalizeApiError(error).status === 403;
          setAnswer({ key, activities: [], failed: !denied, denied });
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [app, id, key, reloadCount, type]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const current = answer && answer.key === key ? answer : null;
  return {
    readable: canRead,
    activities: current?.activities ?? [],
    isLoading: key !== null && (isLoading || current === null),
    failed: current?.failed ?? false,
    denied: current?.denied ?? false,
    reload,
  };
}
