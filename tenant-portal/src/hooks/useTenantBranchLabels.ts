"use client";

import { useEffect, useState } from "react";
import { CORE_MAX_PAGE_LIMIT } from "@/app/(tenant)/core/contracts/core-page";
import { fetchOrgNodes } from "@/app/(tenant)/core/contracts/organization-contract";
import { useTenantAuth, type TenantUserProfile } from "@/context/AuthContext";
import { can } from "@/lib/auth/permission-scope";

type OrganizationLabelLevel = "branches" | "companies";
// Core OrganizationController list permissions.
const READ_PERMISSION: Record<OrganizationLabelLevel, string> = {
  branches: "org.branch.read",
  companies: "org.company.read",
};
const EMPTY_LABELS: ReadonlyMap<string, string> = new Map();
// Bound catalogue reads even when Core's /auth/me branch projection is truncated.
const MAX_LABEL_PAGES = 10;

interface SettledOrganizationLabels {
  readonly key: string;
  readonly labels: ReadonlyMap<string, string>;
}

function canReadOrganizationNodes(
  user: TenantUserProfile | null | undefined,
  permission: string,
): boolean {
  if (!user?.id) return false;
  if (user.isTenantOwner === true) return true;
  if (
    !Array.isArray(user.permissions) ||
    !user.permissions.includes(permission)
  ) {
    return false;
  }
  if (
    user.permissionScopes &&
    Object.hasOwn(user.permissionScopes, permission)
  ) {
    return can(user, permission);
  }
  return true;
}

/**
 * Resolves accessible UUIDs to their stored Core organization names via
 * bounded catalogue reads, kept strictly inside hook state keyed by
 * `realtimeAuthGeneration` and `user.id` so sign-out or actor switches drop it.
 */
function useOrganizationLabels(level: OrganizationLabelLevel, enabled: boolean): ReadonlyMap<string, string> {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const userId = typeof user?.id === "string" && user.id.length > 0 ? user.id : null;
  const accessibleIdsKey = JSON.stringify([...(level === "branches"
    ? user?.accessibleBranches ?? []
    : user?.accessibleCompanies ?? [])].sort());
  const permission = READ_PERMISSION[level];
  const permissionScopeKey = JSON.stringify(user?.permissionScopes?.[permission] ?? null);
  const cacheKey = userId !== null
    ? `${realtimeAuthGeneration ?? ""}:${userId}:${accessibleIdsKey}:${permissionScopeKey}` : null;
  const canRead = canReadOrganizationNodes(user, permission);
  const [settled, setSettled] = useState<SettledOrganizationLabels | null>(null);

  useEffect(() => {
    if (cacheKey === null || !canRead) {
      if (settled === null) return;
      const controller = new AbortController();
      queueMicrotask(() => {
        if (!controller.signal.aborted) setSettled(null);
      });
      return () => controller.abort();
    }

    if (!enabled || settled?.key === cacheKey) return;

    const controller = new AbortController();
    async function readLabels() {
      const accessible = new Set<string>(JSON.parse(accessibleIdsKey));
      const next = new Map<string, string>();
      for (let page = 1; page <= MAX_LABEL_PAGES; page += 1) {
        const result = await fetchOrgNodes(level, {
          page,
          search: "",
          limit: CORE_MAX_PAGE_LIMIT,
          signal: controller.signal,
          suppressForbiddenToast: true,
        });
        if (controller.signal.aborted) return;
        for (const node of result.items) {
          const trimmed = node.name.trim();
          if (trimmed && accessible.has(node.id)) next.set(node.id, trimmed);
        }
        if (!result.hasNext || result.items.length === 0 || next.size === accessible.size) break;
      }
      setSettled({ key: cacheKey as string, labels: next });
    }
    void readLabels()
      .catch(() => {
        if (!controller.signal.aborted) {
          setSettled({ key: cacheKey, labels: EMPTY_LABELS });
        }
      });

    return () => controller.abort();
  }, [accessibleIdsKey, canRead, cacheKey, enabled, level, settled]);

  return enabled && canRead && cacheKey !== null && settled?.key === cacheKey
    ? settled.labels
    : EMPTY_LABELS;
}

export function useTenantBranchLabels(enabled = true): ReadonlyMap<string, string> {
  return useOrganizationLabels("branches", enabled);
}

export function useTenantCompanyLabels(enabled = true): ReadonlyMap<string, string> {
  return useOrganizationLabels("companies", enabled);
}
