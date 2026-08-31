import { coreGet, corePatch, corePost } from "../core-api";
import {
  ACTIVITIES_PATH,
  ACTIVITY_TYPES_PATH,
  activitiesListPath,
  activityAssigneesPath,
  activityCancelPath,
  activityCompletePath,
  activityPath,
  parseActivity,
  parseActivityAssignees,
  parseActivityPage,
  parseActivityTypes,
  type Activity,
  type ActivityAssignee,
  type ActivityFilters,
  type ActivityPage,
  type ActivityTypeOption,
} from "./activities-contract";

const LIST_LIMIT_BYTES = 600_000;
const ROW_LIMIT_BYTES = 60_000;

/**
 * One activity plus the `ETag` its next write has to send back.
 *
 * `parseIfMatch` in this controller accepts `W/"n"`, `"n"` and a bare `n`, so
 * the header is echoed verbatim rather than re-derived — `email-config` accepts
 * only the strong form and answers 428 without one, and copying either
 * contract to the other is how that bug happens.
 */
export interface ActivityWithEtag {
  activity: Activity;
  etag: string;
}

function readEtag(headers: Headers, activity: Activity): string {
  return headers.get("etag") ?? `"${activity.version}"`;
}

export async function fetchActivities(options: {
  page: number;
  search: string;
  sortDir: "ASC" | "DESC";
  filters: ActivityFilters;
  signal?: AbortSignal;
}): Promise<ActivityPage> {
  const result = await coreGet(
    activitiesListPath(options.page, options.search, options.sortDir, options.filters),
    { signal: options.signal, maxResponseBytes: LIST_LIMIT_BYTES },
  );
  return parseActivityPage(result.data);
}

export async function fetchActivity(
  id: string,
  signal?: AbortSignal,
): Promise<ActivityWithEtag> {
  const result = await coreGet(activityPath(id), { signal, maxResponseBytes: ROW_LIMIT_BYTES });
  const activity = parseActivity(result.data);
  return { activity, etag: readEtag(result.headers, activity) };
}

export async function fetchActivityTypes(
  signal?: AbortSignal,
): Promise<ActivityTypeOption[]> {
  const result = await coreGet(ACTIVITY_TYPES_PATH, { signal, maxResponseBytes: ROW_LIMIT_BYTES });
  return parseActivityTypes(result.data);
}

export async function fetchActivityAssignees(options: {
  targetApp: string;
  targetType: string;
  targetId: string;
  search: string;
  signal?: AbortSignal;
}): Promise<ActivityAssignee[]> {
  const result = await coreGet(
    activityAssigneesPath(
      options.targetApp,
      options.targetType,
      options.targetId,
      options.search,
    ),
    { signal: options.signal, maxResponseBytes: LIST_LIMIT_BYTES },
  );
  return parseActivityAssignees(result.data);
}

/**
 * **201.** The idempotency key is supplied rather than left to the transport's
 * automatic one: a timed-out write has to be retried under the *same* key, and
 * a key generated inside the client is not visible to the caller that retries.
 */
export async function createActivity(
  body: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ActivityWithEtag> {
  const result = await corePost(ACTIVITIES_PATH, body, {
    headers: { "x-idempotency-key": idempotencyKey },
    maxResponseBytes: ROW_LIMIT_BYTES,
  });
  const activity = parseActivity(result.data);
  return { activity, etag: readEtag(result.headers, activity) };
}

export async function updateActivity(
  id: string,
  body: Record<string, unknown>,
  ifMatch: string,
  idempotencyKey: string,
): Promise<ActivityWithEtag> {
  const result = await corePatch(activityPath(id), body, {
    headers: { "If-Match": ifMatch, "x-idempotency-key": idempotencyKey },
    maxResponseBytes: ROW_LIMIT_BYTES,
  });
  const activity = parseActivity(result.data);
  return { activity, etag: readEtag(result.headers, activity) };
}

/** **200**, not 201 — `complete` and `cancel` are both `@HttpCode(200)`. */
export async function completeActivity(
  id: string,
  outcome: string | undefined,
  ifMatch: string,
  idempotencyKey: string,
): Promise<ActivityWithEtag> {
  const result = await corePost(activityCompletePath(id), outcome ? { outcome } : {}, {
    headers: { "If-Match": ifMatch, "x-idempotency-key": idempotencyKey },
    maxResponseBytes: ROW_LIMIT_BYTES,
  });
  const activity = parseActivity(result.data);
  return { activity, etag: readEtag(result.headers, activity) };
}

export async function cancelActivity(
  id: string,
  reason: string | undefined,
  ifMatch: string,
  idempotencyKey: string,
): Promise<ActivityWithEtag> {
  const result = await corePost(activityCancelPath(id), reason ? { reason } : {}, {
    headers: { "If-Match": ifMatch, "x-idempotency-key": idempotencyKey },
    maxResponseBytes: ROW_LIMIT_BYTES,
  });
  const activity = parseActivity(result.data);
  return { activity, etag: readEtag(result.headers, activity) };
}
