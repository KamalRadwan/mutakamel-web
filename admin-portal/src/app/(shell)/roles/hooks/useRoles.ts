"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { getApiRequestOutcome } from "@/lib/api/axiosClient";
import { adminCanAll, ADMIN_RBAC_CRITICAL } from "@/lib/auth/rbac";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  isAmbiguousWriteOutcome,
  shouldRotateWriteCommandKey,
} from "@/shared/api/write-command-recovery";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { rolesApi } from "../api";
import type { AdminRole } from "../contract";

const PAGE_SIZE = 20;

interface DeleteIntent {
  roleId: string;
  idempotencyKey: string;
  ambiguous: boolean;
}

export function useRoles() {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const canDelete = adminCanAll(user, ADMIN_RBAC_CRITICAL.ROLES_DELETE);

  const [search, setSearch] = useState("");
  const [isSystemFilter, setSystemFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [rolesOnPage, setRolesOnPage] = useState<AdminRole[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listError, setListError] = useState<NormalizedApiError | null>(null);
  const [revision, setRevision] = useState(0);
  const loadedQueryRef = useRef<{ page: number; isSystemFilter: string } | null>(
    null,
  );

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeModalRoleId, setActiveModalRoleId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<NormalizedApiError | null>(null);
  const [isDeleteAmbiguous, setIsDeleteAmbiguous] = useState(false);
  const deleteIntentRef = useRef<DeleteIntent | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const load = async () => {
      const sameQuery =
        loadedQueryRef.current?.page === page &&
        loadedQueryRef.current.isSystemFilter === isSystemFilter;
      setIsLoading(!sameQuery || rolesOnPage.length === 0);
      setIsRefreshing(sameQuery && rolesOnPage.length > 0);
      if (!sameQuery) {
        setRolesOnPage([]);
        setTotalItems(0);
        setTotalPages(0);
        setHasNext(false);
        setHasPrev(false);
      }
      setListError(null);
      try {
        const result = await rolesApi.list(
          {
            page,
            limit: PAGE_SIZE,
            ...(isSystemFilter === "ALL"
              ? {}
              : { isSystem: isSystemFilter === "TRUE" }),
          },
          controller.signal,
        );
        if (disposed) return;
        loadedQueryRef.current = { page, isSystemFilter };
        setRolesOnPage(result.items);
        setTotalItems(result.total);
        setTotalPages(result.totalPages);
        setHasNext(result.hasNext);
        setHasPrev(result.hasPrev);
      } catch (caught) {
        if (disposed || isAbortError(caught)) return;
        setListError(normalizeApiError(caught));
      } finally {
        if (!disposed) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };
    queueMicrotask(() => void load());
    return () => {
      disposed = true;
      controller.abort();
    };
    // The previous page is intentionally retained while a refresh is pending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSystemFilter, page, revision]);

  const roles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query
      ? rolesOnPage.filter((role) =>
          role.name.toLocaleLowerCase().includes(query),
        )
      : rolesOnPage;
  }, [rolesOnPage, search]);

  const setIsSystemFilter = useCallback((value: string) => {
    setSystemFilter(value);
    setPage(1);
  }, []);

  const refreshRoles = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  const activeModalRole = rolesOnPage.find(
    (role) => role.id === activeModalRoleId,
  );

  const openDeleteModal = useCallback(
    (roleId: string) => {
      if (!canDelete) {
        setDeleteError(forbiddenError());
        return;
      }
      if (
        deleteIntentRef.current?.ambiguous &&
        deleteIntentRef.current.roleId !== roleId
      ) {
        return;
      }
      setDeleteError(null);
      setIsDeleteAmbiguous(false);
      setActiveModalRoleId(roleId);
      setIsDeleteModalOpen(true);
    },
    [canDelete],
  );

  const closeDeleteModal = useCallback(() => {
    if (isDeleting || deleteIntentRef.current?.ambiguous) return;
    setActiveModalRoleId(null);
    setIsDeleteModalOpen(false);
    setDeleteError(null);
    setIsDeleteAmbiguous(false);
    deleteIntentRef.current = null;
  }, [isDeleting]);

  const confirmDelete = useCallback(async () => {
    if (!activeModalRoleId || isDeleting) return;
    if (!canDelete) {
      setDeleteError(forbiddenError());
      return;
    }
    const existing = deleteIntentRef.current;
    const intent =
      existing?.roleId === activeModalRoleId
        ? existing
        : {
            roleId: activeModalRoleId,
            idempotencyKey: generateUUIDv7(),
            ambiguous: false,
          };
    deleteIntentRef.current = intent;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await rolesApi.remove(intent.roleId, intent.idempotencyKey);
      deleteIntentRef.current = null;
      setIsDeleteAmbiguous(false);
      setActiveModalRoleId(null);
      setIsDeleteModalOpen(false);
      toast.success(
        lang === "ar" ? "تم الحذف" : "Deleted",
        lang === "ar"
          ? "تم حذف الدور بنجاح."
          : "Role deleted successfully.",
      );
      if (rolesOnPage.length === 1 && page > 1) setPage(page - 1);
      else refreshRoles();
    } catch (caught) {
      const error = normalizeApiError(caught);
      if (retainDeleteIntent(caught, error)) {
        deleteIntentRef.current = { ...intent, ambiguous: true };
        setIsDeleteAmbiguous(true);
      } else if (shouldRotateWriteCommandKey(error)) {
        deleteIntentRef.current = null;
        setIsDeleteAmbiguous(false);
      }
      setDeleteError(error);
      toast.error(
        lang === "ar" ? "فشل الحذف" : "Delete failed",
        error.message,
      );
    } finally {
      setIsDeleting(false);
    }
  }, [
    activeModalRoleId,
    canDelete,
    isDeleting,
    lang,
    page,
    refreshRoles,
    rolesOnPage.length,
    toast,
  ]);

  return {
    t,
    lang,
    search,
    setSearch,
    isSystemFilter,
    setIsSystemFilter,
    roles,
    rolesOnPage,
    totalItems,
    totalPages,
    page,
    pageSize: PAGE_SIZE,
    hasNext,
    hasPrev,
    setPage,
    isLoading,
    isRefreshing,
    listError,
    isCreateModalOpen,
    setIsCreateModalOpen,
    isDeleteModalOpen,
    openDeleteModal,
    closeDeleteModal,
    activeModalRole,
    confirmDelete,
    isDeleting,
    deleteError,
    isDeleteAmbiguous,
    refreshRoles,
  };
}

function forbiddenError(): NormalizedApiError {
  return {
    isNormalized: true,
    httpStatus: 403,
    errorCode: "ADMIN_PERMISSION_DENIED",
    errorCategory: "AUTHORIZATION",
    message: "Both admin.roles.delete and admin.roles.critical are required.",
  };
}

function retainDeleteIntent(
  original: unknown,
  error: NormalizedApiError,
): boolean {
  return (
    getApiRequestOutcome(original) === "settled-before-session-change" ||
    isAmbiguousWriteOutcome(error) ||
    /(?:UPSTREAM|UNAVAILABLE|TIMEOUT)/u.test(error.errorCode)
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export type { AdminRole } from "../contract";
