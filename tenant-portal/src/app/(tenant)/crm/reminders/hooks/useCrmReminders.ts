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
  REMINDERS_PATH,
  buildCreateReminderRequest,
  buildListQuery,
  parseRemindersPage,
  reminderCancelPath,
  type CreateReminderInput,
  type CrmReminder,
  type CrmReminderStatus,
} from "../../activities/activity-contract";

const PAGE_SIZE = 25;
const READ_CONFIG = { cache: "no-store", maxResponseBytes: 1_000_000 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
  nonReplayable: true,
} as const;

export interface ReminderWriteResult {
  ok: boolean;
  replayed: boolean;
  error: NormalizedApiError | null;
}

/** `GET`/`POST /reminders` and `PATCH /reminders/:id/cancel` — task 8.23. */
export function useCrmReminders() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scopeHeaders = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const canCancel =
    user?.permissions.some((permission) =>
      permission.startsWith("crm.activities.update"),
    ) ?? false;
  const [items, setItems] = useState<CrmReminder[]>([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: PAGE_SIZE, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CrmReminderStatus | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

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
        // No `search` here: listScopedReminders passes `undefined` for the
        // search predicate, so a search box would filter nothing.
        const query = buildListQuery(branchId, page, PAGE_SIZE, { status });
        const response = await axiosClient.get<unknown>(
          `${REMINDERS_PATH}?${query}`,
          { ...READ_CONFIG, signal, headers: scopeHeaders },
        );
        const parsed = parseRemindersPage(response.data);
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
    [branchId, page, scopeHeaders, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const create = async (
    input: CreateReminderInput,
  ): Promise<ReminderWriteResult> => {
    let body: Record<string, unknown>;
    try {
      body = buildCreateReminderRequest(input);
    } catch (error) {
      return { ok: false, replayed: false, error: localError(error) };
    }
    setIsSubmitting(true);
    try {
      const response = await axiosClient.post<unknown>(REMINDERS_PATH, body, {
        ...WRITE_CONFIG,
        headers: scopeHeaders,
      });
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

  const cancel = async (reminder: CrmReminder): Promise<ReminderWriteResult> => {
    setPendingId(reminder.id);
    const previous = items;
    setItems((current) =>
      current.map((entry) =>
        entry.id === reminder.id ? { ...entry, status: "CANCELLED" } : entry,
      ),
    );
    try {
      const response = await axiosClient.patch<unknown>(
        reminderCancelPath(reminder.id),
        undefined,
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
      setPendingId(null);
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
    pendingId,
    queryError,
    canCancel,
    branchIds,
    branchId,
    selectBranch: (next: string) => {
      selectBranch(next);
      setPage(1);
    },
    status,
    setStatus: (next: CrmReminderStatus | "") => {
      setPage(1);
      setStatus(next);
    },
    setPage,
    create,
    cancel,
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
