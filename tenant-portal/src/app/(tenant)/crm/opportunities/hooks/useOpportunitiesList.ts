"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeResync } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import type { OpportunityStatus, StageFlag } from "./pipeline-types";

export interface OpportunityListItem {
  id: string;
  branchId: string;
  customerProfileId: string;
  pipelineId: string;
  stageId: string;
  stageFlag: StageFlag;
  status: OpportunityStatus;
  title: string;
  importance: number;
  ownerUserId: string | null;
  expectedCloseDate: string | null;
  createdAt: string;
}

export interface OpportunitiesListPageInfo {
  page: number;
  limit: number;
  total: number;
}

export type OpportunitiesSort = {
  id: "title" | "amount" | "probabilityPercent" | "expectedCloseDate" | "createdAt";
  direction: "asc" | "desc";
};

const STAGE_FLAGS: StageFlag[] = [
  "NEW",
  "DISCOVERY",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
  "CONTRACTING",
  "ON_HOLD",
  "WON",
  "LOST",
];
const OPPORTUNITY_STATUSES: OpportunityStatus[] = ["IN_PROGRESS", "ON_HOLD", "WON", "LOST"];

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new Error("Invalid opportunities response.");
  }
  return candidate;
}

function requiredUuidV7(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (!isUUIDv7(candidate)) throw new Error("Invalid opportunities response.");
  return candidate;
}

function nullableUuidV7(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!isUUIDv7(value)) throw new Error("Invalid opportunities response.");
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function enumValue<T extends string>(value: unknown, options: readonly T[]): T {
  if (typeof value !== "string" || !options.includes(value as T)) {
    throw new Error("Invalid opportunities response.");
  }
  return value as T;
}

function parseItem(value: unknown, expectedBranchId: string): OpportunityListItem {
  const item = record(value);
  if (!item) throw new Error("Invalid opportunities response.");
  const branchId = requiredUuidV7(item, "branchId");
  if (branchId !== expectedBranchId) throw new Error("Invalid opportunities response.");
  const importance = item.importance;
  if (!Number.isInteger(importance) || (importance as number) < 0 || (importance as number) > 3) {
    throw new Error("Invalid opportunities response.");
  }
  return {
    id: requiredUuidV7(item, "id"),
    branchId,
    customerProfileId: requiredUuidV7(item, "customerProfileId"),
    pipelineId: requiredUuidV7(item, "pipelineId"),
    stageId: requiredUuidV7(item, "stageId"),
    stageFlag: enumValue(item.stageFlag, STAGE_FLAGS),
    status: enumValue(item.status, OPPORTUNITY_STATUSES),
    title: requiredString(item, "title"),
    importance: importance as number,
    ownerUserId: nullableUuidV7(item.ownerUserId),
    expectedCloseDate: nullableString(item.expectedCloseDate),
    createdAt: requiredString(item, "createdAt"),
  };
}

