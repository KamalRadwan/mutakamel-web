// The board's lanes as data: one page-numbered list per status, and the two
// changes the board makes to them without asking Core again — a page appended
// by "Load more", and an activity placed in the lane of its (new) status.

import { ACTIVITY_STATUSES, type Activity, type ActivityStatus } from "../activity-contract";
import { activityLaneSortDir } from "./activity-workspace-queries";

export interface ActivityLane {
  items: Activity[];
  /** Core's count for the lane — the column's count, not the cards loaded so far. */
  total: number;
  page: number;
  hasMore: boolean;
  /**
   * A card has moved into or out of the lane since its pages were read, so
   * Core's next page no longer starts where the loaded cards end: read alone,
   * it would skip a card or repeat one. The next "Load more" reads the lane
   * again, up to that page.
   */
  shifted?: boolean;
}

export type ActivityLanes = Partial<Record<ActivityStatus, ActivityLane>>;

export function isActivityStatus(status: string): status is ActivityStatus {
  return (ACTIVITY_STATUSES as readonly string[]).includes(status);
}

function compareDue(a: Activity, b: Activity): number {
  const byDue = Date.parse(a.dueAt) - Date.parse(b.dueAt);
  if (byDue !== 0) return byDue;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Puts an activity in the lane of its status, wherever it was before: an
 * optimistic move, the rollback of one, or the copy Core answered with. It
 * lands where the lane's own order puts it, so a moved card does not sit at the
 * top of a column sorted by due date.
 */
export function placeInLanes(lanes: ActivityLanes, activity: Activity): ActivityLanes {
  const status = isActivityStatus(activity.status) ? activity.status : null;
  const next: ActivityLanes = {};
  for (const laneStatus of ACTIVITY_STATUSES) {
    const lane = lanes[laneStatus];
    if (!lane) continue;
    const kept = lane.items.filter((item) => item.id !== activity.id);
    next[laneStatus] = kept.length === lane.items.length ? lane : {
      ...lane,
      items: kept,
      total: Math.max(0, lane.total - 1),
      // Leaving for another lane shifts Core's pages; a fresh copy put back
      // where it was does not.
      shifted: lane.shifted || laneStatus !== status,
    };
  }
  const target = status ? next[status] : undefined;
  if (!status || !target) return next;
  const arriving = !(lanes[status]?.items.some((item) => item.id === activity.id) ?? false);
  const direction = activityLaneSortDir(status) === "ASC" ? 1 : -1;
  const index = target.items.findIndex((item) => compareDue(activity, item) * direction < 0);
  const items = [...target.items];
  items.splice(index === -1 ? items.length : index, 0, activity);
  next[status] = { ...target, items, total: target.total + 1, shifted: target.shifted || arriving };
  return next;
}

/**
 * Appends the next page of one lane. A page answering for a lane that has since
 * moved on — reloaded, or already extended — is dropped, and a card already on
 * the board (moved into the lane while the page was in flight) is not doubled.
 */
export function withLanePage(lanes: ActivityLanes, status: ActivityStatus, page: ActivityLane): ActivityLanes {
  const lane = lanes[status];
  if (!lane || page.page !== lane.page + 1) return lanes;
  const seen = new Set(lane.items.map((item) => item.id));
  return {
    ...lanes,
    [status]: { ...page, items: [...lane.items, ...page.items.filter((item) => !seen.has(item.id))], shifted: lane.shifted },
  };
}

/**
 * Replaces a shifted lane with a fresh read of its pages 1…n (`pages`, in
 * order), read while the board showed `before`. A lane reloaded or extended
 * since is left alone. A card the board now shows in another lane stays
 * there — its move is still on its way to Core — and a lane that changed
 * again during the read stays shifted.
 */
export function withLaneReread(
  lanes: ActivityLanes,
  status: ActivityStatus,
  pages: readonly ActivityLane[],
  before: ActivityLane,
): ActivityLanes {
  const lane = lanes[status];
  const last = pages.at(-1);
  if (!lane || !last || lane.page !== before.page) return lanes;
  const elsewhere = new Set(
    ACTIVITY_STATUSES.filter((other) => other !== status).flatMap((other) => lanes[other]?.items.map((item) => item.id) ?? []),
  );
  const seen = new Set<string>();
  const items: Activity[] = [];
  for (const item of pages.flatMap((page) => page.items)) {
    if (seen.has(item.id) || elsewhere.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return {
    ...lanes,
    [status]: { items, total: last.total, page: last.page, hasMore: last.hasMore, shifted: lane !== before },
  };
}

export function laneItems(lanes: ActivityLanes | null, statuses: readonly ActivityStatus[]): Activity[] {
  return lanes ? statuses.flatMap((status) => lanes[status]?.items ?? []) : [];
}
