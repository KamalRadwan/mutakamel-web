import { isUUIDv7 } from "@/lib/uuid";
import { boundedArray, nonEmptyString, record } from "./dashboard-parse";

export const DASHBOARD_ORGANIZATION_SELECTION_LIMIT = 500;
export interface DashboardOrganizationSelection {
  companyId?: string | null;
  branchId?: string | null;
  companyIds?: string[];
  branchIds?: string[];
}

export function canonicalOrganizationIds(values: string[] | undefined, onInvalid: () => never) {
  if (values === undefined) return undefined;
  if (!boundedArray(values, DASHBOARD_ORGANIZATION_SELECTION_LIMIT) || !values.length || !values.every(isUUIDv7)) return onInvalid();
  const canonical = values.map(id => id.toLowerCase()).sort();
  return new Set(canonical).size === canonical.length ? canonical : onInvalid();
}

export function matchesOrganizationIds(value: unknown, expected: string[] | undefined): boolean {
  return expected === undefined ? value === undefined
    : Array.isArray(value) && value.length === expected.length && expected.every((id, index) => value[index] === id);
}

export function parseReportOrganizationScope(value: unknown, filters: Pick<DashboardOrganizationSelection, "companyId" | "branchId">, onInvalid: () => never) {
  return parseDashboardOrganizationScope(value, { companyId: filters.companyId, branchId: filters.branchId }, onInvalid);
}

export function parseDashboardOrganizationScope(value: unknown, filters: DashboardOrganizationSelection, onInvalid: () => never) {
  const companyId = filters.companyId?.toLowerCase() ?? null;
  const branchId = filters.branchId?.toLowerCase() ?? null;
  const companyIds = canonicalOrganizationIds(filters.companyIds, onInvalid);
  const branchIds = canonicalOrganizationIds(filters.branchIds, onInvalid);
  if ((companyId && companyIds) || (branchId && branchIds)) return onInvalid();
  const scope = record(value);
  if (!scope || scope.companyId !== companyId || scope.branchId !== branchId || typeof scope.partialAccess !== "boolean"
    || !matchesOrganizationIds(scope.companyIds, companyIds) || !matchesOrganizationIds(scope.branchIds, branchIds)
    || !boundedArray(scope.companies, DASHBOARD_ORGANIZATION_SELECTION_LIMIT)
    || !boundedArray(scope.branches, DASHBOARD_ORGANIZATION_SELECTION_LIMIT)) return onInvalid();
  const companies = scope.companies.map((value) => {
    const item = record(value);
    if (!item || !isUUIDv7(item.id) || !nonEmptyString(item.name)) return onInvalid();
    return { id: item.id, name: item.name };
  });
  const companyById = new Map(companies.map((item) => [item.id, item.name]));
  const branches = scope.branches.map((value) => {
    const item = record(value);
    if (!item || !isUUIDv7(item.id) || !isUUIDv7(item.companyId) || !nonEmptyString(item.name)
      || !nonEmptyString(item.companyName) || companyById.get(item.companyId) !== item.companyName) return onInvalid();
    return { id: item.id, name: item.name, companyId: item.companyId, companyName: item.companyName };
  });
  const branchById = new Map(branches.map((item) => [item.id, item]));
  const companiesFilter = new Set(companyIds ?? (companyId ? [companyId] : []));
  const branchesFilter = new Set(branchIds ?? (branchId ? [branchId] : []));
  const selectedBranches = branches.filter(item => (!companiesFilter.size || companiesFilter.has(item.companyId))
    && (!branchesFilter.size || branchesFilter.has(item.id)));
  if (companyById.size !== companies.length || branchById.size !== branches.length
    || [...companiesFilter].some(id => !companyById.has(id))
    || (branchesFilter.size && selectedBranches.length !== branchesFilter.size)) return onInvalid();

  return { branchById, companyId, branchId, companyIds, branchIds, companies, branches, selectedBranches, partialAccess: scope.partialAccess };
}
