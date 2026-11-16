"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useAuthScopeKey } from "@/hooks/useAuthScopeKey";
import {
  BRANDING_MANAGE_PERMISSION,
  BRANDING_READ_PERMISSION,
  type BrandingAssetKind,
} from "../branding-contract";

export interface BrandingActiveOperation {
  token: symbol;
  kind: "save" | BrandingAssetKind;
  intentFence: string;
}

function formatPermissionScope(
  scope:
    | {
        tenantWide: boolean;
        companyIds?: readonly string[];
        branchIds?: readonly string[];
      }
    | undefined,
): string {
  if (!scope) return "none";
  const companies = [...(scope.companyIds ?? [])].sort().join(",");
  const branches = [...(scope.branchIds ?? [])].sort().join(",");
  return `${String(scope.tenantWide)}:${companies}:${branches}`;
}

export interface BrandingIntentFence {
  intentFence: string;
  latestIntentFenceRef: MutableRefObject<string>;
  mountedRef: MutableRefObject<boolean>;
  activeOperationRef: MutableRefObject<BrandingActiveOperation | null>;
  hasActiveCurrentOperation: () => boolean;
}

/**
 * Pins Branding reads, saves, and pre-HTTP native image inspections to the
 * mounted hook instance and current actor/scope/generation epoch.
 */
export function useBrandingIntentFence(canManage: boolean): BrandingIntentFence {
  const { user, realtimeAuthGeneration } = useTenantAuth();
  const authScopeKey = useAuthScopeKey(user ?? null);
  const readScopeKey = formatPermissionScope(user?.permissionScopes?.[BRANDING_READ_PERMISSION]);
  const manageScopeKey = formatPermissionScope(
    user?.permissionScopes?.[BRANDING_MANAGE_PERMISSION],
  );
  const authFenceKey = `${realtimeAuthGeneration ?? "no-gen"}:${authScopeKey}:${readScopeKey}:${manageScopeKey}:${String(canManage)}`;

  const [authTransition, setAuthTransition] = useState({ key: authFenceKey, epoch: 0 });
  let currentEpoch = authTransition.epoch;
  if (authTransition.key !== authFenceKey) {
    currentEpoch = authTransition.epoch + 1;
    setAuthTransition({ key: authFenceKey, epoch: currentEpoch });
  }
  const intentFence = `${String(currentEpoch)}:${authFenceKey}`;

  const mountedRef = useRef(true);
  const latestIntentFenceRef = useRef(intentFence);
  const activeOperationRef = useRef<BrandingActiveOperation | null>(null);

  useEffect(() => {
    latestIntentFenceRef.current = intentFence;
  }, [intentFence]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeOperationRef.current = null;
    };
  }, []);

  const hasActiveCurrentOperation = useCallback((): boolean => {
    const active = activeOperationRef.current;
    return active !== null && active.intentFence === latestIntentFenceRef.current;
  }, []);

  return {
    intentFence,
    latestIntentFenceRef,
    mountedRef,
    activeOperationRef,
    hasActiveCurrentOperation,
  };
}
