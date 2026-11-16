"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  fetchBranchRoleAssignments,
  fetchScopeRoleAssignments,
  type BranchRoleAssignment,
  type ScopeRoleAssignment,
} from "../../../contracts/role-assignment-contract";

interface RequestStamp<T> {
  userId: string;
  token: number;
  value: T;
}

/**
 * Independently loads `tenant_user_branch_roles` and owner-only
 * `tenant_user_scope_roles` for a single target `userId`, stamping completed
 * baselines and errors with `{ userId, token }` so neither unloaded reads nor a
 * previous target user's grants can ever satisfy write readiness.
 */
export function useUserRoleGrantsData(
  userId: string,
  enabled: boolean,
  isTenantOwnerActor: boolean,
) {
  const [branchSnap, setBranchSnap] =
    useState<RequestStamp<BranchRoleAssignment[]> | null>(null);
  const [branchErrSnap, setBranchErrSnap] =
    useState<RequestStamp<NormalizedApiError> | null>(null);
  const [isBranchInFlight, setIsBranchInFlight] = useState(enabled);

  const [scopeSnap, setScopeSnap] =
    useState<RequestStamp<ScopeRoleAssignment[]> | null>(null);
  const [scopeErrSnap, setScopeErrSnap] =
    useState<RequestStamp<NormalizedApiError> | null>(null);
  const [isScopeInFlight, setIsScopeInFlight] = useState(enabled && isTenantOwnerActor);

  const [reloadToken, setReloadToken] = useState(0);

  const validTarget = enabled && isUUIDv7(userId);
  const hasBranchBaseline =
    branchSnap?.userId === userId && branchSnap.token === reloadToken;
  const branchError =
    branchErrSnap?.userId === userId && branchErrSnap.token === reloadToken
      ? branchErrSnap.value
      : null;
  const isBranchLoading =
    validTarget && (isBranchInFlight || (!hasBranchBaseline && !branchError));

  const validScopeTarget = validTarget && isTenantOwnerActor;
  const hasScopeBaseline =
    scopeSnap?.userId === userId && scopeSnap.token === reloadToken;
  const scopeError =
    scopeErrSnap?.userId === userId && scopeErrSnap.token === reloadToken
      ? scopeErrSnap.value
      : null;
  const isScopeLoading =
    validScopeTarget && (isScopeInFlight || (!hasScopeBaseline && !scopeError));

  const branchReady =
    validTarget && hasBranchBaseline && !isBranchLoading && !branchError;
  const scopeReady =
    validScopeTarget && hasScopeBaseline && !isScopeLoading && !scopeError;

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!enabled || !isUUIDv7(userId)) {
        setIsBranchInFlight(false);
        setIsScopeInFlight(false);
        return;
      }
      setIsBranchInFlight(true);
      setIsScopeInFlight(isTenantOwnerActor);

      fetchBranchRoleAssignments(userId, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setBranchErrSnap(null);
          setBranchSnap({ userId, token: reloadToken, value: result });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setBranchErrSnap({
            userId,
            token: reloadToken,
            value: normalizeApiError(error),
          });
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsBranchInFlight(false);
        });

      if (!isTenantOwnerActor) return;

      fetchScopeRoleAssignments(userId, controller.signal, {
        suppressForbiddenToast: true,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setScopeErrSnap(null);
          setScopeSnap({ userId, token: reloadToken, value: result });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setScopeErrSnap({
            userId,
            token: reloadToken,
            value: normalizeApiError(error),
          });
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsScopeInFlight(false);
        });
    });
    return () => controller.abort();
  }, [enabled, isTenantOwnerActor, reloadToken, userId]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    branchRoles: validTarget && hasBranchBaseline ? branchSnap.value : [],
    branchError: validTarget ? branchError : null,
    isBranchLoading,
    branchReady,
    scopeRoles: validScopeTarget && hasScopeBaseline ? scopeSnap.value : [],
    scopeError: validScopeTarget ? scopeError : null,
    isScopeLoading,
    scopeReady,
    reload,
  };
}
