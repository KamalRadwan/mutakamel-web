"use client";

import { useMemo } from "react";
import type { TenantUserProfile } from "@/context/AuthContext";
import { useStablePermissions } from "./useStablePermissions";

// Length prefixes keep nullable membership fields and arbitrary role text distinct.
function field(value: string | boolean | null) {
  return value === null ? "null:" : `${String(value).length}:${value}`;
}

/** Value-based identity; absent scope arrays are empty and refresh order is irrelevant. */
export function useAuthScopeKey(user: TenantUserProfile | null) {
  const permissions = useStablePermissions(user);
  const actorId = user?.id;
  const branches = [...(user?.accessibleBranches ?? [])].sort().join("\n");
  const companies = [...(user?.accessibleCompanies ?? [])].sort().join("\n");
  const memberships = (user?.teamMemberships ?? []).map((membership) => [
    membership.id, membership.teamId, membership.companyId, membership.branchId,
    membership.departmentId, membership.role, membership.isPrimary,
  ].map(field).join("")).sort().join("\n");

  return useMemo(
    () => JSON.stringify([actorId, permissions, branches, companies, memberships]),
    [actorId, permissions, branches, companies, memberships],
  );
}
