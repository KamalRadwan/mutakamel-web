"use client";

import { useMemo } from "react";
import type { FilterDef, FilterValues } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { can } from "@/lib/auth/permission-scope";
import {
  USER_STATUSES,
  type TenantUser,
  type TenantUserFilters,
  type UserStatus,
} from "../../contracts/user-contract";
import { useOrgNodeOptions } from "../../hooks/useCoreOptions";

export interface ResolvedUserPlacement {
  companyLabel: string;
  branchLabel: string;
  departmentLabel: string;
  teamLabel: string | null;
}

interface UsersWorkplaceLookups {
  filterDefinitions: FilterDef[];
  filterValues: FilterValues;
  parseFilterValues: (next: FilterValues) => TenantUserFilters;
  resolvePlacement: (user: TenantUser) => ResolvedUserPlacement;
}

function readSelectValue(values: FilterValues, key: string): string | undefined {
  const entry = values[key];
  if (entry?.kind !== "select" || !entry.value) return undefined;
  return entry.value;
}

/**
 * Supplies workplace filter definitions (`companyId`, `branchId`,
 * `departmentId`, `teamId`) and row placement names on `/core/users` without
 * calling unauthorized endpoints or rendering raw foreign-key UUIDs.
 */
export function useUsersWorkplaceLookups(
  filters: TenantUserFilters,
): UsersWorkplaceLookups {
  const { t } = useI18n();
  const { user: actor } = useTenantAuth();
  const canReadCompanies = can(actor, "org.company.read");
  const canReadBranches = can(actor, "org.branch.read");
  const canReadDepartments = can(actor, "org.department.read");
  const canReadTeams = can(actor, "org.team.read");

  const companies = useOrgNodeOptions("companies", { enabled: canReadCompanies, includeInactive: true });
  const branches = useOrgNodeOptions("branches", {
    parentId: filters.companyId,
    includeInactive: true,
    enabled: canReadBranches,
  });
  const departments = useOrgNodeOptions("departments", {
    parentId: filters.branchId,
    companyId: filters.companyId,
    includeInactive: true,
    enabled: canReadDepartments,
  });
  const teams = useOrgNodeOptions("teams", {
    parentId: filters.departmentId,
    companyId: filters.companyId,
    branchId: filters.branchId,
    includeInactive: true,
    enabled: canReadTeams,
  });

  const filterDefinitions = useMemo<FilterDef[]>(() => {
    const defs: FilterDef[] = [
      {
        id: "status",
        kind: "select",
        label: t.coreIdentity.fields.status,
        options: USER_STATUSES.map((status) => ({
          value: status,
          label: t.coreIdentity.userStatus[status],
        })),
        placeholder: t.coreIdentity.filters.anyStatus,
        allLabel: t.coreIdentity.filters.anyStatus,
      },
    ];
    if (canReadCompanies) {
      defs.push({
        id: "companyId",
        kind: "select", nameOnly: true,
        label: t.coreIdentity.levels.companies.singular,
        options: companies.options,
        allLabel: t.coreIdentity.filters.allCompanies,
      });
    }
    if (canReadBranches) {
      defs.push({
        id: "branchId",
        kind: "select", nameOnly: true,
        label: t.coreIdentity.levels.branches.singular,
        options: branches.options,
        allLabel: t.coreIdentity.filters.allBranches,
      });
    }
    if (canReadDepartments) {
      defs.push({
        id: "departmentId",
        kind: "select",
        label: t.coreIdentity.levels.departments.singular,
        options: departments.options,
        allLabel: t.coreIdentity.filters.allDepartments,
      });
    }
    if (canReadTeams) {
      defs.push({
        id: "teamId",
        kind: "select",
        label: t.coreIdentity.levels.teams.singular,
        options: teams.options,
        allLabel: t.coreIdentity.filters.allTeams,
      });
    }
    return defs;
  }, [
    branches.options,
    canReadBranches,
    canReadCompanies,
    canReadDepartments,
    canReadTeams,
    companies.options,
    departments.options,
    t,
    teams.options,
  ]);

  const filterValues = useMemo<FilterValues>(() => {
    const out: FilterValues = {};
    if (filters.status) out.status = { kind: "select", value: filters.status };
    if (filters.companyId) out.companyId = { kind: "select", value: filters.companyId };
    if (filters.branchId) out.branchId = { kind: "select", value: filters.branchId };
    if (filters.departmentId) {
      out.departmentId = { kind: "select", value: filters.departmentId };
    }
    if (filters.teamId) out.teamId = { kind: "select", value: filters.teamId };
    return out;
  }, [filters]);

  const parseFilterValues = useMemo(
    () =>
      (next: FilterValues): TenantUserFilters => {
        const rawStatus = readSelectValue(next, "status");
        const status = USER_STATUSES.find((item) => item === rawStatus) as
          | UserStatus
          | undefined;
        const companyId = readSelectValue(next, "companyId");
        const companyChanged = companyId !== filters.companyId;
        const branchId = companyChanged ? undefined : readSelectValue(next, "branchId");
        const branchChanged = branchId !== filters.branchId;
        const departmentId =
          companyChanged || branchChanged
            ? undefined
            : readSelectValue(next, "departmentId");
        const departmentChanged = departmentId !== filters.departmentId;
        const teamId =
          companyChanged || branchChanged || departmentChanged
            ? undefined
            : readSelectValue(next, "teamId");
        return { status, companyId, branchId, departmentId, teamId };
      },
    [filters.branchId, filters.companyId, filters.departmentId],
  );

  const fallback = t.coreIdentity.grants.nameUnavailable;
  const resolvePlacement = useMemo(
    () =>
      (user: TenantUser): ResolvedUserPlacement => ({
        companyLabel: companies.labelFor(user.companyId) ?? fallback,
        branchLabel: branches.labelFor(user.branchId) ?? fallback,
        departmentLabel: departments.labelFor(user.departmentId) ?? fallback,
        teamLabel: user.teamId ? (teams.labelFor(user.teamId) ?? fallback) : null,
      }),
    [branches, companies, departments, fallback, teams],
  );

  return {
    filterDefinitions,
    filterValues,
    parseFilterValues,
    resolvePlacement,
  };
}
