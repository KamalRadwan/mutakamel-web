"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { adminCan } from "@/lib/auth/rbac";
import {
  listAdminUsers,
  listWebphoneExtensions,
  getAdminUser,
  isForbiddenError,
  listRoles,
  suspendAdminUser,
  activateAdminUser,
  deleteAdminUser,
  normalizeErrorCode,
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

  const [summaryMetrics, setSummaryMetrics] = useState({
    total: 0,
    active: 0,
    invited: 0,
    suspended: 0,
    superAdmins: 0,
  });

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

      // Derive metrics accurately
      const activeCount = userList.filter((u: AdminUser) => u.status === "ACTIVE").length;
      const invitedCount = userList.filter((u: AdminUser) => u.status === "INVITED").length;
      const suspendedCount = userList.filter((u: AdminUser) => u.status === "SUSPENDED").length;
      const superAdminCount = userList.filter((u: AdminUser) => u.isSuperAdmin).length;

      setSummaryMetrics({
        total,
        active: activeCount,
        invited: invitedCount,
        suspended: suspendedCount,
        superAdmins: superAdminCount,
      });
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
      await fetchUsers();
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
          await fetchUsers();
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
    refresh: fetchUsers,
  };
}
