"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { adminCan } from "@/lib/auth/rbac";
import {
  countAdminUsers,
  listAdminUsers,
  listWebphoneExtensions,
  getAdminUser,
  isForbiddenError,
  listRoles,
  suspendAdminUser,
  activateAdminUser,
  deleteAdminUser,
  normalizeErrorCode,
  type ListUsersParams,
} from "../api/adminUsersApi";
import { getErrorMessageAndDetails } from "../utils/errorMapping";
import type { AdminUser, AdminRole, AdminUserErrorCode } from "../types";
import {
  claimAdminUserWriteIntent,
  retainAdminUserWriteIntent,
  settleAdminUserWriteIntent,
  type AdminUserWriteIntent,
} from "../model/writeIntent";
import { normalizeApiError } from "@/shared/api/normalized-api-error";

type DirectoryAction = "suspend" | "activate" | "delete";
/** `null` where the route reported no total, so the card can say so. */
type DirectoryStatusCounts = {
  active: number | null;
  invited: number | null;
  suspended: number | null;
  superAdmins: number | null;
};
const UNKNOWN_STATUS_COUNTS: DirectoryStatusCounts = {
  active: null,
  invited: null,
  suspended: null,
  superAdmins: null,
};
type DirectoryActionCommand = {
  userId: string;
  action: DirectoryAction;
  body: Record<string, never> | null;
};

