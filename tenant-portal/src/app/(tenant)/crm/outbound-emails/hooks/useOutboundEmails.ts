"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import { hasPermission } from "@/design-system";
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

export function canSendOutboundEmail(permissions: readonly string[] | undefined): boolean {
  return hasPermission(permissions ?? [], "crm.email.send", true);
}

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
  const authScope = useAuthScopeKey(user);
  const scope = `${authScope}:${user?.featureEntitlements?.["crm.outbound_email"]}`;
  // POST /outbound-emails and /retry require `crm.email.send`; the reads
  // require `crm.activities.read`. There is no capabilities endpoint for this
  // family, so the send permission is the only signal available.
  const canSend = canSendOutboundEmail(user?.permissions) && user?.featureEntitlements?.["crm.outbound_email"] !== false;
  const [items, setItems] = useState<OutboundEmailListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [status, setStatusState] = useState<OutboundEmailStatus | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [retainedError, setRetainedError] = useState<NormalizedApiError | null>(null);
  const [dataScope, setDataScope] = useState(scope);
  const liveScope = useRef(scope);
  useLayoutEffect(() => { liveScope.current = scope; }, [scope]);
  const loadingCursor = useRef<string | null>(null);
  const loaded = useRef(false);
  const generation = useRef(0);
  const requests = useRef(new Set<AbortController>());

  const invalidate = useCallback(() => {
    generation.current += 1;
    for (const controller of requests.current) controller.abort();
    requests.current.clear();
  }, []);

  const fetchPage = useCallback(
    async (nextCursor: string | null) => {
      if (nextCursor && loadingCursor.current === nextCursor) return;
      const isFirstPage = nextCursor === null;
      if (isFirstPage) invalidate();
      loadingCursor.current = nextCursor;
      const requestGeneration = generation.current;
      const controller = new AbortController();
      requests.current.add(controller);
      const isCurrent = () =>
        requestGeneration === generation.current && !controller.signal.aborted && liveScope.current === scope;
      if (isFirstPage) {
        setIsLoading(true);
        setIsLoadingMore(false);
        setCursor(null);
        setHasNext(false);
      } else setIsLoadingMore(true);
      setQueryError(null);
      setRetainedError(null);
      try {
        const query = buildOutboundEmailListQuery({ status }, nextCursor);
        const response = await axiosClient.get<unknown>(
          `${OUTBOUND_EMAILS_PATH}?${query}`,
          { ...READ_CONFIG, signal: controller.signal },
        );
        if (!isCurrent()) return;
        const parsed = parseListResponse(response.data);
        setItems((current) =>
          isFirstPage ? parsed.items : [...current, ...parsed.items.filter((item) => !current.some((row) => row.outboundEmailId === item.outboundEmailId))],
        );
        setDataScope(scope);
        setCursor(parsed.nextCursor);
        setHasNext(parsed.hasNext);
        setHasLoaded(true);
        loaded.current = true;
      } catch (error) {
        if (!isCurrent() || isAbortError(error)) return;
        const failure = normalizeApiError(error);
        if (loaded.current && failure.status !== 403 && failure.status !== 401) setRetainedError(failure);
        else { setItems([]); setDataScope(scope); setQueryError(failure); }
      } finally {
        requests.current.delete(controller);
        if (isCurrent()) {
          loadingCursor.current = null;
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [status, invalidate, scope],
  );

  useEffect(() => {
    loaded.current = false;
    const effectGeneration = generation.current;
    queueMicrotask(() => {
      if (generation.current === effectGeneration) {
        setHasLoaded(false); setItems([]);
        void fetchPage(null);
      }
    });
    return invalidate;
  }, [fetchPage, invalidate]);

  return {
    t,
    lang,
    items: dataScope === scope ? items : [],
    hasLoaded: dataScope === scope && hasLoaded,
    hasNext,
    isLoading: isLoading || dataScope !== scope,
    isLoadingMore,
    queryError,
    retainedError,
    canSend,
    status,
    setStatus: (nextStatus: OutboundEmailStatus | "") => {
      if (nextStatus === status) return;
      invalidate();
      setStatusState(nextStatus);
    },
    // The cursor is handed back exactly as received — filter-bound and opaque,
    // never parsed or rebuilt.
    loadMore: () => {
      if (cursor && !isLoading && !isLoadingMore) void fetchPage(cursor);
    },
    reload: () => fetchPage(null),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
