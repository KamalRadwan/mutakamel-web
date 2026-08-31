"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useRealtimeResync } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  deleteTenantUser,
  fetchTenantUsers,
  inviteTenantUser,
  setTenantUserStatus,
  USER_LIMIT_REACHED_CODE,
  type InviteUserInput,
  type TenantUser,
  type TenantUserFilters,
  type UserStatus,
} from "../../contracts/user-contract";

export type UserRowAction = "suspend" | "activate" | "delete";

/**
 * Which lifecycle actions the backend will actually accept for one row.
 *
 * Copied from `TenantUsersService`, not guessed: `activate` refuses anything
 * that is not SUSPENDED with `INVALID_STATUS_TRANSITION`; `assertNotSelf` and
 * `assertNotOwner` run before every one of the three. Offering a control that
 * is guaranteed to 403 is worse than not offering it — the reason is surfaced
 * as a tooltip instead.
 */
export function allowedUserActions(
  user: TenantUser,
  actingUserId: string | null,
): Record<UserRowAction, boolean> {
  const isProtected = user.isTenantOwner || user.id === actingUserId;
  return {
    suspend: !isProtected && user.status !== "SUSPENDED" && user.status !== "DEACTIVATED",
    activate: !isProtected && user.status === "SUSPENDED",
    delete: !isProtected,
  };
}

export function useTenantUsers() {
  const { t, lang } = useI18n();
  const { user: actor } = useTenantAuth();
  const permissions = actor?.permissions ?? [];
  const canInvite = permissions.includes("users.user.invite");
  const canDeactivate = permissions.includes("users.user.deactivate");
  const canDelete = permissions.includes("users.user.delete");

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [filters, setFilters] = useState<TenantUserFilters>({});
  const [rows, setRows] = useState<TenantUser[]>([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: 25, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<NormalizedApiError | null>(null);
  /** The seat cap has its own screen state; it is an outcome, not a failure. */
  const [isSeatLimitReached, setIsSeatLimitReached] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    { user: TenantUser; action: UserRowAction } | null
  >(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setServerSearch(searchQuery.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsLoading(true);
      setQueryError(null);
      fetchTenantUsers({ page, search: serverSearch, filters, signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          setRows(result.items);
          setPageInfo({ page: result.page, limit: result.limit, total: result.total });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setRows([]);
          setQueryError(normalizeApiError(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [filters, page, serverSearch, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  useRealtimeResync(reload);

  const handleInvite = useCallback(
    async (input: InviteUserInput): Promise<boolean> => {
      setIsSubmitting(true);
      setMutationError(null);
      try {
        await inviteTenantUser(input);
        setIsInviteOpen(false);
        setIsSeatLimitReached(false);
        reload();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403 && normalized.code === USER_LIMIT_REACHED_CODE) {
          setIsSeatLimitReached(true);
          setIsInviteOpen(false);
        }
        setMutationError(normalized);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [reload],
  );

  const confirmPendingAction = useCallback(async () => {
    if (!pendingAction) return;
    const { user, action } = pendingAction;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      if (action === "delete") await deleteTenantUser(user.id);
      else await setTenantUserStatus(user.id, action);
      setPendingAction(null);
      reload();
    } catch (error) {
      setPendingAction(null);
      setMutationError(normalizeApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingAction, reload]);

  const setFilter = useCallback((patch: Partial<TenantUserFilters>) => {
    setPage(1);
    setFilters((current) => {
      const next = { ...current, ...patch };
      return Object.fromEntries(
        Object.entries(next).filter(([, value]) => Boolean(value)),
      ) as TenantUserFilters;
    });
  }, []);

  return useMemo(
    () => ({
      t,
      lang,
      actingUserId: actor?.id ?? null,
      canInvite,
      canDeactivate,
      canDelete,
      rows,
      pageInfo,
      page,
      setPage,
      isLoading,
      queryError,
      searchQuery,
      setSearchQuery,
      filters,
      setFilter,
      resetFilters: () => {
        setPage(1);
        setFilters({});
      },
      reload,
      isInviteOpen,
      openInvite: () => {
        if (!canInvite) return;
        setMutationError(null);
        setIsInviteOpen(true);
      },
      closeInvite: () => setIsInviteOpen(false),
      isSubmitting,
      mutationError,
      isSeatLimitReached,
      dismissSeatLimit: () => setIsSeatLimitReached(false),
      pendingAction,
      requestAction: (user: TenantUser, action: UserRowAction) =>
        setPendingAction({ user, action }),
      cancelAction: () => setPendingAction(null),
      confirmPendingAction,
      handleInvite,
      statusFilter: filters.status,
      setStatusFilter: (status: UserStatus | undefined) => setFilter({ status }),
    }),
    [
      actor?.id, canDeactivate, canDelete, canInvite, confirmPendingAction, filters,
      handleInvite, isInviteOpen, isLoading, isSeatLimitReached, isSubmitting, lang,
      mutationError, page, pageInfo, pendingAction, queryError, reload, rows,
      searchQuery, setFilter, t,
    ],
  );
}