export function useUsers() {
  const router = useRouter();
  const { lang, t } = useI18n();
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const canReadWebphone = adminCan(currentUser, "admin.webphone.read");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [isSuperAdminFilter, setIsSuperAdminFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("DESC");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [users, setUsers] = useState<AdminUser[]>([]);
  // ownerId → extension number. Extensions live in the WebPhone module, so the
  // directory joins them in rather than reading them off the user record.
  const [webphoneExtensions, setWebphoneExtensions] = useState(
    new Map<string, string>(),
  );
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [rolesForbidden, setRolesForbidden] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AdminUserErrorCode | string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [activeModalUserId, setActiveModalUserId] = useState<string | null>(null);
  const [modalActionType, setModalActionType] = useState<"suspend" | "activate" | "delete" | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const actionIntentRef = useRef<AdminUserWriteIntent<DirectoryActionCommand> | null>(null);

  /**
   * UI-014. The four cards read as one breakdown of one population, but the
   * total came from the list's pagination metadata while active, invited and
   * super-admin were counted from whichever rows the current page happened to
   * hold. Past a single page the breakdown moved every time the operator
   * paged, and it never reconciled with the total printed beside it.
   *
   * Core exposes no summary route, so each card asks the list route for its
   * own count. They deliberately do not depend on `page` or `limit`: the cards
   * describe the filtered directory, the table describes one page of it.
   */
  const [statusCounts, setStatusCounts] =
    useState<DirectoryStatusCounts>(UNKNOWN_STATUS_COUNTS);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      queueMicrotask(() => setPage(1));
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    queueMicrotask(() => setPage(1));
  }, [statusFilter, roleFilter, isSuperAdminFilter, sortBy, sortDir, limit]);

  // Fetch roles for filter dropdown
  useEffect(() => {
    async function loadRolesData() {
      try {
        setRolesForbidden(false);
        const res = await listRoles({ page: 1, limit: 100, sortBy: "name", sortDir: "ASC" });
        const items = res?.data;
        if (Array.isArray(items)) {
          setRoles(items);
        } else if ((items as any)?.items) {
          setRoles((items as any).items);
        }
      } catch (err: any) {
        if (err?.response?.status === 403) {
          setRolesForbidden(true);
        }
      }
    }
    loadRolesData();
  }, []);

  /**
   * UI-012. Every completion wrote users, metrics and loading unconditionally,
   * with no generation and no abort, so a slow response for one filter landed
   * on top of a newer one: the operator changed the status filter, the older
   * request answered second, and the table showed rows that did not match the
   * filter shown above it.
   *
   * A monotonic generation is enough here - the guard is about which response
   * may commit, not about cancelling the request - and it is the same shape
   * `use-invoices-list` uses.
   */
  const requestGeneration = useRef(0);

  const fetchUsers = useCallback(async () => {
    const generation = ++requestGeneration.current;
    const isCurrent = () => generation === requestGeneration.current;
    setIsLoading(true);
    setError(null);
    setErrorCode(null);
    setPermissionDenied(false);

    try {
      // The extension list is a second resource, owned by another module:
      // losing it must leave one column empty, never fail the directory.
      const [res, extensions] = await Promise.all([
        listAdminUsers({
          page,
          limit,
          search: debouncedSearch || undefined,
          status: statusFilter,
          isSuperAdmin: isSuperAdminFilter,
          roleId: roleFilter,
          sortBy,
          sortDir,
        }),
        canReadWebphone ? listWebphoneExtensions().catch(() => []) : [],
      ]);

      if (!isCurrent()) return;

      setWebphoneExtensions(
        new Map(extensions.map((entry) => [entry.ownerId, entry.extension])),
      );

      const responseData = res?.data;
      const meta = res?.meta;

      const userList = Array.isArray(responseData) ? responseData : ((responseData as any)?.items || []);
      setUsers(userList);

      const total = meta?.total ?? (responseData as any)?.meta?.total ?? userList.length;
      const totalPgs = meta?.totalPages ?? (responseData as any)?.meta?.totalPages ?? 1;

      setTotalCount(total);
      setTotalPages(totalPgs);
    } catch (err: any) {
      if (!isCurrent()) return;
      const code = normalizeErrorCode(err);
      setErrorCode(code);

      if (isForbiddenError(err)) {
        setPermissionDenied(true);
      } else {
        const details = getErrorMessageAndDetails(err, lang);
        setError(details.message);
        toast.error(t.users.fetchLoadErrorTitle, details.message);
      }
    } finally {
      // Only the newest request owns the spinner; an older one finishing must
      // not clear it while the current one is still outstanding.
      if (isCurrent()) setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, roleFilter, isSuperAdminFilter, sortBy, sortDir, lang, t, toast, canReadWebphone]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchUsers();
    });
  }, [fetchUsers]);

  // Same guard as the directory, for the same reason: a slow count answering
  // after the filter moved on must not repaint the cards.
  const summaryGeneration = useRef(0);

  const fetchStatusCounts = useCallback(async () => {
    const generation = ++summaryGeneration.current;
    const scope: ListUsersParams = {
      search: debouncedSearch || undefined,
      status: statusFilter,
      isSuperAdmin: isSuperAdminFilter,
      roleId: roleFilter,
    };
    try {
      const [active, invited, suspended, superAdmins] = await Promise.all([
        countAdminUsers({ ...scope, status: "ACTIVE" }),
        countAdminUsers({ ...scope, status: "INVITED" }),
        countAdminUsers({ ...scope, status: "SUSPENDED" }),
        countAdminUsers({ ...scope, isSuperAdmin: "TRUE" }),
      ]);
      if (generation !== summaryGeneration.current) return;
      setStatusCounts({ active, invited, suspended, superAdmins });
    } catch {
      // The directory below reports the failure itself. The cards go blank
      // rather than keep standing behind numbers nothing has confirmed.
      if (generation !== summaryGeneration.current) return;
      setStatusCounts(UNKNOWN_STATUS_COUNTS);
    }
  }, [debouncedSearch, statusFilter, isSuperAdminFilter, roleFilter]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchStatusCounts();
    });
  }, [fetchStatusCounts]);

  const reload = useCallback(async () => {
    await Promise.all([fetchUsers(), fetchStatusCounts()]);
  }, [fetchUsers, fetchStatusCounts]);

  // Every card now states a count for the whole filtered directory: the total
  // is the list route's own pagination total, the rest are its counts for one
  // status each. Nothing here is a tally of the visible page.
  const summaryMetrics = useMemo(
    () => ({ total: totalCount, ...statusCounts }),
    [totalCount, statusCounts],
  );

  const activeModalUser = users.find((u) => u.id === activeModalUserId);

  const openModal = (userId: string, action: "suspend" | "activate" | "delete") => {
    if (currentUser?.id === userId) {
      toast.error(t.users.forbiddenActionTitle, t.users.forbiddenActionDesc);
      return;
    }
    setActiveModalUserId(userId);
    setModalActionType(action);
  };

  const closeModal = () => {
    if (isActionLoading || actionIntentRef.current?.ambiguous) return;
    setActiveModalUserId(null);
    setModalActionType(null);
    actionIntentRef.current = null;
  };

  const confirmModalAction = async () => {
    if (!activeModalUserId || !modalActionType) return;

    const command: DirectoryActionCommand = {
      userId: activeModalUserId,
      action: modalActionType,
      body: modalActionType === "delete" ? null : {},
    };
    const path = `/api/admin/core/v1/users/${encodeURIComponent(activeModalUserId)}${
      modalActionType === "delete" ? "" : `/${modalActionType}`
    }`;
    const intent = claimAdminUserWriteIntent(
      actionIntentRef.current,
      modalActionType === "delete" ? "DELETE" : "POST",
      path,
      command,
    );
    actionIntentRef.current = intent;
    setIsActionLoading(true);
    try {
      if (modalActionType === "delete") {
        await deleteAdminUser(activeModalUserId, intent.idempotencyKey);
        toast.success(t.users.deletedTitle, t.users.deletedFromListDesc);
      } else if (modalActionType === "suspend") {
        await suspendAdminUser(activeModalUserId, intent.idempotencyKey);
        toast.success(t.users.suspendedTitle, t.users.suspendedDesc);
      } else if (modalActionType === "activate") {
        await activateAdminUser(activeModalUserId, intent.idempotencyKey);
        toast.success(t.users.activatedTitle, t.users.activatedDesc);
      }

      actionIntentRef.current = null;
      setActiveModalUserId(null);
      setModalActionType(null);
      await reload();
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      actionIntentRef.current = settleAdminUserWriteIntent(intent, err, normalized);

      if (retainAdminUserWriteIntent(err, normalized)) {
        let current: AdminUser | null | undefined;
        try {
          current = await getAdminUser(activeModalUserId);
        } catch (readError: unknown) {
          const readCode = normalizeErrorCode(readError);
          current =
            readCode === "ADMIN_USER_NOT_FOUND" ||
            (readError as { response?: { status?: number } })?.response?.status === 404
              ? null
              : undefined;
        }
        const reconciled =
          modalActionType === "delete"
            ? current === null
            : current?.status === (modalActionType === "activate" ? "ACTIVE" : "SUSPENDED");
        if (reconciled) {
          actionIntentRef.current = null;
          setActiveModalUserId(null);
          setModalActionType(null);
          await reload();
          return;
        }
      }
      const details = getErrorMessageAndDetails(err, lang);
      toast.error(t.users.actionFailedTitle, details.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  return {
    lang,
    t,
    router,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter,
    isSuperAdminFilter,
    setIsSuperAdminFilter,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    page,
    setPage,
    limit,
    setLimit,
    totalPages,
    totalCount,
    isLoading,
    error,
    errorCode,
    permissionDenied,
    rolesForbidden,
    users,
    webphoneExtensions,
    roles,
    summaryMetrics,
    isInviteModalOpen,
    setIsInviteModalOpen,
    activeModalUser,
    modalActionType,
    openModal,
    closeModal,
    confirmModalAction,
    isActionLoading,
    refresh: reload,
  };
}
