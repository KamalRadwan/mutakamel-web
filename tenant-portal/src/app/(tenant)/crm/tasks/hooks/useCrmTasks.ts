"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import {
  SCOPE_UNRESOLVED_ERROR,
  useOrganizationScopeHeaders,
} from "@/hooks/useOrganizationScope";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import {
  TASKS_PATH,
  buildCreateTaskRequest,
  buildListQuery,
  buildUpdateTaskRequest,
  parseTasksPage,
  taskPath,
  type CreateTaskInput,
  type CrmTask,
  type CrmTaskStatus,
  type UpdateTaskInput,
} from "../../activities/activity-contract";

const PAGE_SIZE = 25;
const READ_CONFIG = { cache: "no-store", maxResponseBytes: 1_000_000 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
  nonReplayable: true,
} as const;

export interface TaskWriteResult {
  ok: boolean;
  replayed: boolean;
  error: NormalizedApiError | null;
}

/** `GET`/`POST /tasks` and `PATCH /tasks/:id` — task 8.21. */
export function useCrmTasks() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  // Update has no capabilities signal of its own: GET /leads/capabilities
  // reports `activities: { create }` only. Update stays on the scoped
  // permission string, and the backend re-checks owner scope on every write.
  const canUpdate =
    user?.permissions.some((permission) =>
      permission.startsWith("crm.activities.update"),
    ) ?? false;
  const [items, setItems] = useState<CrmTask[]>([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: PAGE_SIZE, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CrmTaskStatus | "">("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!branchId || !scope.ready) {
        setItems([]);
        setHasLoaded(false);
        // D4: an unresolved organization scope is a gap on THIS side. Sending
        // the request without the headers made the Gateway answer 400 and the
        // screen report a server rejection for a client-side condition.
        setQueryError(branchId && !scope.ready ? SCOPE_UNRESOLVED_ERROR : null);
        return;
      }
      setIsLoading(true);
      setQueryError(null);
      try {
        const query = buildListQuery(branchId, page, PAGE_SIZE, {
          status,
          search: search.trim(),
        });
        const response = await axiosClient.get<unknown>(
          `${TASKS_PATH}?${query}`,
          { ...READ_CONFIG, signal, headers: scope.headers },
        );
        const parsed = parseTasksPage(response.data);
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
    [branchId, page, scope, search, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const create = async (input: CreateTaskInput): Promise<TaskWriteResult> => {
    let body: Record<string, unknown>;
    try {
      body = buildCreateTaskRequest(input);
    } catch (error) {
      return { ok: false, replayed: false, error: localError(error) };
    }
    if (!scope.ready) {
      // D4: never send a scoped write with no scope — the Gateway 400 that
      // came back read as a server refusal of a perfectly good record.
      return { ok: false, replayed: false, error: SCOPE_UNRESOLVED_ERROR };
    }
    setIsSubmitting(true);
    try {
      const response = await axiosClient.post<unknown>(TASKS_PATH, body, {
        ...WRITE_CONFIG,
        headers: scope.headers,
      });
      // The 201 returns the full entity, but the list projection is narrower;
      // refetching keeps every row the same shape rather than splicing in a
      // richer object the table cannot render consistently.
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
    task: CrmTask,
    input: UpdateTaskInput,
  ): Promise<TaskWriteResult> => {
    let body: Record<string, unknown>;
    try {
      body = buildUpdateTaskRequest(input, task);
    } catch (error) {
      return { ok: false, replayed: false, error: localError(error) };
    }
    if (!scope.ready) {
      // D4: never send a scoped write with no scope — the Gateway 400 that
      // came back read as a server refusal of a perfectly good record.
      return { ok: false, replayed: false, error: SCOPE_UNRESOLVED_ERROR };
    }
    if (Object.keys(body).length === 0) {
      return { ok: true, replayed: false, error: null };
    }
    setIsSubmitting(true);
    const previous = items;
    // Optimistic: the row shows its new status immediately, and reverts with
    // an explanation if the write is refused.
    setItems((current) =>
      current.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              title: input.title.trim() || entry.title,
              status: input.status,
              // A cleared picker is `null`, not "keep the old date": the drawer
              // seeds `dueAt` from this same task, so null always means the
              // user emptied it — defect D8.
              dueAt: input.dueAt ? input.dueAt.toISOString() : null,
            }
          : entry,
      ),
    );
    try {
      const response = await axiosClient.patch<unknown>(
        taskPath(task.id),
        body,
        { ...WRITE_CONFIG, headers: scope.headers },
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
    status,
    setStatus: (next: CrmTaskStatus | "") => {
      setPage(1);
      setStatus(next);
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
