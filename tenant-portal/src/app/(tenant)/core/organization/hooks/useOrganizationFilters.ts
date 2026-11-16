"use client";

import { useCallback, useMemo } from "react";
import { useCan, type FilterDef, type FilterValues } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { isUUIDv7 } from "@/lib/uuid";
import { ORG_NODE_STATUSES, type OrgHierarchyFilters, type OrgLevel, type OrgNodeStatus } from "../../contracts/organization-contract";
import { useOrgNodeOptions } from "../../hooks/useCoreOptions";
import { ORG_LEVEL_CONFIG } from "../level-config";

interface FilterState {
  hierarchyFilters: OrgHierarchyFilters;
  statusFilter?: OrgNodeStatus;
  setHierarchyFilters: (next: OrgHierarchyFilters) => void;
  setStatusFilter: (next: OrgNodeStatus | undefined) => void;
  setPage: (page: number) => void;
}

function readId(values: FilterValues, key: string) {
  const entry = values[key];
  return entry?.kind === "select" && isUUIDv7(entry.value) ? entry.value : undefined;
}

export function parseOrganizationHierarchyFilters(next: FilterValues, current: OrgHierarchyFilters): OrgHierarchyFilters {
  const companyId = readId(next, "companyId");
  const companyChanged = companyId !== current.companyId;
  const branchId = companyChanged ? undefined : readId(next, "branchId");
  const branchChanged = branchId !== current.branchId;
  const departmentId = companyChanged || branchChanged ? undefined : readId(next, "departmentId");
  return { companyId, branchId, departmentId };
}

export function useOrganizationFilters(level: OrgLevel, screen: FilterState) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const ancestors = ORG_LEVEL_CONFIG[level].ancestors;
  const canReadCompanies = useCan("org.company.read");
  const canReadBranches = useCan("org.branch.read");
  const canReadDepartments = useCan("org.department.read");
  const companies = useOrgNodeOptions("companies", { enabled: ancestors.includes("companies") && canReadCompanies, includeInactive: true });
  const branches = useOrgNodeOptions("branches", { enabled: ancestors.includes("branches") && canReadBranches, parentId: screen.hierarchyFilters.companyId, includeInactive: true });
  const departments = useOrgNodeOptions("departments", { enabled: ancestors.includes("departments") && canReadDepartments, parentId: screen.hierarchyFilters.branchId, companyId: screen.hierarchyFilters.companyId, includeInactive: true });

  const filterDefs = useMemo<FilterDef[]>(() => {
    const defs: FilterDef[] = [{ id: "status", kind: "select", label: copy.fields.status,
      allLabel: copy.filters.anyStatus,
      options: ORG_NODE_STATUSES.map(value => ({ value, label: copy.orgStatus[value] })) }];
    if (ancestors.includes("companies") && canReadCompanies) defs.push({ id: "companyId", kind: "select", nameOnly: true, label: copy.cascade.company, allLabel: copy.filters.allCompanies, options: companies.options });
    if (ancestors.includes("branches") && canReadBranches) defs.push({ id: "branchId", kind: "select", nameOnly: true, label: copy.cascade.branch, allLabel: copy.filters.allBranches, options: branches.options });
    if (ancestors.includes("departments") && canReadDepartments) defs.push({ id: "departmentId", kind: "select", label: copy.cascade.department, allLabel: copy.filters.allDepartments, options: departments.options });
    return defs;
  }, [ancestors, canReadCompanies, canReadBranches, canReadDepartments, copy, companies.options, branches.options, departments.options]);

  const filterValues = useMemo<FilterValues>(() => {
    const values: FilterValues = {};
    if (screen.statusFilter) values.status = { kind: "select", value: screen.statusFilter };
    for (const [key, value] of Object.entries(screen.hierarchyFilters)) if (value) values[key] = { kind: "select", value };
    return values;
  }, [screen.statusFilter, screen.hierarchyFilters]);

  const handleFilterChange = useCallback((next: FilterValues) => {
    const status = next.status;
    screen.setStatusFilter(status?.kind === "select" ? ORG_NODE_STATUSES.find(value => value === status.value) : undefined);
    screen.setHierarchyFilters(parseOrganizationHierarchyFilters(next, screen.hierarchyFilters));
    screen.setPage(1);
  }, [screen]);
  const handleFilterReset = useCallback(() => {
    screen.setStatusFilter(undefined);
    screen.setHierarchyFilters({});
    screen.setPage(1);
  }, [screen]);
  return { filterDefs, filterValues, handleFilterChange, handleFilterReset };
}
