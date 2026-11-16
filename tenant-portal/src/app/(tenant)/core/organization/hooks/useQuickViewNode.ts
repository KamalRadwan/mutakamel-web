"use client";

import { useEffect, useMemo, useState } from "react";
import { useCan } from "@/design-system";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  fetchOrgNode,
  type OrgLevel,
  type OrgNodeOf,
  type OrgNodeStatus,
} from "../../contracts/organization-contract";
import { ORG_LEVEL_CONFIG } from "../level-config";
import { useOrgLookupResolver } from "./useOrgLookupResolver";

export type QuickViewTarget =
  | {
      kind: "node";
      level: OrgLevel;
      node: OrgNodeOf<OrgLevel>;
    }
  | {
      kind: "summary";
      level: OrgLevel;
      summary: {
        id: string;
        code: string;
        name: string;
        status: OrgNodeStatus;
      };
    };

interface QuickViewSnapshot {
  key: string;
  node: OrgNodeOf<OrgLevel> | null;
  error: NormalizedApiError | null;
}

function getTargetKey(target: QuickViewTarget | null): string | null {
  if (!target) return null;
  const id = target.kind === "node" ? target.node.id : target.summary.id;
  return `${target.level}:${id}`;
}

/**
 * Resolves quick-view state without stale cross-target flashes.
 *
 * `snapshot` is keyed by `${level}:${id}` and synchronously masked during render
 * whenever `target` changes, so switching from summary A to summary B never
 * exposes A's record or error while B's request is queued or in flight.
 */
export function useQuickViewNode(target: QuickViewTarget | null) {
  const level = target?.level ?? "companies";
  const config = ORG_LEVEL_CONFIG[level];
  const canReadLevel = useCan(config.readPermission);

  const [snapshot, setSnapshot] = useState<QuickViewSnapshot | null>(null);

  const summaryLevel = target?.kind === "summary" ? target.level : null;
  const summaryId = target?.kind === "summary" ? target.summary.id : null;
  const targetKey = getTargetKey(target);

  useEffect(() => {
    if (!summaryLevel || !summaryId || !canReadLevel) return;
    const requestKey = `${summaryLevel}:${summaryId}`;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      fetchOrgNode(summaryLevel, summaryId, controller.signal)
        .then((record) => {
          if (!controller.signal.aborted) {
            setSnapshot({ key: requestKey, node: record, error: null });
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setSnapshot({
              key: requestKey,
              node: null,
              error: normalizeApiError(error),
            });
          }
        });
    });
    return () => controller.abort();
  }, [canReadLevel, summaryId, summaryLevel]);

  const matchingSnapshot =
    target?.kind === "summary" && targetKey !== null && snapshot?.key === targetKey
      ? snapshot
      : null;

  const activeNode: OrgNodeOf<OrgLevel> | null =
    target?.kind === "node"
      ? (canReadLevel ? target.node : null)
      : canReadLevel
        ? (matchingSnapshot?.node ?? null)
        : null;

  const loadError: NormalizedApiError | null =
    target?.kind === "summary" && canReadLevel ? (matchingSnapshot?.error ?? null) : null;

  const isLoading =
    target?.kind === "summary" && canReadLevel && matchingSnapshot === null;

  const isDetailForbidden = !canReadLevel || loadError?.status === 403;

  const lookupTargets = useMemo(() => {
    if (!activeNode) return {};
    return {
      companyIds: "companyId" in activeNode ? [activeNode.companyId] : undefined,
      branchIds: "branchId" in activeNode ? [activeNode.branchId] : undefined,
      departmentIds: "departmentId" in activeNode ? [activeNode.departmentId] : undefined,
      userIds: "leadUserId" in activeNode ? [activeNode.leadUserId] : undefined,
    };
  }, [activeNode]);

  const lookups = useOrgLookupResolver(lookupTargets);

  const departmentLookup =
    activeNode && "departmentId" in activeNode
      ? lookups.department(activeNode.departmentId)
      : null;
  const effectiveBranchId =
    activeNode && "branchId" in activeNode
      ? activeNode.branchId
      : departmentLookup?.status === "ready"
        ? departmentLookup.value.branchId
        : null;
  const branchLookup = effectiveBranchId ? lookups.branch(effectiveBranchId) : null;
  const effectiveCompanyId =
    activeNode && "companyId" in activeNode
      ? activeNode.companyId
      : branchLookup?.status === "ready"
        ? branchLookup.value.companyId
        : null;
  const companyLookup = effectiveCompanyId ? lookups.company(effectiveCompanyId) : null;
  const leadLookup =
    activeNode && "leadUserId" in activeNode && activeNode.leadUserId
      ? lookups.user(activeNode.leadUserId)
      : null;

  return {
    config,
    canReadLevel,
    isDetailForbidden,
    node: activeNode,
    isLoading,
    loadError: loadError?.status === 403 ? null : loadError,
    effectiveCompanyId,
    effectiveBranchId,
    companyLookup,
    branchLookup,
    departmentLookup,
    leadLookup,
  };
}
