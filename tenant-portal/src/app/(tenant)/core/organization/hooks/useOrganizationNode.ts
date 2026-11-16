"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtimeResync } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  fetchOrgNode,
  type OrgLevel,
  type OrgNodeOf,
} from "../../contracts/organization-contract";
import { ORG_LEVEL_CONFIG } from "../level-config";
import { useOrgLookupResolver } from "./useOrgLookupResolver";

/**
 * One organization node for its deep-link detail screen, together with
 * permission-gated foreign-key resolution for parent nodes and team lead.
 *
 * A 404 is kept separate from every other failure: the request succeeded and
 * the answer was "this no longer exists", which `NotFoundState` renders without
 * a retry button because retrying can never change it.
 */
export function useOrganizationNode<L extends OrgLevel>(level: L, id: string) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const canReadApplicationAccess =
    !!user &&
    (user.isTenantOwner ||
      user.permissions.some(
        (permission) =>
          permission === "applications.activation.read" ||
          permission === "applications.activation.manage",
      ));

  const [node, setNode] = useState<OrgNodeOf<L> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [isMissing, setIsMissing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

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
      fetchOrgNode(level, id, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setNode(result as OrgNodeOf<L>);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const normalized = normalizeApiError(error);
          setNode(null);
          if (normalized.status === 404) setIsMissing(true);
          else setLoadError(normalized);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    });
    return () => controller.abort();
  }, [id, level, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  useRealtimeResync(reload);

  const lookupTargets = useMemo(() => {
    if (!node) return {};
    return {
      companyIds: "companyId" in node ? [node.companyId] : undefined,
      branchIds: "branchId" in node ? [node.branchId] : undefined,
      departmentIds: "departmentId" in node ? [node.departmentId] : undefined,
      userIds: "leadUserId" in node ? [node.leadUserId] : undefined,
    };
  }, [node]);

  const lookups = useOrgLookupResolver(lookupTargets);

  const departmentLookup =
    node && "departmentId" in node ? lookups.department(node.departmentId) : null;
  const effectiveBranchId =
    node && "branchId" in node
      ? node.branchId
      : departmentLookup?.status === "ready"
        ? departmentLookup.value.branchId
        : null;
  const branchLookup = effectiveBranchId ? lookups.branch(effectiveBranchId) : null;
  const effectiveCompanyId =
    node && "companyId" in node
      ? node.companyId
      : branchLookup?.status === "ready"
        ? branchLookup.value.companyId
        : null;
  const companyLookup = effectiveCompanyId ? lookups.company(effectiveCompanyId) : null;
  const leadLookup =
    node && "leadUserId" in node && node.leadUserId ? lookups.user(node.leadUserId) : null;

  return {
    t,
    lang,
    config: ORG_LEVEL_CONFIG[level],
    node,
    isLoading,
    loadError,
    isMissing,
    reload,
    canReadApplicationAccess,
    effectiveCompanyId,
    effectiveBranchId,
    companyLookup,
    branchLookup,
    departmentLookup,
    leadLookup,
  };
}
