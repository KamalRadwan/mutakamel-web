"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import {
  computeReplacementDiff,
  useCan,
  type ReplacementDiff,
  type ReplacementItem,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permission-scope";
import { localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { isUUIDv7 } from "@/lib/uuid";
import {
  deleteTenantRole,
  fetchTenantRole,
  MAX_ROLE_PERMISSIONS,
  MAX_SYSTEM_ROLE_PERMISSIONS,
  setRolePermissions,
  updateTenantRole,
  type TenantRoleDetail,
} from "../../../contracts/role-contract";
import type { RoleBranchPermissionsDocument } from "../../contracts/role-branch-contract";
import { usePermissionCatalogue } from "./usePermissionCatalogue";

export function useRolePermissionEditor(id: string, onDeleted?: () => void) {
  const { t, lang } = useI18n();
  const { user, retryBootstrap } = useTenantAuth();
  const canUpdate = useCan("roles.role.update", { tenantWide: true });
  const canDelete = useCan("roles.role.delete", { tenantWide: true });
  const canReadUsers = useCan("users.user.read");
  const canReadPermissions = user?.permissions.includes("roles.permission.read") ?? false;
  const isTenantOwner = Boolean(user?.isTenantOwner);

  const [role, setRole] = useState<TenantRoleDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isMissing, setIsMissing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [writeError, setWriteError] = useState<NormalizedApiError | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [blockedDeleteError, setBlockedDeleteError] = useState<NormalizedApiError | null>(null);
  const [branchModalSession, setBranchModalSession] = useState<{
    mode: "edit" | "view";
    session: number;
  } | null>(null);
  const [savedBranchReceipt, setSavedBranchReceipt] = useState<string[] | null>(null);

  const catalogueState = usePermissionCatalogue({
    canReadPermissions,
    user,
    lang,
    reloadToken,
  });
  const {
    catalogueById,
    isCatalogueLoaded,
    isCatalogueTruncated,
    catalogueError,
    groups,
    filteredGroups,
    permissionSearch,
    setPermissionSearch,
    clearPermissionSearch,
    grantableIds,
    canGrantPermission,
  } = catalogueState;

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!isUUIDv7(id)) {
        setIsLoading(false);
        setIsMissing(true);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      setIsMissing(false);
      fetchTenantRole(id, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setRole(result);
          setSelectedIds(result.permissionIds);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const normalized = normalizeApiError(error);
          setRole(null);
          if (normalized.status === 404) setIsMissing(true);
          else setLoadError(normalized);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [id, reloadToken]);

  const reload = useCallback(() => {
    setIsConfirmOpen(false);
    setReloadToken((token) => token + 1);
  }, []);

  const isBranchMode =
    role?.permissionMode === "BRANCH" || writeError?.code === "ROLE_BRANCH_MODE_REQUIRED";
  const maxPermissions = role?.isSystem ? MAX_SYSTEM_ROLE_PERMISSIONS : MAX_ROLE_PERMISSIONS;
  const canViewBranchPermissions = isTenantOwner && canReadPermissions;
  const canAssignBranchPermissions =
    isTenantOwner && canUpdate && canReadPermissions && !(role?.isSystem ?? false);

  const hasCatalogueFailure = catalogueError !== null || isCatalogueTruncated;
  const hasUngrantablePermissions =
    isCatalogueLoaded &&
    (role?.permissionIds.some((permissionId) => !grantableIds.has(permissionId)) ?? false);
  const canEditPermissions =
    canUpdate &&
    canReadPermissions &&
    isCatalogueLoaded &&
    !hasCatalogueFailure &&
    !role?.isSystem &&
    !isBranchMode &&
    !hasUngrantablePermissions;
  const canSavePermissions =
    canEditPermissions &&
    selectedIds.length <= MAX_ROLE_PERMISSIONS &&
    selectedIds.every((permissionId) => grantableIds.has(permissionId));

  const baseline = useMemo(() => role?.permissionIds ?? [], [role]);
  const selectedSet = useMemo<ReadonlySet<string>>(() => new Set(selectedIds), [selectedIds]);
  const isDirty =
    selectedIds.length !== baseline.length ||
    selectedIds.some((value) => !baseline.includes(value));

  const diff = useMemo<ReplacementDiff>(() => {
    const toItems = (ids: string[]): ReplacementItem[] =>
      ids.map((permId) => {
        const perm = catalogueById.get(permId);
        return {
          id: permId,
          label: perm ? localizedValue(perm.nameAr, perm.nameEn, lang) : permId,
          hint: perm?.key,
        };
      });
    return computeReplacementDiff(toItems(baseline), toItems(selectedIds));
  }, [baseline, catalogueById, lang, selectedIds]);

  const toggle = useCallback(
    (permissionId: string) => {
      if (!canEditPermissions || !canGrantPermission(permissionId) || isSubmitting) return;
      setSelectedIds((current) =>
        current.includes(permissionId)
          ? current.filter((value) => value !== permissionId)
          : [...current, permissionId],
      );
    },
    [canEditPermissions, canGrantPermission, isSubmitting],
  );

  const save = useCallback(async () => {
    if (!role || !isDirty || !isCatalogueLoaded || hasCatalogueFailure || !canSavePermissions || isSubmitting) {
      return;
    }
    const stillAuthorized = selectedIds.every((permId) => {
      const perm = catalogueById.get(permId);
      return perm !== undefined && can(user, perm.key, { tenantWide: true });
    });
    if (!stillAuthorized) return;

    setIsSubmitting(true);
    setWriteError(null);
    try {
      const updated = await setRolePermissions(role.id, selectedIds);
      setRole(updated);
      setSelectedIds(updated.permissionIds);
      setIsConfirmOpen(false);
      await retryBootstrap();
    } catch (error) {
      setWriteError(normalizeApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [canSavePermissions, catalogueById, hasCatalogueFailure, isCatalogueLoaded, isDirty, isSubmitting, retryBootstrap, role, selectedIds, user]);

  const rename = useCallback(
    async (body: { name?: string; description?: string }): Promise<boolean> => {
      if (!role || role.isSystem || !canUpdate) return false;
      setIsSubmitting(true);
      setWriteError(null);
      try {
        setRole(await updateTenantRole(role.id, body));
        setIsRenameOpen(false);
        return true;
      } catch (error) {
        setWriteError(normalizeApiError(error));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canUpdate, role],
  );

  const removeRole = useCallback(async () => {
    if (!role || role.isSystem || !canDelete || isSubmitting) return;
    setIsSubmitting(true);
    setWriteError(null);
    try {
      await deleteTenantRole(role.id);
      setIsDeleteOpen(false);
      setRole(null);
      setIsMissing(true);
      onDeleted?.();
    } catch (error) {
      const normalized = normalizeApiError(error);
      setIsDeleteOpen(false);
      if (normalized.code === "ROLE_IN_USE") setBlockedDeleteError(normalized);
      else setWriteError(normalized);
    } finally {
      setIsSubmitting(false);
    }
  }, [canDelete, isSubmitting, onDeleted, role]);

  const openBranchModal = useCallback((mode: "edit" | "view") => {
    setBranchModalSession((prev) => ({ mode, session: (prev?.session ?? 0) + 1 }));
  }, []);

  const handleBranchSaved = useCallback(
    (_doc: RoleBranchPermissionsDocument, receiptLines: string[]) => {
      setBranchModalSession(null);
      setSavedBranchReceipt(receiptLines);
      setWriteError(null);
      reload();
    },
    [reload],
  );

  return {
    t, lang, role, groups, filteredGroups, permissionSearch, setPermissionSearch,
    clearPermissionSearch, isCatalogueLoaded, isCatalogueTruncated, selectedIds, selectedSet, diff,
    formatCount: (count: number) => formatNumber(count, lang),
    isDirty, isOverCap: selectedIds.length > maxPermissions,
    maxPermissions,
    isBranchMode, canViewBranchPermissions, canAssignBranchPermissions,
    canUpdate, canDelete, canReadUsers, canReadPermissions, canEditPermissions,
    canSavePermissions, canGrantPermission, hasUngrantablePermissions,
    isLoading, loadError, catalogueError, isMissing, reload, toggle,
    resetSelection: () => setSelectedIds(baseline),
    isConfirmOpen,
    openConfirm: () => isDirty && canSavePermissions && !isSubmitting && setIsConfirmOpen(true),
    handleConfirmOpenChange: (open: boolean) => { if (!open) setIsConfirmOpen(false); },
    isRenameOpen,
    openRename: () => { if (canUpdate && !role?.isSystem) { setWriteError(null); setIsRenameOpen(true); } },
    closeRename: () => { setIsRenameOpen(false); setWriteError(null); },
    isDeleteOpen,
    openDelete: () => { if (canDelete && !role?.isSystem) { setWriteError(null); setIsDeleteOpen(true); } },
    handleDeleteOpenChange: (open: boolean) => { if (!open) setIsDeleteOpen(false); },
    blockedDeleteError,
    handleDeleteBlockerOpenChange: (open: boolean) => { if (!open) setBlockedDeleteError(null); },
    branchModalSession,
    openBranchPermissions: () => openBranchModal(canAssignBranchPermissions ? "edit" : "view"),
    closeBranchModal: () => setBranchModalSession(null),
    handleBranchSaved,
    savedBranchReceipt,
    closeSavedBranchReceipt: () => setSavedBranchReceipt(null),
    viewSavedBranchPermissions: () => { setSavedBranchReceipt(null); openBranchModal("view"); },
    isSubmitting, writeError,
    save,
    rename,
    confirmDelete: () => { void removeRole(); },
  };
}
