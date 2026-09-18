"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  buildCustomerProfileBoardRequest,
  CUSTOMER_PROFILE_BOARD_LANE_LIMIT,
} from "../customer-profile-board-contract";
import type { CustomerProfileSearchState } from "../customer-profile-search-contract";
import {
  parseCustomerProfilesPageResponse,
  type CustomerProfileItem,
  type CustomerProfileStatus,
} from "./useCustomerProfiles";

export const CUSTOMER_PROFILE_BOARD_STATUSES: readonly CustomerProfileStatus[] = [
  "PROSPECT",
  "ACTIVE_CUSTOMER",
  "INACTIVE",
  "BLACKLISTED",
];

export interface CustomerProfileBoardLane {
  items: CustomerProfileItem[];
  total: number;
  page: number;
  hasMore: boolean;
}

const EMPTY_LANES: Record<string, CustomerProfileBoardLane> = {};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseCustomerProfileBoardLane(
  value: unknown,
  branchId: string,
  expectedStatus?: CustomerProfileStatus,
): { status: CustomerProfileStatus; lane: CustomerProfileBoardLane } {
  const row = record(value);
  const status = row?.status;
  if (
    !row ||
    typeof status !== "string" ||
    !CUSTOMER_PROFILE_BOARD_STATUSES.includes(status as CustomerProfileStatus) ||
    (expectedStatus && status !== expectedStatus)
  ) {
    throw new Error("Invalid customer profile board response.");
  }
  const page = parseCustomerProfilesPageResponse(row, branchId);
  if (page.items.some((item) => item.status !== status)) {
    throw new Error("Invalid customer profile board response.");
  }
  return {
    status: status as CustomerProfileStatus,
    lane: {
      items: page.items,
      total: page.total,
      page: page.page,
      hasMore: page.hasNext,
    },
  };
}

