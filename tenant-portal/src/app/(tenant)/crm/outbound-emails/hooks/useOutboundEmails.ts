"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  OUTBOUND_EMAILS_PATH,
  buildOutboundEmailListQuery,
  parseListResponse,
  type OutboundEmailListItem,
  type OutboundEmailStatus,
} from "../outbound-email-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 1_000_000 } as const;

/**
 * `GET /outbound-emails` — cursor-paginated, and NOT branch-scoped.
 *
 * `ListCrmOutboundEmailsQueryDto` carries no `branchId` at all, unlike every
 * other CRM list in this module. Verified field by field against the DTO.
 *
 * Pages accumulate behind a "load more" control rather than being fed to
 * `DataTable`'s page/limit/total shape: this endpoint returns an opaque
 * `nextCursor` and no total, and inventing a page count to fill that shape is
 * exactly the fabricated-pagination failure in
 * docs/design/states.md#pagination-is-real-or-absent.
 */
export function useOutboundEmails() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  // POST /outbound-emails and /retry require `crm.email.send`; the reads
  // require `crm.activities.read`. There is no capabilities endpoint for this
  // family, so the send permission is the only signal available.
  const canSend = user?.permissions.includes("crm.email.send") ?? false;
  const [items, setItems] = useState<OutboundEmailListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [status, setStatus] = useState<OutboundEmailStatus | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);

  const fetchPage = useCallback(
    async (nextCursor: string | null, signal?: AbortSignal) => {
      const isFirstPage = nextCursor === null;
      if (isFirstPage) setIsLoading(true);
      else setIsLoadingMore(true);
      setQueryError(null);
      try {
        const query = buildOutboundEmailListQuery({ status }, nextCursor);
        const response = await axiosClient.get<unknown>(
          `${OUTBOUND_EMAILS_PATH}?${query}`,
          { ...READ_CONFIG, signal },
        );
        const parsed = parseListResponse(response.data);
        setItems((current) =>
          isFirstPage ? parsed.items : [...current, ...parsed.items],
        );
        setCursor(parsed.nextCursor);
        setHasNext(parsed.hasNext);
        setHasLoaded(true);
      } catch (error) {
        if (isAbortError(error)) return;
        if (isFirstPage) setItems([]);
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [status],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void fetchPage(null, controller.signal);
    });
    return () => controller.abort();
  }, [fetchPage]);

  return {
    t,
    lang,
    items,
    hasLoaded,
    hasNext,
    isLoading,
    isLoadingMore,
    queryError,
    canSend,
    status,
    setStatus,
    // The cursor is handed back exactly as received — filter-bound and opaque,
    // never parsed or rebuilt.
    loadMore: () => {
      if (cursor) void fetchPage(cursor);
    },
    reload: () => fetchPage(null),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