export function parseOpportunitiesListResponse(
  payload: unknown,
  expectedBranchId: string,
): { items: OpportunityListItem[]; pageInfo: OpportunitiesListPageInfo } {
  // CRM pages are FLAT. `paginatedReadModels` in crm-app returns
  // { items, total, page, limit, totalPages, hasNext, hasPrev } with no
  // `meta` wrapper anywhere in the module — that is Core's shape, not CRM's
  // (standing rule S1). This parser required `payload.meta` and threw
  // "Invalid opportunities response." on every real response; its test made it
  // look correct by feeding the same wrong shape back, and even named itself
  // after it. Corrected 2026-08-31 against crm-app source.
  const page = record(payload);
  if (!page || !Array.isArray(page.items)) {
    throw new Error("Invalid opportunities response.");
  }
  const items = page.items.map((item) => parseItem(item, expectedBranchId));
  const total = page.total;
  const pageNumber = page.page;
  const limit = page.limit;
  if (
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(pageNumber) ||
    !Number.isSafeInteger(limit) ||
    (total as number) < 0 ||
    (pageNumber as number) < 1 ||
    (limit as number) < 1
  ) {
    throw new Error("Invalid opportunities response.");
  }
  return {
    items,
    pageInfo: { page: pageNumber as number, limit: limit as number, total: total as number },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

// The table view's data source — the generic, page-numbered GET
// /opportunities list. Unlike the board/card projections, this returns the
// raw OpportunityEntity: no customer or owner display name. See Q14 in
// docs/build/OPEN-QUESTIONS.md.
export function useOpportunitiesList(
  branchId: string | null,
  pipelineId: string | null,
  stageId: string | null,
) {
  const [items, setItems] = useState<OpportunityListItem[]>([]);
  const [pageInfo, setPageInfo] = useState<OpportunitiesListPageInfo>({ page: 1, limit: 25, total: 0 });
  const [sort, setSort] = useState<OpportunitiesSort>({ id: "createdAt", direction: "desc" });
  const [isLoading, setIsLoading] = useState(false);
  // Handed to DataTable so a load failure replaces the empty state rather
  // than stacking a banner on top of "No matching opportunities".
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const requestEpochRef = useRef(0);
  const pageRef = useRef(1);

  const fetchList = useCallback(
    async (requestedPage: number, signal?: AbortSignal) => {
      if (!branchId) {
        setItems([]);
        setPageInfo({ page: 1, limit: 25, total: 0 });
        setIsLoading(false);
        return;
      }
      const requestEpoch = requestEpochRef.current + 1;
      requestEpochRef.current = requestEpoch;
      setIsLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({
          branchId,
          page: String(requestedPage),
          limit: "25",
          sortBy: sort.id,
          // , not . CRM validates with
          // forbidNonWhitelisted, so the wrong name is a 400 on every list
          // open rather than an ignored parameter — the values themselves
          // were always right.
          sortDir: sort.direction === "asc" ? "ASC" : "DESC",
        });
        if (pipelineId) query.set("pipelineId", pipelineId);
        // Absent rather than empty when nothing is chosen: `@IsOptional()`
        // skips only null/undefined, so `stageId=` would reach `@IsUUID('7')`
        // in OpportunitiesQueryDto and answer 400 instead of "every stage".
        if (stageId) query.set("stageId", stageId);
        const response = await axiosClient.get<unknown>(
          `/api/tenant/crm/v1/opportunities?${query.toString()}`,
          { signal, cache: "no-store", maxResponseBytes: 1024 * 1024 },
        );
        const parsed = parseOpportunitiesListResponse(response.data, branchId);
        if (requestEpoch !== requestEpochRef.current) return;
        pageRef.current = parsed.pageInfo.page;
        setItems(parsed.items);
        setPageInfo(parsed.pageInfo);
      } catch (caught) {
        if (isAbortError(caught) || requestEpoch !== requestEpochRef.current) return;
        setItems([]);
        setError(normalizeApiError(caught));
      } finally {
        if (!signal?.aborted && requestEpoch === requestEpochRef.current) setIsLoading(false);
      }
    },
    [branchId, pipelineId, sort, stageId],
  );

  // Every change to the fetch key — branch, pipeline, stage or sort — restarts
  // at page 1. Page 3 of one stage is not the page 3 being left, and on a
  // narrowed result it is usually past the end.
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void fetchList(1, controller.signal);
    });
    return () => controller.abort();
  }, [fetchList]);

  // Mirrors OPPORTUNITY_SORT_FIELDS on the server; anything else is a 400.
  const SORTABLE_IDS = [
    "title",
    "amount",
    "probabilityPercent",
    "expectedCloseDate",
    "createdAt",
  ] as const;

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  const reload = useCallback(() => void fetchList(pageRef.current), [fetchList]);
  useRealtimeResync(reload);

  return {
    items,
    pageInfo,
    sort,
    setSort: (next: { id: string; direction: "asc" | "desc" }) => {
      if ((SORTABLE_IDS as readonly string[]).includes(next.id)) {
        setSort(next as OpportunitiesSort);
      }
    },
    isLoading,
    error,
    setPage: (nextPage: number) => void fetchList(nextPage),
    reload,
  };
}
