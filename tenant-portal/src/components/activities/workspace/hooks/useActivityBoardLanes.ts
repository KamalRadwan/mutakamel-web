"use client";

import { useRef, useState } from "react";
import { readCoreData } from "@/lib/api/envelope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  ACTIVITY_LIST_RESPONSE_BYTES,
  activityListPath,
  type Activity,
  type ActivityFilters,
  type ActivityStatus,
} from "../../activity-contract";
import { parseActivityPage } from "../../activity-parsers";
import {
  laneItems,
  placeInLanes,
  withLanePage,
  withLaneReread,
  type ActivityLane,
  type ActivityLanes,
} from "../activity-board-lanes";
import { activityLaneQuery } from "../activity-workspace-queries";
import { useActivityWorkspaceRead } from "./useActivityWorkspaceRead";

export interface ActivityBoardRequest {
  filters: ActivityFilters;
  /** The lanes on show, in column order — the status filter narrows them. */
  statuses: readonly ActivityStatus[];
}

async function readLane(filters: ActivityFilters, status: ActivityStatus, page: number, signal?: AbortSignal): Promise<ActivityLane> {
  const result = parseActivityPage(await readCoreData(activityListPath(activityLaneQuery(filters, status, page)), {
    signal,
    cache: "no-store",
    maxResponseBytes: ACTIVITY_LIST_RESPONSE_BYTES,
  }));
  // An answer for a page the lane did not ask for would put every card after
  // it in the wrong place.
  if (result.page !== page) throw new Error("Invalid activities response.");
  return { items: result.items, total: result.total, page: result.page, hasMore: result.hasNext };
}

export interface ActivityBoardLanes {
  lanes: ActivityLanes | null;
  /** Every loaded card, lane by lane — BoardView groups them again by status. */
  items: Activity[];
  isLoading: boolean;
  error: NormalizedApiError | null;
  denied: boolean;
  loadingMore: ReadonlySet<ActivityStatus>;
  reload: () => void;
  loadMore: (status: ActivityStatus) => void;
  /** Shows an activity in the lane of its status — an optimistic move, its rollback, or Core's copy. */
  place: (activity: Activity) => void;
}

/**
 * The board: one `GET activities?statuses=<status>` per lane, 25 cards a page,
 * each lane paging on its own.
 *
 * The first page of every lane is read together, so a board is either whole or
 * an error — never three columns and a hole. A failed "Load more" leaves the
 * lane as it was and goes to `onLoadMoreFailed`.
 */
export function useActivityBoardLanes(
  request: ActivityBoardRequest | null,
  onLoadMoreFailed: (error: NormalizedApiError) => void,
): ActivityBoardLanes {
  const read = useActivityWorkspaceRead(request && {
    key: JSON.stringify(request),
    read: async (signal) => {
      const pages = await Promise.all(request.statuses.map((status) => readLane(request.filters, status, 1, signal)));
      const lanes: ActivityLanes = {};
      request.statuses.forEach((status, index) => {
        lanes[status] = pages[index];
      });
      return lanes;
    },
  });
  const [loadingMore, setLoadingMore] = useState<ReadonlySet<ActivityStatus>>(() => new Set());
  // Guards a second press that lands before React re-renders the first one's state.
  const inFlight = useRef(new Set<ActivityStatus>());

  function loadMore(status: ActivityStatus) {
    const lane = read.data?.[status];
    if (!request || !lane?.hasMore || inFlight.current.has(status)) return;
    inFlight.current.add(status);
    setLoadingMore((current) => new Set(current).add(status));
    // `update` belongs to the request on screen now; if the filters change
    // while this page is in flight, it drops the page instead of mixing boards.
    const { update } = read;
    // After a card moved in or out, Core's pages have shifted under the loaded
    // ones, so the lane is read again up to the next page instead.
    const next = lane.page + 1;
    const pages = lane.shifted ? Array.from({ length: next }, (_, index) => index + 1) : [next];
    Promise.all(pages.map((page) => readLane(request.filters, status, page)))
      .then((read) => update((lanes) => (
        lane.shifted ? withLaneReread(lanes, status, read, lane) : withLanePage(lanes, status, read[0])
      )))
      .catch((error: unknown) => onLoadMoreFailed(normalizeApiError(error)))
      .finally(() => {
        inFlight.current.delete(status);
        setLoadingMore((current) => {
          const next = new Set(current);
          next.delete(status);
          return next;
        });
      });
  }

  return {
    lanes: read.data,
    items: laneItems(read.data, request?.statuses ?? []),
    isLoading: read.isLoading,
    error: read.error,
    denied: read.denied,
    loadingMore,
    reload: read.reload,
    loadMore,
    place: (activity) => read.update((lanes) => placeInLanes(lanes, activity)),
  };
}
