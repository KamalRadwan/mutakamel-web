"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useCan } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permission-scope";
import { localizedValue } from "@/lib/format/localized";
import { isUUIDv7 } from "@/lib/uuid";
import {
  fetchPermissionCatalogue,
  fetchTenantRole,
  MAX_ROLE_PERMISSIONS,
  setRolePermissions,
  updateTenantRole,
  type TenantPermission,
  type TenantRoleDetail,
} from "../../../contracts/role-contract";

/**
 * `GET /permissions` is a `PaginationQueryDto` list capped at 100 rows a page,
 * and the editor needs the whole catalogue to group it. The page walk is bounded
 * so a runaway `hasNext` cannot spin forever.
 */
const MAX_CATALOGUE_PAGES = 20;

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: TenantPermission[];
}

export function useRolePermissionEditor(id: string) {
  const { t, lang } = useI18n();
  const { user, retryBootstrap } = useTenantAuth();
  const canUpdate = useCan("roles.role.update", { tenantWide: true });
  const canReadPermissions = user?.permissions.includes("roles.permission.read") ?? false;

  const [role, setRole] = useState<TenantRoleDetail | null>(null);
  const [catalogue, setCatalogue] = useState<TenantPermission[]>([]);
  const [isCatalogueLoaded, setIsCatalogueLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [catalogueError, setCatalogueError] = useState<NormalizedApiError | null>(null);
  const [isMissing, setIsMissing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [writeError, setWriteError] = useState<NormalizedApiError | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
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

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsCatalogueLoaded(false);
      setCatalogue([]);
      setCatalogueError(null);
      if (!canReadPermissions) return;
      void (async () => {
        try {
          const all: TenantPermission[] = [];
          for (let page = 1; page <= MAX_CATALOGUE_PAGES; page += 1) {
            const result = await fetchPermissionCatalogue(page, controller.signal);
            all.push(...result.items);
            if (!result.hasNext) break;
          }
          if (!controller.signal.aborted) {
            setCatalogue(all);
            setIsCatalogueLoaded(true);
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            setCatalogue([]);
            setCatalogueError(normalizeApiError(error));
          }
        }
      })();
    });
    return () => controller.abort();
  }, [canReadPermissions, reloadToken]);

  const groups = useMemo<PermissionGroup[]>(() => {
    const byGroup = new Map<string, PermissionGroup>();
    for (const permission of catalogue) {
      const existing = byGroup.get(permission.group);
      if (existing) {
        existing.permissions.push(permission);
        continue;
      }
      byGroup.set(permission.group, {
        key: permission.group,
        // The backend already localizes the group heading; never re-author it.
        label: localizedValue(permission.groupNameAr, permission.groupNameEn, lang),
        permissions: [permission],
      });
    }
    return [...byGroup.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [catalogue, lang]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const grantableIds = useMemo(() => new Set(catalogue
    .filter((permission) => can(user, permission.key, { tenantWide: true }))
    .map((permission) => permission.id)), [catalogue, user]);
  const canGrantPermission = useCallback((permissionId: string) =>
    grantableIds.has(permissionId), [grantableIds]);
  // Core validates the entire replacement, including unchanged permissions.
  // Unknown IDs fail closed until the full catalogue has been resolved.
  const hasUngrantablePermissions = isCatalogueLoaded &&
    (role?.permissionIds.some((permissionId) => !grantableIds.has(permissionId)) ?? false);
  const canEditPermissions = canUpdate && canReadPermissions && isCatalogueLoaded &&
    !catalogueError && !role?.isSystem && !hasUngrantablePermissions;
  const canSavePermissions = canEditPermissions && selectedIds.length <= MAX_ROLE_PERMISSIONS &&
    selectedIds.every((permissionId) => grantableIds.has(permissionId));

  const toggle = useCallback((permissionId: string) => {
    if (!canEditPermissions || !canGrantPermission(permissionId) || isSubmitting) return;
    setSelectedIds((current) =>
      current.includes(permissionId)
        ? current.filter((value) => value !== permissionId)
        : [...current, permissionId],
    );
  }, [canEditPermissions, canGrantPermission, isSubmitting]);

  const save = useCallback(async () => {
    if (!role || !canSavePermissions || isSubmitting) return;
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
  }, [canSavePermissions, isSubmitting, retryBootstrap, role, selectedIds]);

  const rename = useCallback(
    async (body: { name?: string; description?: string }): Promise<boolean> => {
      if (!role || !canUpdate) return false;
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

  const baseline = role?.permissionIds ?? [];
  const isDirty =
    selectedIds.length !== baseline.length ||
    selectedIds.some((value) => !baseline.includes(value));

  return {
    t,
    lang,
    role,
    groups,
    selectedIds,
    isDirty,
    isOverCap: selectedIds.length > MAX_ROLE_PERMISSIONS,
    maxPermissions: MAX_ROLE_PERMISSIONS,
    canUpdate,
    canReadPermissions,
    canEditPermissions,
    canSavePermissions,
    canGrantPermission,
    hasUngrantablePermissions,
    isLoading,
    loadError,
    catalogueError,
    isMissing,
    reload,
    toggle,
    resetSelection: () => setSelectedIds(baseline),
    isConfirmOpen,
    openConfirm: () => canSavePermissions && !isSubmitting && setIsConfirmOpen(true),
    closeConfirm: () => setIsConfirmOpen(false),
    isRenameOpen,
    openRename: () => {
      if (!canUpdate) return;
      setWriteError(null);
      setIsRenameOpen(true);
    },
    closeRename: () => setIsRenameOpen(false),
    isSubmitting,
    writeError,
    save,
    rename,
  };
}
