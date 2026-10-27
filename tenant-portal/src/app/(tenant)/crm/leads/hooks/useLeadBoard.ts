"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  buildLeadBoardRequest,
  buildLeadInitialBoardRequest,
  LEAD_BOARD_STAGE_LIMIT,
} from "../lead-board-contract";
import type { LeadSearchState } from "../lead-search-contract";
import {
  parseLeadsResponse,
  type LeadItem,
  type LeadStage,
} from "../lead-list-contract";

export interface LeadBoardLane {
  items: LeadItem[];
  total: number;
  page: number;
  hasMore: boolean;
}

class LeadBoardStagesChangedError extends Error {}

const EMPTY_LANES: Record<string, LeadBoardLane> = {};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseLane(
  value: unknown,
  branchId: string,
  expectedStageId?: string,
): { stageId: string; lane: LeadBoardLane } {
  const row = record(value);
  const stage = row && record(row.stage);
  if (!row || !stage || typeof stage.id !== "string") {
    throw new Error("Invalid lead board response.");
  }
  const stageId = stage.id;
  if (expectedStageId && stageId !== expectedStageId) {
    throw new Error("Invalid lead board response.");
  }
  const page = parseLeadsResponse(row, branchId);
  if (page.items.some((item) => item.stageId !== stageId)) {
    throw new Error("Invalid lead board response.");
  }
  return {
    stageId,
    lane: {
      items: page.items,
      total: page.total,
      page: page.page,
      hasMore: page.hasNext,
    },
  };
}

