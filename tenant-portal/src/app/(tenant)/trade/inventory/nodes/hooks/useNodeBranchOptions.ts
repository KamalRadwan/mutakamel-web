"use client";

import { useTenantAuth } from "@/context/AuthContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { useTenantOrganizationOptions } from "@/hooks/useTenantOrganizationOptions";
import { parseBranchIdsPreview } from "../../inventory-contract";

export function useNodeBranchOptions(value: string) {
  const { user } = useTenantAuth();
  const { branchIds } = useTenantBranchSelection(user);
  const preview = parseBranchIdsPreview(value);
  const options = useTenantOrganizationOptions("branch", [...new Set([...branchIds, ...preview.validIds])]);
  return { preview, options };
}
