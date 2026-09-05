"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { CUSTOMER_PROFILE_TYPES, type CustomerProfileType } from "../../customer-profiles/hooks/useCustomerProfiles";

export interface OpportunityCardItem {
  id: string;
  title: string;
  stageId: string;
  customerProfileType: CustomerProfileType;
  customerDisplayName: string;
  customerCompanyName: string | null;
  customerPhone: string | null;
  customerCountry: string | null;
  customerCity: string | null;
  leadSourceName: string | null;
  ownerDisplayName: string | null;
  ownerAvatarUrl: string | null;
  importance: number;
  openActivityCount: number;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new Error("Invalid opportunity cards response.");
  }
  return candidate;
}

function requiredUuidV7(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (!isUUIDv7(candidate)) throw new Error("Invalid opportunity cards response.");
  return candidate;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requiredInteger(value: Record<string, unknown>, key: string, minimum = 0): number {
  const candidate = value[key];
  if (!Number.isInteger(candidate) || (candidate as number) < minimum) {
    throw new Error("Invalid opportunity cards response.");
  }
  return candidate as number;
}

function parseCard(value: unknown): OpportunityCardItem {
  const item = record(value);
  if (!item) throw new Error("Invalid opportunity cards response.");
  const profileType = item.customerProfileType;
  if (
    typeof profileType !== "string" ||
    !(CUSTOMER_PROFILE_TYPES as readonly string[]).includes(profileType)
  ) {
    throw new Error("Invalid opportunity cards response.");
  }
  const importance = requiredInteger(item, "importance");
  if (importance > 3) throw new Error("Invalid opportunity cards response.");
  return {
    id: requiredUuidV7(item, "id"),
    title: requiredString(item, "title"),
    stageId: requiredUuidV7(item, "stageId"),
    customerProfileType: profileType as CustomerProfileType,
    customerDisplayName: requiredString(item, "customerDisplayName"),
    customerCompanyName: nullableString(item.customerCompanyName),
    customerPhone: nullableString(item.customerPhone),
    customerCountry: nullableString(item.customerCountry),
    customerCity: nullableString(item.customerCity),
    leadSourceName: nullableString(item.leadSourceName),
    ownerDisplayName: nullableString(item.ownerDisplayName),
    ownerAvatarUrl: nullableString(item.ownerAvatarUrl),
    importance,
    openActivityCount: requiredInteger(item, "openActivityCount"),
  };
}

interface CardsPageInfo {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export function parseOpportunityCardsResponse(
  payload: unknown,
  expectedPipelineId: string,
): { items: OpportunityCardItem[]; totalCount: number; pageInfo: CardsPageInfo } {
  const data = record(payload);
  const pipeline = data && record(data.pipeline);
  const pageInfo = data && record(data.pageInfo);
  if (!data || !pipeline || !pageInfo || !Array.isArray(data.items)) {
    throw new Error("Invalid opportunity cards response.");
  }
  if (pipeline.id !== expectedPipelineId) {
    throw new Error("Invalid opportunity cards response.");
  }
  const items = data.items.map(parseCard);
  if (new Set(items.map(({ id }) => id)).size !== items.length) {
    throw new Error("Invalid opportunity cards response.");
  }
  const nextCursor =
    pageInfo.nextCursor === null || pageInfo.nextCursor === undefined
      ? null
      : typeof pageInfo.nextCursor === "string" && pageInfo.nextCursor.length > 0
        ? pageInfo.nextCursor
        : (() => {
            throw new Error("Invalid opportunity cards response.");
          })();
  const limit = requiredInteger(pageInfo, "limit", 1);
  if (typeof pageInfo.hasMore !== "boolean" || pageInfo.hasMore !== (nextCursor !== null)) {
    throw new Error("Invalid opportunity cards response.");
  }
  return {
    items,
    totalCount: requiredInteger(data, "totalCount"),
    pageInfo: { limit, hasMore: pageInfo.hasMore, nextCursor },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

// The card view's own purpose-built projection — GET /pipelines/:id/cards,
// cursor-paginated. Deliberately independent of the board hook: the board
// paginates per-stage, this paginates the whole pipeline as one flat list.
// See docs/api/crm-opportunities.md#card-response.
export function useOpportunityCards(
  pipelineId: string | null,
  branchId: string | null,
  stageId: string | null,
) {
  const [items, setItems] = useState<OpportunityCardItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageInfo, setPageInfo] = useState<CardsPageInfo>({ limit: 50, hasMore: false, nextCursor: null });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // The first page's failure, handed to CardView so the error state replaces
  // the empty state. A failed "load more" is a different thing — it leaves
  // real cards on screen — and gets its own state below.
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<NormalizedApiError | null>(null);
  const requestEpochRef = useRef(0);

  const fetchCards = useCallback(
    async (signal?: AbortSignal) => {
      if (!pipelineId || !branchId) {
        setItems([]);
        setTotalCount(0);
        setPageInfo({ limit: 50, hasMore: false, nextCursor: null });
        setIsLoading(false);
        return;
      }
      const requestEpoch = requestEpochRef.current + 1;
      requestEpochRef.current = requestEpoch;
      setIsLoading(true);
      setError(null);
      setLoadMoreError(null);
      try {
        const query = new URLSearchParams({ branchId, limit: "50" });
        // OpportunityCardQueryDto, verbatim: "`stageId` is optional so the UI
        // can offer an All tab without downloading all stages into the browser
        // first." So All sends no key at all — not an empty one, which
        // `@IsOptional()` would still hand to `@IsUUID('7')` for a 400.
        if (stageId) query.set("stageId", stageId);
        const response = await axiosClient.get<unknown>(
          `/api/tenant/crm/v1/pipelines/${encodeURIComponent(pipelineId)}/cards?${query.toString()}`,
          { signal, cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 },
        );
        const parsed = parseOpportunityCardsResponse(response.data, pipelineId);
        if (requestEpoch !== requestEpochRef.current) return;
        setItems(parsed.items);
        setTotalCount(parsed.totalCount);
        setPageInfo(parsed.pageInfo);
      } catch (caught) {
        if (isAbortError(caught) || requestEpoch !== requestEpochRef.current) return;
        setItems([]);
        setTotalCount(0);
        setPageInfo({ limit: 50, hasMore: false, nextCursor: null });
        setError(normalizeApiError(caught));
      } finally {
        if (!signal?.aborted && requestEpoch === requestEpochRef.current) setIsLoading(false);
      }
    },
    [branchId, pipelineId, stageId],
  );

  // A new stage is a new fetch key, so the cursor restarts here rather than
  // being carried over. It could not be carried over anyway: the server stamps
  // the pipeline, branch, stage (or "ALL") and a filter hash into the cursor
  // and rejects one decoded under a different set.
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void fetchCards(controller.signal);
    });
    return () => controller.abort();
  }, [fetchCards]);

  const loadMore = useCallback(async () => {
    if (!pipelineId || !branchId || isLoadingMore || !pageInfo.hasMore || !pageInfo.nextCursor) return;
    const requestEpoch = requestEpochRef.current;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const query = new URLSearchParams({
        branchId,
        limit: String(pageInfo.limit),
        cursor: pageInfo.nextCursor,
      });
      // The filter is repeated on every page. A cursor carries a position, not
      // the query it was cut from, and the stage it was cut under is part of
      // the context it is validated against — dropping it here would not
      // return an unfiltered page, it would reject the cursor.
      if (stageId) query.set("stageId", stageId);
      const response = await axiosClient.get<unknown>(
        `/api/tenant/crm/v1/pipelines/${encodeURIComponent(pipelineId)}/cards?${query.toString()}`,
        { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 },
      );
      const parsed = parseOpportunityCardsResponse(response.data, pipelineId);
      if (requestEpoch !== requestEpochRef.current) return;
      const existingIds = new Set(items.map(({ id }) => id));
      if (parsed.items.some(({ id }) => existingIds.has(id))) {
        throw new Error("Invalid opportunity cards response.");
      }
      setItems((current) => [...current, ...parsed.items]);
      setPageInfo(parsed.pageInfo);
    } catch (caught) {
      setLoadMoreError(normalizeApiError(caught));
    } finally {
      setIsLoadingMore(false);
    }
  }, [branchId, isLoadingMore, items, pageInfo, pipelineId, stageId]);

  return {
    items,
    totalCount,
    hasMore: pageInfo.hasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMoreError,
    loadMore,
    reload: fetchCards,
  };
}
