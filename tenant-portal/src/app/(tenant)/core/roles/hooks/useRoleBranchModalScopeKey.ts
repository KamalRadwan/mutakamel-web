"use client";

import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";

/** Private drafts and pending operations belong to this exact actor and modal. */
export function useRoleBranchModalScopeKey(roleId: string | null, open: boolean) {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const scope = useAuthScopeKey(user ?? null);
  return JSON.stringify([scope, user?.isTenantOwner, realtimeAuthGeneration, roleId, open]);
}
