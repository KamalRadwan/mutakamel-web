"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import {
  CALENDAR_EVENTS_PATH,
  buildCreateEventRequest,
  buildListQuery,
  buildUpdateEventRequest,
  calendarEventPath,
  parseEventsPage,
  type CreateCalendarEventInput,
  type CrmCalendarEvent,
  type UpdateCalendarEventInput,
} from "../../activities/activity-contract";

const PAGE_SIZE = 25;
const READ_CONFIG = { cache: "no-store", maxResponseBytes: 1_000_000 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
  nonReplayable: true,
} as const;

export interface EventWriteResult {
  ok: boolean;
  replayed: boolean;
  error: NormalizedApiError | null;
}

/** `GET`/`POST /calendar/events` and `PATCH /calendar/events/:id` — task 8.22. */
export function useCrmCalendarEvents() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scopeHeaders = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const canUpdate =
    user?.permissions.some((permission) =>
      permission.startsWith("crm.activities.update"),
    ) ?? false;
  const [items, setItems] = useState<CrmCalendarEvent[]>([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: PAGE_SIZE, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!branchId) {
        setItems([]);
        setHasLoaded(false);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const query = buildListQuery(branchId, page, PAGE_SIZE, {
          search: search.trim(),
        });
        const response = await axiosClient.get<unknown>(
          `${CALENDAR_EVENTS_PATH}?${query}`,
          { ...READ_CONFIG, signal, headers: scopeHeaders },
        );
        const parsed = parseEventsPage(response.data);
        setItems(parsed.items);
        setPageInfo({ page: parsed.page, limit: parsed.limit, total: parsed.total });
        setHasLoaded(true);
      } catch (error) {
        if (isAbortError(error)) return;
        setItems([]);
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [branchId, page, scopeHeaders, search],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const create = async (
    input: CreateCalendarEventInput,
  ): Promise<EventWriteResult> => {
    let body: Record<string, unknown>;
    try {
      body = buildCreateEventRequest(input);
    } catch (error) {
      return { ok: false, replayed: false, error: localError(error) };
    }
    setIsSubmitting(true);
    try {
      const response = await axiosClient.post<unknown>(
        CALENDAR_EVENTS_PATH,
        body,
        { ...WRITE_CONFIG, headers: scopeHeaders },
      );
      await load();
      return {
        ok: true,
        replayed: isIdempotentReplay(response.headers),
        error: null,
      };
    } catch (error) {
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = async (
    event: CrmCalendarEvent,
    input: UpdateCalendarEventInput,
  ): Promise<EventWriteResult> => {
    let body: Record<string, unknown>;
    try {
      body = buildUpdateEventRequest(input, event);
    } catch (error) {
      return { ok: false, replayed: false, error: localError(error) };
    }
    if (Object.keys(body).length === 0) {
      return { ok: true, replayed: false, error: null };
    }
    setIsSubmitting(true);
    const previous = items;
    setItems((current) =>
      current.map((entry) =>
        entry.id === event.id
          ? {
              ...entry,
              title: input.title.trim() || entry.title,
              startsAt: input.startsAt.toISOString(),
              endsAt: input.endsAt.toISOString(),
            }
          : entry,
      ),
    );
    try {
      const response = await axiosClient.patch<unknown>(
        calendarEventPath(event.id),
        body,
        { ...WRITE_CONFIG, headers: scopeHeaders },
      );
      await load();
      return {
        ok: true,
        replayed: isIdempotentReplay(response.headers),
        error: null,
      };
    } catch (error) {
      setItems(previous);
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    t,
    lang,
    items,
    pageInfo,
    hasLoaded,
    isLoading,
    isSubmitting,
    queryError,
    canUpdate,
    branchIds,
    branchId,
    selectBranch: (next: string) => {
      selectBranch(next);
      setPage(1);
    },
    search,
    setSearch: (next: string) => {
      setPage(1);
      setSearch(next);
    },
    setPage,
    create,
    update,
    reload: () => load(),
  };
}

function localError(error: unknown): NormalizedApiError {
  return {
    status: 0,
    code: error instanceof Error ? error.message : "INVALID_INPUT",
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
