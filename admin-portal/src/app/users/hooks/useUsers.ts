"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/context/AuthContext";
import {
  listAdminUsers,
  listRoles,
  suspendAdminUser,
  activateAdminUser,
  deleteAdminUser,
  normalizeErrorCode,
} from "../api/adminUsersApi";
import { getErrorMessageAndDetails } from "../utils/errorMapping";
import type { AdminUser, AdminRole, AdminUserErrorCode } from "../types";

export function useUsers() {
  const router = useRouter();
  const { lang, t } = useI18n();
  const toast = useToast();
  const { user: currentUser } = useAuth();

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
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
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

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setErrorCode(null);
    setPermissionDenied(false);

    try {
      const res = await listAdminUsers({
        page,
        limit,
        search: debouncedSearch || undefined,
        status: statusFilter,
        isSuperAdmin: isSuperAdminFilter,
        roleId: roleFilter,
        sortBy,
        sortDir,
      });

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
      const code = normalizeErrorCode(err);
      setErrorCode(code);

      if (err?.response?.status === 403) {
        setPermissionDenied(true);
      } else {
        const details = getErrorMessageAndDetails(err, lang);
        setError(details.message);
        toast.error(
          lang === "ar" ? "خطأ في التحميل" : "Load Error",
          details.message
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, roleFilter, isSuperAdminFilter, sortBy, sortDir, lang, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const activeModalUser = users.find((u) => u.id === activeModalUserId);

  const openModal = (userId: string, action: "suspend" | "activate" | "delete") => {
    if (currentUser?.id === userId) {
      toast.error(
        lang === "ar" ? "إجراء غير مسموح" : "Forbidden Action",
        lang === "ar" ? "لا يمكنك إجاء هذه العملية على حسابك الخاص." : "You cannot perform this action on your own account."
      );
      return;
    }
    setActiveModalUserId(userId);
    setModalActionType(action);
  };

  const closeModal = () => {
    if (isActionLoading) return;
    setActiveModalUserId(null);
    setModalActionType(null);
  };

  const confirmModalAction = async () => {
    if (!activeModalUserId || !modalActionType) return;
    
    setIsActionLoading(true);
    try {
      if (modalActionType === "delete") {
        await deleteAdminUser(activeModalUserId);
        toast.success(
          lang === "ar" ? "تم الحذف" : "Deleted",
          lang === "ar" ? "تم حذف المستخدم بنجاح" : "User deleted successfully"
        );
      } else if (modalActionType === "suspend") {
        await suspendAdminUser(activeModalUserId);
        toast.success(
          lang === "ar" ? "تم التعليق" : "Suspended",
          lang === "ar" ? "تم تعليق حساب المستخدم بنجاح" : "User suspended successfully"
        );
      } else if (modalActionType === "activate") {
        await activateAdminUser(activeModalUserId);
        toast.success(
          lang === "ar" ? "تم التنشيط" : "Activated",
          lang === "ar" ? "تم تنشيط حساب المستخدم بنجاح" : "User activated successfully"
        );
      }
      
      closeModal();
      fetchUsers();
    } catch (err: any) {
      const details = getErrorMessageAndDetails(err, lang);
      toast.error(
        lang === "ar" ? "فشل الإجراء" : "Action Failed",
        details.message
      );
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