export function parseLeadBoardResponse(
  payload: unknown,
  branchId: string,
  expectedStageIds: readonly string[],
): Record<string, LeadBoardLane> {
  const board = record(payload);
  if (!board || !Array.isArray(board.stages)) {
    throw new Error("Invalid lead board response.");
  }
  const entries = board.stages.map((lane) => parseLane(lane, branchId));
  const ids = entries.map(({ stageId }) => stageId);
  if (
    ids.length !== expectedStageIds.length ||
    new Set(ids).size !== ids.length ||
    expectedStageIds.some((id) => !ids.includes(id))
  ) {
    throw new LeadBoardStagesChangedError("Invalid lead board response.");
  }
  return Object.fromEntries(entries.map(({ stageId, lane }) => [stageId, lane]));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useLeadBoard({
  enabled,
  branchId,
  stages,
  refreshStages,
  search,
  sort,
}: {
  enabled: boolean;
  branchId: string | null;
  stages: LeadStage[];
  refreshStages: () => Promise<LeadStage[]>;
  search: LeadSearchState;
  sort: { id: "displayName" | "createdAt"; direction: "asc" | "desc" };
}) {
  const { user } = useTenantAuth();
  const [lanes, setLanes] = useState<Record<string, LeadBoardLane>>(EMPTY_LANES);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStageIds, setLoadingStageIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const requestEpochRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const reloadTimerRef = useRef<number | undefined>(undefined);
  const loadMoreRef = useRef<Set<string>>(new Set());
  const stagesRef = useRef(stages);
  useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);
  const hasStages = stages.length > 0;

  const requestBody = useCallback(
    (page: number, initial = false) => {
      if (!branchId) throw new Error("A branch is required to load the lead board.");
      const buildRequest = initial ? buildLeadInitialBoardRequest : buildLeadBoardRequest;
      return buildRequest(search, {
        branchId,
        page,
        limit: LEAD_BOARD_STAGE_LIMIT,
        sortBy: sort.id,
        sortDir: sort.direction === "asc" ? "ASC" : "DESC",
      }, user?.id);
    },
    [branchId, search, sort.direction, sort.id, user?.id],
  );

  const readStage = useCallback(
    async (stageId: string, page: number, signal?: AbortSignal): Promise<LeadBoardLane> => {
      if (!branchId) throw new Error("A branch is required to load the lead board.");
      const response = await axiosClient.post<unknown>(
        `/api/tenant/crm/v1/leads/board/stages/${encodeURIComponent(stageId)}`,
        requestBody(page),
        {
          signal,
          cache: "no-store",
          maxResponseBytes: 1024 * 1024,
          skipAutoIdempotency: true,
          replayAfterRefresh: true,
        },
      );
      const result = parseLane(response.data, branchId, stageId).lane;
      if (result.page !== page) {
        throw new Error("Invalid lead board response.");
      }
      return result;
    },
    [branchId, requestBody],
  );

  const reload = useCallback(async (signal?: AbortSignal) => {
    // A pending filter debounce must not supersede an awaited mutation reload.
    window.clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = undefined;
    const epoch = requestEpochRef.current + 1;
    requestEpochRef.current = epoch;
    const knownStages = stagesRef.current;
    if (
      !enabled ||
      !branchId ||
      !hasStages ||
      (search.mode === "basic" && search.basic.myLeads && !isUUIDv7(user?.id))
    ) {
      setLanes(EMPTY_LANES);
      setError(null);
      setIsLoading(false);
      return false;
    }

    hasLoadedRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const readBoard = (stageCount: number) => axiosClient.post<unknown>(
        "/api/tenant/crm/v1/leads/board",
        requestBody(1, true),
        {
          signal,
          cache: "no-store",
          // Every lane is up to 50 full list rows, so the board gets the list
          // page's 1 MiB budget once per stage rather than one fixed cap.
          maxResponseBytes: Math.max(1, stageCount) * 1024 * 1024,
          skipAutoIdempotency: true,
          replayAfterRefresh: true,
        },
      );
      const response = await readBoard(knownStages.length);
      if (signal?.aborted || epoch !== requestEpochRef.current) return false;
      try {
        setLanes(parseLeadBoardResponse(response.data, branchId, knownStages.map(({ id }) => id)));
      } catch (caught) {
        if (!(caught instanceof LeadBoardStagesChangedError)) throw caught;
        const currentStages = await refreshStages();
        stagesRef.current = currentStages;
        if (signal?.aborted || epoch !== requestEpochRef.current) return false;
        const retry = await readBoard(currentStages.length);
        if (signal?.aborted || epoch !== requestEpochRef.current) return false;
        setLanes(parseLeadBoardResponse(retry.data, branchId, currentStages.map(({ id }) => id)));
      }
      return true;
    } catch (caught) {
      if (isAbortError(caught) || epoch !== requestEpochRef.current) return false;
      setLanes(EMPTY_LANES);
      setError(normalizeApiError(caught));
      return false;
    } finally {
      if (!signal?.aborted && epoch === requestEpochRef.current) setIsLoading(false);
    }
  }, [branchId, enabled, hasStages, refreshStages, requestBody, search, user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    // The debounce coalesces the bursts of dependency changes after the board
    // is up; the first load has nothing to coalesce and would only wait.
    const timer = window.setTimeout(() => {
      if (!controller.signal.aborted) void reload(controller.signal);
    }, hasLoadedRef.current ? 250 : 0);
    reloadTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [reload]);

  const loadMoreStage = useCallback(async (stageId: string) => {
    const lane = lanes[stageId];
    if (!lane?.hasMore || loadMoreRef.current.has(stageId)) return;
    const epoch = requestEpochRef.current;
    loadMoreRef.current.add(stageId);
    setLoadingStageIds((current) => new Set(current).add(stageId));
    setError(null);
    try {
      const next = await readStage(stageId, lane.page + 1);
      if (epoch !== requestEpochRef.current) return;
      const known = new Set(lane.items.map(({ id }) => id));
      if (next.items.some(({ id }) => known.has(id))) {
        throw new Error("Invalid lead board response.");
      }
      setLanes((current) => {
        const currentLane = current[stageId];
        if (!currentLane || currentLane.page !== lane.page) return current;
        return {
          ...current,
          [stageId]: { ...next, items: [...currentLane.items, ...next.items] },
        };
      });
    } catch (caught) {
      if (epoch === requestEpochRef.current) setError(normalizeApiError(caught));
    } finally {
      loadMoreRef.current.delete(stageId);
      setLoadingStageIds((current) => {
        const next = new Set(current);
        next.delete(stageId);
        return next;
      });
    }
  }, [lanes, readStage]);

  const items = useMemo(
    () => stages.flatMap((stage) => lanes[stage.id]?.items ?? []),
    [lanes, stages],
  );
  const totals = useMemo(
    () => new Map(stages.map((stage) => [stage.id, lanes[stage.id]?.total ?? 0])),
    [lanes, stages],
  );

  return { items, totals, lanes, isLoading, loadingStageIds, error, reload, loadMoreStage };
}
