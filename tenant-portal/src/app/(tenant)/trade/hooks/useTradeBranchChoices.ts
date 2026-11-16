"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { CORE_MAX_PAGE_LIMIT, type CorePage } from "@/app/(tenant)/core/contracts/core-page";
import { fetchOrgNodes, ORG_TREE_NODE_LIMIT_PER_LEVEL, type Branch } from "@/app/(tenant)/core/contracts/organization-contract";
import { can } from "@/lib/auth/permission-scope";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";

const READ_BRANCHES = "org.branch.read";
// Core caps its organization tree at 5,000 nodes per level.
const MAX_PAGES = Math.ceil(ORG_TREE_NODE_LIMIT_PER_LEVEL / CORE_MAX_PAGE_LIMIT);
const EMPTY_BRANCHES: string[] = [];

/** Flat auth branch IDs establish access; Core or a membership establishes company ownership. */
export function useTradeBranchChoices(companyId: string | null) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const { t } = useI18n();
  const [revision, setRevision] = useState(0);
  const accessibleKey = JSON.stringify([...(user?.accessibleBranches ?? [])].filter(isUUIDv7).sort());
  const accessible = useMemo(() => new Set<string>(JSON.parse(accessibleKey)), [accessibleKey]);
  const membershipsKey = JSON.stringify((user?.teamMemberships ?? []).map(({ companyId: company, branchId }) => [company, branchId]).sort());
  const fallback = useMemo(() => {
    const pairs = JSON.parse(membershipsKey) as Array<[string, string | null]>;
    return [...new Set(pairs.filter(([company, branch]) => company === companyId && branch !== null && accessible.has(branch))
      .map(([, branch]) => branch!))];
  }, [accessible, companyId, membershipsKey]);
  const canRead = Boolean(user?.id && (user.isTenantOwner || (user.permissions?.includes(READ_BRANCHES)
    && (!user.permissionScopes || !Object.hasOwn(user.permissionScopes, READ_BRANCHES) || can(user, READ_BRANCHES)))));
  const key = JSON.stringify([user?.id, realtimeAuthGeneration, companyId, accessibleKey, membershipsKey,
    canRead, user?.permissionScopes?.[READ_BRANCHES]]);
  const [settled, setSettled] = useState<{ key: string; revision: number; ids: string[]; error: NormalizedApiError | null } | null>(null);
  const refreshBranches = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!companyId || !canRead || accessible.size === 0) return;
    const controller = new AbortController();
    void (async () => {
      const ids: string[] = [];
      try {
        for (let page = 1; page <= MAX_PAGES; page += 1) {
          const result: CorePage<Branch> = await fetchOrgNodes("branches", { page, search: "", parentId: companyId,
            status: "ACTIVE", limit: CORE_MAX_PAGE_LIMIT, signal: controller.signal, suppressForbiddenToast: true });
          if (controller.signal.aborted) return;
          for (const branch of result.items) {
            if (branch.companyId === companyId && branch.status === "ACTIVE" && accessible.has(branch.id)) ids.push(branch.id);
          }
          if (!result.hasNext || result.items.length === 0 || ids.length === accessible.size) {
            setSettled({ key, revision, ids: [...new Set(ids)], error: null });
            return;
          }
        }
        throw new Error(t.quotationFlow.branchesUnavailable);
      } catch (error) {
        if (!controller.signal.aborted) setSettled((previous) => ({ key, revision,
          ids: [...new Set([...(previous?.key === key ? previous.ids : []), ...ids, ...fallback])], error: normalizeApiError(error) }));
      }
    })();
    return () => controller.abort();
  }, [accessible, canRead, companyId, fallback, key, revision, t.quotationFlow.branchesUnavailable]);

  const current = settled?.key === key;
  const unavailable = Boolean(companyId && accessible.size > 0 && !canRead && fallback.length === 0);
  return {
    branchIds: !companyId ? EMPTY_BRANCHES : current ? settled.ids : fallback,
    isLoadingBranches: Boolean(companyId && canRead && accessible.size > 0 && (!current || settled.revision !== revision)),
    branchesError: current ? settled.error : unavailable ? normalizeApiError(new Error(t.quotationFlow.branchesUnavailable)) : null,
    refreshBranches,
  };
}
