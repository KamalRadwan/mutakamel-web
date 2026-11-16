"use client";

import { useMemo } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useCan, type ReadOnlyGateLabels } from "@/design-system";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { AccessMode } from "@/lib/access-mode";
import { useAccessModeLabels } from "../../../hooks/useAccessModeLabels";

export function useProvisioningUpdatesAccess(t: Dictionary) {
  const { user } = useTenantAuth();
  const authScopeKey = useAuthScopeKey(user);
  const accessMode = useAccessMode();
  const baseAccessLabels = useAccessModeLabels();

  const canReadTenantWide = useCan("workspace.read", { tenantWide: true });
  const canManageTenantWide = useCan("workspace.manage", { tenantWide: true });
  const canReadEffective = canReadTenantWide && accessMode.canRead;
  const canManageEffective = canManageTenantWide && accessMode.canMutate;

  const effectiveAccessMode: AccessMode =
    accessMode.mode && accessMode.mode !== "FULL"
      ? accessMode.mode
      : canManageTenantWide
        ? "FULL"
        : "READ_ONLY";

  const readOnlyLabels: ReadOnlyGateLabels = useMemo(
    () =>
      accessMode.mode && accessMode.mode !== "FULL"
        ? baseAccessLabels
        : { ...baseAccessLabels, readOnlyNotice: t.coreSettings.updatesUi.readOnlyNotice },
    [accessMode.mode, baseAccessLabels, t.coreSettings.updatesUi.readOnlyNotice],
  );

  const actorIdentityKey = useMemo(
    () =>
      JSON.stringify([
        user?.id ?? null,
        Boolean(user?.isTenantOwner),
        [...(user?.accessibleCompanies ?? [])].sort(),
        [...(user?.accessibleBranches ?? [])].sort(),
      ]),
    [user?.accessibleBranches, user?.accessibleCompanies, user?.id, user?.isTenantOwner],
  );

  return {
    canReadTenantWide,
    canReadEffective,
    canManageEffective,
    effectiveAccessMode,
    readOnlyLabels,
    readFenceKey: `${actorIdentityKey}|read:${String(canReadEffective)}`,
    applyFenceKey: `${authScopeKey}|manage:${String(canManageEffective)}`,
  };
}
