"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Language } from "@/i18n/useLanguage";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permission-scope";
import { localizedValue } from "@/lib/format/localized";
import {
  fetchPermissionCatalogue,
  type TenantPermission,
} from "../../../contracts/role-contract";

/**
 * `GET /permissions` is a `PaginationQueryDto` list capped at 100 rows a page,
 * and the editor needs the whole catalogue to group it. The page walk is bounded
 * so a runaway `hasNext` cannot spin forever.
 */
export const MAX_CATALOGUE_PAGES = 20;

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: TenantPermission[];
}

interface UsePermissionCatalogueOptions {
  canReadPermissions: boolean;
  user: Parameters<typeof can>[0];
  lang: Language;
  reloadToken: number;
}

export function usePermissionCatalogue({
  canReadPermissions,
  user,
  lang,
  reloadToken,
}: UsePermissionCatalogueOptions) {
  const [catalogue, setCatalogue] = useState<TenantPermission[]>([]);
  const [isCatalogueLoaded, setIsCatalogueLoaded] = useState(false);
  const [isCatalogueTruncated, setIsCatalogueTruncated] = useState(false);
  const [catalogueError, setCatalogueError] = useState<NormalizedApiError | null>(null);
  const [permissionSearch, setPermissionSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setIsCatalogueLoaded(false);
      setIsCatalogueTruncated(false);
      setCatalogue([]);
      setCatalogueError(null);
      if (!canReadPermissions) return;
      void (async () => {
        try {
          const all: TenantPermission[] = [];
          let completed = false;
          for (let page = 1; page <= MAX_CATALOGUE_PAGES; page += 1) {
            const result = await fetchPermissionCatalogue(page, controller.signal);
            all.push(...result.items);
            if (!result.hasNext) {
              completed = true;
              break;
            }
          }
          if (controller.signal.aborted) return;
          if (!completed) {
            // Fail closed when `hasNext` stays true at the page ceiling so a
            // partial catalogue never renders false totals or enables save.
            setCatalogue([]);
            setIsCatalogueLoaded(false);
            setIsCatalogueTruncated(true);
            return;
          }
          setCatalogue(all);
          setIsCatalogueLoaded(true);
        } catch (error) {
          if (!controller.signal.aborted) {
            setCatalogue([]);
            setIsCatalogueLoaded(false);
            setCatalogueError(normalizeApiError(error));
          }
        }
      })();
    });
    return () => controller.abort();
  }, [canReadPermissions, reloadToken]);

  const catalogueById = useMemo(
    () => new Map(catalogue.map((permission) => [permission.id, permission])),
    [catalogue],
  );

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

  // Filtering narrows only what is rendered; `selectedIds` stays intact across
  // searches so saving never drops hidden permissions.
  const filteredGroups = useMemo<PermissionGroup[]>(() => {
    const query = permissionSearch.trim().toLowerCase();
    if (!query) return groups;
    const matches: PermissionGroup[] = [];
    for (const group of groups) {
      if (group.label.toLowerCase().includes(query) || group.key.toLowerCase().includes(query)) {
        matches.push(group);
        continue;
      }
      const matchingPermissions = group.permissions.filter(
        (permission) =>
          localizedValue(permission.nameAr, permission.nameEn, lang).toLowerCase().includes(query) ||
          permission.key.toLowerCase().includes(query) ||
          permission.nameAr.toLowerCase().includes(query) ||
          permission.nameEn.toLowerCase().includes(query),
      );
      if (matchingPermissions.length > 0) {
        matches.push({ ...group, permissions: matchingPermissions });
      }
    }
    return matches;
  }, [groups, lang, permissionSearch]);

  const grantableIds = useMemo(
    () =>
      new Set(
        catalogue
          .filter((permission) => can(user, permission.key, { tenantWide: true }))
          .map((permission) => permission.id),
      ),
    [catalogue, user],
  );

  const canGrantPermission = useCallback(
    (permissionId: string) => grantableIds.has(permissionId),
    [grantableIds],
  );

  const clearPermissionSearch = useCallback(() => setPermissionSearch(""), []);

  return {
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
  };
}
