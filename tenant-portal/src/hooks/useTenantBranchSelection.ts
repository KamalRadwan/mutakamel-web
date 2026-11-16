"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  readTenantBranchSelection,
  subscribeTenantBranchSelection,
  writeTenantBranchSelection,
} from "@/lib/tenant-branch-selection";
import { isUUIDv7 } from "@/lib/uuid";

export interface TenantBranchSource {
  id?: string;
  accessibleBranches: readonly string[];
  teamMemberships: ReadonlyArray<{
    branchId: string | null;
    isPrimary: boolean;
  }>;
}

const serverSelection = () => null;

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
  /**
   * A required branch falls back to the actor's primary one. An optional one
   * starts at `null` — every branch the actor can see — and `selectBranch(null)`
   * returns to it, for reads the server only narrows when asked.
   */
  { optional = false }: { optional?: boolean } = {},
) {
  const branchIds = useMemo(
    () => [...new Set(source?.accessibleBranches.filter(isUUIDv7) ?? [])],
    [source],
  );
  const defaultBranchId = useMemo(
    () => (optional ? null : resolveDefaultTenantBranchId(source)),
    [optional, source],
  );
  const actorId = source?.id ?? null;
  const subscribe = useCallback(
    (listener: () => void) => actorId === null ? () => {} : subscribeTenantBranchSelection(actorId, listener),
    [actorId],
  );
  const getSnapshot = useCallback(
    () => actorId === null ? null : readTenantBranchSelection(actorId),
    [actorId],
  );
  const savedBranchId = useSyncExternalStore(subscribe, getSnapshot, serverSelection);
  const [localBranchId, setLocalBranchId] = useState<string | null>(null);
  const selectedBranchId = actorId === null ? localBranchId : savedBranchId;
  const branchId =
    selectedBranchId && branchIds.includes(selectedBranchId)
      ? selectedBranchId
      : defaultBranchId;

  const selectBranch = useCallback(
    (nextBranchId: string | null) => {
      const next =
        nextBranchId !== null && branchIds.includes(nextBranchId)
          ? nextBranchId
          : null;
      if (actorId === null) setLocalBranchId(next);
      else writeTenantBranchSelection(actorId, next);
    },
    [actorId, branchIds],
  );

  return { branchIds, branchId, selectBranch };
}
