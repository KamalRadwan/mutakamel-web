"use client";

import { useCallback, useMemo, useState } from "react";
import { isUUIDv7 } from "@/lib/uuid";

export interface TenantBranchSource {
  accessibleBranches: readonly string[];
  teamMemberships: ReadonlyArray<{
    branchId: string | null;
    isPrimary: boolean;
  }>;
}

export function resolveDefaultTenantBranchId(
  source: TenantBranchSource | null | undefined,
): string | null {
  if (!source) return null;
  const accessible = new Set(source.accessibleBranches.filter(isUUIDv7));
  const primary = new Set(
    source.teamMemberships
      .filter(
        ({ branchId, isPrimary }) =>
          isPrimary && branchId !== null && accessible.has(branchId),
      )
      .map(({ branchId }) => branchId as string),
  );
  if (primary.size === 1) return [...primary][0];
  return primary.size === 0 && accessible.size === 1
    ? [...accessible][0]
    : null;
}

export function useTenantBranchSelection(
  source: TenantBranchSource | null | undefined,
) {
  const branchIds = useMemo(
    () => [...new Set(source?.accessibleBranches.filter(isUUIDv7) ?? [])],
    [source],
  );
  const defaultBranchId = useMemo(
    () => resolveDefaultTenantBranchId(source),
    [source],
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const branchId =
    selectedBranchId && branchIds.includes(selectedBranchId)
      ? selectedBranchId
      : defaultBranchId;

  const selectBranch = useCallback(
    (nextBranchId: string) => {
      setSelectedBranchId(
        branchIds.includes(nextBranchId) ? nextBranchId : null,
      );
    },
    [branchIds],
  );

  return { branchIds, branchId, selectBranch };
}