export function parseCustomerProfileBoardResponse(
  payload: unknown,
  branchId: string,
): Record<string, CustomerProfileBoardLane> {
  const board = record(payload);
  if (!board || !Array.isArray(board.statuses)) {
    throw new Error("Invalid customer profile board response.");
  }
  const entries = board.statuses.map((lane) =>
    parseCustomerProfileBoardLane(lane, branchId),
  );
  const ids = entries.map(({ status }) => status);
  if (
    ids.length !== CUSTOMER_PROFILE_BOARD_STATUSES.length ||
    new Set(ids).size !== ids.length ||
    CUSTOMER_PROFILE_BOARD_STATUSES.some((status) => !ids.includes(status))
  ) {
    throw new Error("Invalid customer profile board response.");
  }
  return Object.fromEntries(entries.map(({ status, lane }) => [status, lane]));
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function useCustomerProfileBoard({
  enabled,
  branchId,
  search,
  sort,
  revision,
}: {
  enabled: boolean;
  branchId: string | null;
  search: CustomerProfileSearchState;
  sort: { id: "displayName" | "createdAt"; direction: "asc" | "desc" };
  revision: number;
}) {
  const { user } = useTenantAuth();
  const [lanes, setLanes] = useState<Record<string, CustomerProfileBoardLane>>(
    EMPTY_LANES,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatuses, setLoadingStatuses] = useState<Set<string>>(new Set());
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const requestEpochRef = useRef(0);
  const loadMoreRef = useRef<Set<string>>(new Set());

  const requestBody = useCallback(
    (page: number) => {
      if (!branchId) {
        throw new Error("A branch is required to load the customer board.");
      }
      return buildCustomerProfileBoardRequest(
        search,
        {
          branchId,
          page,
          limit: CUSTOMER_PROFILE_BOARD_LANE_LIMIT,
          sortBy: sort.id,
          sortDir: sort.direction === "asc" ? "ASC" : "DESC",
        },
        user?.id,
      );
    },
    [branchId, search, sort.direction, sort.id, user?.id],
  );

  const readStatus = useCallback(
    async (
      status: CustomerProfileStatus,
      page: number,
      signal?: AbortSignal,
    ): Promise<CustomerProfileBoardLane> => {
      if (!branchId) {
        throw new Error("A branch is required to load the customer board.");
      }
      const response = await axiosClient.post<unknown>(
        `/api/tenant/crm/v1/customer-profiles/board/statuses/${encodeURIComponent(status)}`,
        requestBody(page),
        {
          signal,
          cache: "no-store",
          maxResponseBytes: 1024 * 1024,
          skipAutoIdempotency: true,
          replayAfterRefresh: true,
        },
      );
      const result = parseCustomerProfileBoardLane(
        response.data,
        branchId,
        status,
      ).lane;
      if (result.page !== page) {
        throw new Error("Invalid customer profile board response.");
      }
      return result;
    },
    [branchId, requestBody],
  );

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      const epoch = requestEpochRef.current + 1;
      requestEpochRef.current = epoch;
      if (
        !enabled ||
        !branchId ||
        (search.mode === "basic" &&
          search.basic.myCustomers &&
          !isUUIDv7(user?.id))
      ) {
        setLanes(EMPTY_LANES);
        setError(null);
        setIsLoading(false);
        return false;
      }
      setIsLoading(true);
      setError(null);
      try {
        const response = await axiosClient.post<unknown>(
          "/api/tenant/crm/v1/customer-profiles/board",
          requestBody(1),
          {
            signal,
            cache: "no-store",
            maxResponseBytes: 2 * 1024 * 1024,
            skipAutoIdempotency: true,
            replayAfterRefresh: true,
          },
        );
        if (signal?.aborted || epoch !== requestEpochRef.current) return false;
        setLanes(parseCustomerProfileBoardResponse(response.data, branchId));
        return true;
      } catch (caught) {
        if (isAbortError(caught) || epoch !== requestEpochRef.current) return false;
        setLanes(EMPTY_LANES);
        setError(normalizeApiError(caught));
        return false;
      } finally {
        if (!signal?.aborted && epoch === requestEpochRef.current) {
          setIsLoading(false);
        }
      }
    },
    [branchId, enabled, requestBody, search, user?.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!controller.signal.aborted) void reload(controller.signal);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [reload, revision]);

  const loadMoreStatus = useCallback(
    async (status: string) => {
      if (
        !CUSTOMER_PROFILE_BOARD_STATUSES.includes(
          status as CustomerProfileStatus,
        )
      ) {
        return;
      }
      const lane = lanes[status];
      if (!lane?.hasMore || loadMoreRef.current.has(status)) return;
      const epoch = requestEpochRef.current;
      loadMoreRef.current.add(status);
      setLoadingStatuses((current) => new Set(current).add(status));
      setError(null);
      try {
        const next = await readStatus(
          status as CustomerProfileStatus,
          lane.page + 1,
        );
        if (epoch !== requestEpochRef.current) return;
        const known = new Set(lane.items.map(({ id }) => id));
        if (next.items.some(({ id }) => known.has(id))) {
          throw new Error("Invalid customer profile board response.");
        }
        setLanes((current) => {
          const currentLane = current[status];
          if (!currentLane || currentLane.page !== lane.page) return current;
          return {
            ...current,
            [status]: {
              ...next,
              items: [...currentLane.items, ...next.items],
            },
          };
        });
      } catch (caught) {
        if (epoch === requestEpochRef.current) {
          setError(normalizeApiError(caught));
        }
      } finally {
        loadMoreRef.current.delete(status);
        setLoadingStatuses((current) => {
          const next = new Set(current);
          next.delete(status);
          return next;
        });
      }
    },
    [lanes, readStatus],
  );

  const items = useMemo(
    () =>
      CUSTOMER_PROFILE_BOARD_STATUSES.flatMap(
        (status) => lanes[status]?.items ?? [],
      ),
    [lanes],
  );
  const totals = useMemo(
    () =>
      new Map(
        CUSTOMER_PROFILE_BOARD_STATUSES.map((status) => [
          status,
          lanes[status]?.total ?? 0,
        ]),
      ),
    [lanes],
  );

  return {
    items,
    totals,
    lanes,
    isLoading,
    loadingStatuses,
    error,
    reload,
    loadMoreStatus,
  };
}
