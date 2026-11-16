"use client";

import { useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useTenantOrganizationOptions } from "@/hooks/useTenantOrganizationOptions";
import { can, type PermissionTarget } from "@/lib/auth/permission-scope";
import { TEMPLATE_READ_PERMISSION, type TemplateScopeType } from "../../templates-contract";
import { TENANT_ASSIGNMENT_SCOPE, type AssignmentScope } from "../../template-assignments-contract";

export function assignmentPermissionTarget(scope: AssignmentScope): PermissionTarget {
  if (scope.type === "TENANT") return { tenantWide: true };
  if (scope.type === "COMPANY") return { companyId: scope.companyId };
  return { companyId: scope.companyId, branchId: scope.branchId };
}

export function useAssignmentScope() {
  const { user } = useTenantAuth();
  const [selectedType, setSelectedType] = useState<TemplateScopeType>();
  const [companyId, setCompany] = useState("");
  const [branchId, setBranch] = useState("");
  const grant = user?.permissionScopes?.[TEMPLATE_READ_PERMISSION];
  const canReadTenant = can(user, TEMPLATE_READ_PERMISSION, { tenantWide: true });
  const companies = canReadTenant ? (user?.accessibleCompanies ?? []) : (grant?.companyIds ?? []);
  const branches = (user?.accessibleBranchCompanies ?? []).filter(({ companyId, branchId }) =>
    can(user, TEMPLATE_READ_PERMISSION, { companyId, branchId }));
  const types: TemplateScopeType[] = [];
  if (canReadTenant) types.push("TENANT");
  if (companies.length) types.push("COMPANY");
  if (branches.length) types.push("BRANCH");
  const type = selectedType && types.includes(selectedType) ? selectedType : types[0];
  const companyIds = type === "BRANCH" ? [...new Set(branches.map(row => row.companyId))] : companies;
  const selectedCompany = companyIds.includes(companyId) ? companyId : (companyIds.length === 1 ? companyIds[0] : "");
  const branchIds = branches.filter(row => row.companyId === selectedCompany).map(row => row.branchId);
  const selectedBranch = branchIds.includes(branchId) ? branchId : (branchIds.length === 1 ? branchIds[0] : "");
  const companyOptions = useTenantOrganizationOptions("company", type === "TENANT" ? [] : companyIds);
  const branchOptions = useTenantOrganizationOptions("branch", type === "BRANCH" ? branchIds : []);

  const scope = useMemo((): AssignmentScope | null => {
    if (type === "TENANT") return TENANT_ASSIGNMENT_SCOPE;
    if (type === "COMPANY" && selectedCompany) return { type, companyId: selectedCompany };
    if (type === "BRANCH" && selectedCompany && selectedBranch) {
      return { type, companyId: selectedCompany, branchId: selectedBranch };
    }
    return null;
  }, [type, selectedCompany, selectedBranch]);

  return {
    scope, type, types, companyOptions, branchOptions, selectedCompany, selectedBranch,
    selectType: (next: TemplateScopeType) => {
      setSelectedType(next);
      setCompany("");
      setBranch("");
    },
    selectCompany: (next: string) => {
      setCompany(next);
      setBranch("");
    },
    selectBranch: setBranch,
  };
}
