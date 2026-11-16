"use client";

import { useEffect, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { can } from "@/lib/auth/permission-scope";
import { CORE_MAX_PAGE_LIMIT } from "../../../contracts/core-page";
import {
  fetchOrgNodes,
  type OrgLevel,
} from "../../../contracts/organization-contract";
import {
  fetchTenantUser,
  userDisplayName,
  type TenantUser,
} from "../../../contracts/user-contract";
import { useOrgNodeOptions } from "../../../hooks/useCoreOptions";

interface UserPlacementNames {
  companyLabel: string;
  branchLabel: string;
  departmentLabel: string;
  teamLabel: string | null;
  managerLabel: string | null;
  managerResolved: boolean;
}

async function resolveInactiveOrPagedOrgName(
  level: OrgLevel,
  targetId: string,
  parentId: string | undefined,
  signal: AbortSignal,
): Promise<string | undefined> {
  try {
    const page = await fetchOrgNodes(level, {
      page: 1,
      search: "",
      parentId,
      limit: CORE_MAX_PAGE_LIMIT,
      signal,
      suppressForbiddenToast: true,
    });
    return page?.items?.find((node) => node.id === targetId)?.name;
  } catch {
    return undefined;
  }
}

/**
 * Resolves human-readable names for `companyId`, `branchId`, `departmentId`,
 * `teamId`, and `managerId` on `/core/users/[id]` using only permitted reads.
 * Any forbidden or missing lookup degrades to `copy.grants.nameUnavailable`
 * rather than failing the screen or rendering raw foreign-key UUIDs.
 */
export function useUserPlacementNames(
  user: TenantUser | null,
): UserPlacementNames {
  const { t } = useI18n();
  const { user: actor } = useTenantAuth();

  const canReadCompanies = can(actor, "org.company.read");
  const canReadBranches = can(actor, "org.branch.read");
  const canReadDepartments = can(actor, "org.department.read");
  const canReadTeams = can(actor, "org.team.read");
  const canReadUsers = can(actor, "users.user.read");

  const companies = useOrgNodeOptions("companies", {
    enabled: Boolean(user) && canReadCompanies,
  });
  const branches = useOrgNodeOptions("branches", {
    parentId: user?.companyId,
    enabled: Boolean(user) && canReadBranches,
  });
  const departments = useOrgNodeOptions("departments", {
    parentId: user?.branchId,
    enabled: Boolean(user) && canReadDepartments,
  });
  const teams = useOrgNodeOptions("teams", {
    parentId: user?.departmentId,
    enabled: Boolean(user?.teamId) && canReadTeams,
  });

  const [fallbackNames, setFallbackNames] = useState<Record<string, string>>({});
  const [managerState, setManagerState] = useState<{
    id: string;
    name: string | null;
  } | null>(null);

  const companyDirect = user ? companies.labelFor(user.companyId) : undefined;
  const branchDirect = user ? branches.labelFor(user.branchId) : undefined;
  const departmentDirect = user ? departments.labelFor(user.departmentId) : undefined;
  const teamDirect = user?.teamId ? teams.labelFor(user.teamId) : undefined;

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      const tasks: Array<Promise<[string, string | undefined]>> = [];
      if (canReadCompanies && !companyDirect) {
        tasks.push(
          resolveInactiveOrPagedOrgName(
            "companies",
            user.companyId,
            undefined,
            controller.signal,
          ).then((name) => [user.companyId, name]),
        );
      }
      if (canReadBranches && !branchDirect) {
        tasks.push(
          resolveInactiveOrPagedOrgName(
            "branches",
            user.branchId,
            user.companyId,
            controller.signal,
          ).then((name) => [user.branchId, name]),
        );
      }
      if (canReadDepartments && !departmentDirect) {
        tasks.push(
          resolveInactiveOrPagedOrgName(
            "departments",
            user.departmentId,
            user.branchId,
            controller.signal,
          ).then((name) => [user.departmentId, name]),
        );
      }
      if (canReadTeams && user.teamId && !teamDirect) {
        const teamId = user.teamId;
        tasks.push(
          resolveInactiveOrPagedOrgName(
            "teams",
            teamId,
            user.departmentId,
            controller.signal,
          ).then((name) => [teamId, name]),
        );
      }
      if (tasks.length === 0) return;
      void Promise.all(tasks).then((entries) => {
        if (controller.signal.aborted) return;
        const resolved: Record<string, string> = {};
        for (const [id, name] of entries) {
          if (name) resolved[id] = name;
        }
        if (Object.keys(resolved).length > 0) {
          setFallbackNames((current) => ({ ...current, ...resolved }));
        }
      });
    });
    return () => controller.abort();
  }, [
    branchDirect,
    canReadBranches,
    canReadCompanies,
    canReadDepartments,
    canReadTeams,
    companyDirect,
    departmentDirect,
    teamDirect,
    user,
  ]);

  const managerId = user?.managerId ?? null;
  useEffect(() => {
    if (!managerId || !canReadUsers) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      fetchTenantUser(managerId, controller.signal)
        .then((manager) => {
          if (controller.signal.aborted) return;
          setManagerState({
            id: managerId,
            name: manager ? userDisplayName(manager) : null,
          });
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setManagerState({ id: managerId, name: null });
          }
        });
    });
    return () => controller.abort();
  }, [canReadUsers, managerId]);

  const unavailable = t.coreIdentity.grants.nameUnavailable;
  if (!user) {
    return {
      companyLabel: unavailable,
      branchLabel: unavailable,
      departmentLabel: unavailable,
      teamLabel: null,
      managerLabel: null,
      managerResolved: false,
    };
  }

  const resolvedManagerName =
    managerId && managerState?.id === managerId ? managerState.name : null;

  return {
    companyLabel: companyDirect ?? fallbackNames[user.companyId] ?? unavailable,
    branchLabel: branchDirect ?? fallbackNames[user.branchId] ?? unavailable,
    departmentLabel:
      departmentDirect ?? fallbackNames[user.departmentId] ?? unavailable,
    teamLabel: user.teamId
      ? (teamDirect ?? fallbackNames[user.teamId] ?? unavailable)
      : null,
    managerLabel: managerId ? (resolvedManagerName ?? unavailable) : null,
    managerResolved: Boolean(resolvedManagerName),
  };
}
