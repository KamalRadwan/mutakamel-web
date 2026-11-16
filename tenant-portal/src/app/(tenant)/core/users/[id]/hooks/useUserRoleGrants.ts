"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { computeReplacementDiff, type ReplacementDiff } from "@/design-system";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  addBranchRoleAssignment,
  branchRoleAssignmentKey,
  removeBranchRoleAssignment,
  replaceBranchRoleAssignments,
  replaceScopeRoleAssignments,
  scopeRoleAssignmentKey,
  type BranchRoleAssignment,
  type ScopeRoleAssignment,
  type ScopeRoleAssignmentInput,
} from "../../../contracts/role-assignment-contract";
import { useUserRoleGrantsData } from "./useUserRoleGrantsData";

export interface BranchRoleGrant {
  branchId: string;
  roleId: string;
}

interface ScopedState<T> {
  userId: string;
  value: T;
}

function toAssignmentInput(assignment: ScopeRoleAssignment): ScopeRoleAssignmentInput {
  return {
    scopeTarget: assignment.scopeTarget,
    roleId: assignment.roleId,
    companyId: assignment.companyId ?? undefined,
    branchId: assignment.branchId ?? undefined,
  };
}

function scopedForUser<T>(state: ScopedState<T> | null, userId: string): T | null {
  return state?.userId === userId ? state.value : null;
}

/**
 * Coordinates atomic replacement and single-grant mutations over
 * `useUserRoleGrantsData`. Every draft, review flag, and pending removal is
 * keyed to the `userId` that opened it so switching targets can never commit a
 * previous user's draft, while same-user drafts survive reload/write failures.
 */
export function useUserRoleGrants(
  userId: string,
  enabled: boolean,
  isTenantOwnerActor: boolean,
) {
  const data = useUserRoleGrantsData(userId, enabled, isTenantOwnerActor);
  const { branchRoles, scopeRoles, branchReady, scopeReady, reload } = data;

  const [writeErrorState, setWriteErrorState] =
    useState<ScopedState<NormalizedApiError> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removalState, setRemovalState] =
    useState<ScopedState<BranchRoleAssignment> | null>(null);
  const [draftState, setDraftState] =
    useState<ScopedState<ScopeRoleAssignmentInput[]> | null>(null);
  const [reviewUserId, setReviewUserId] = useState<string | null>(null);
  const [branchDraftState, setBranchDraftState] =
    useState<ScopedState<BranchRoleGrant[]> | null>(null);
  const [branchReviewUserId, setBranchReviewUserId] = useState<string | null>(null);

  const writeError = scopedForUser(writeErrorState, userId);
  const pendingRemoval = scopedForUser(removalState, userId);
  const draft = scopedForUser(draftState, userId);
  const branchDraft = scopedForUser(branchDraftState, userId);

  const inFlightRef = useRef(false);
  const latestRef = useRef({
    userId,
    enabled,
    isTenantOwnerActor,
    branchReady,
    scopeReady,
    branchRoles,
    scopeRoles,
    removalState,
    branchDraftState,
    draftState,
  });

  useEffect(() => {
    latestRef.current = {
      userId,
      enabled,
      isTenantOwnerActor,
      branchReady,
      scopeReady,
      branchRoles,
      scopeRoles,
      removalState,
      branchDraftState,
      draftState,
    };
  });

  const clearWriteError = useCallback(() => setWriteErrorState(null), []);

  const setBranchDraft: Dispatch<SetStateAction<BranchRoleGrant[] | null>> = useCallback(
    (action) => {
      const targetUserId = latestRef.current.userId;
      const prev = scopedForUser(latestRef.current.branchDraftState, targetUserId);
      const next = typeof action === "function" ? action(prev) : action;
      const scoped = next ? { userId: targetUserId, value: next } : null;
      latestRef.current.branchDraftState = scoped;
      setBranchDraftState(scoped);
    },
    [],
  );

  const setDraft: Dispatch<SetStateAction<ScopeRoleAssignmentInput[] | null>> = useCallback(
    (action) => {
      const targetUserId = latestRef.current.userId;
      const prev = scopedForUser(latestRef.current.draftState, targetUserId);
      const next = typeof action === "function" ? action(prev) : action;
      const scoped = next ? { userId: targetUserId, value: next } : null;
      latestRef.current.draftState = scoped;
      setDraftState(scoped);
    },
    [],
  );

  const runWrite = useCallback(
    async (targetUserId: string, work: () => Promise<void>): Promise<boolean> => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      setIsSubmitting(true);
      setWriteErrorState(null);
      try {
        await work();
        reload();
        return true;
      } catch (error) {
        setWriteErrorState({ userId: targetUserId, value: normalizeApiError(error) });
        return false;
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [reload],
  );

  const addBranchRole = useCallback(
    (body: { branchId: string; roleId: string }): Promise<boolean> => {
      const state = latestRef.current;
      if (inFlightRef.current || !state.branchReady) return Promise.resolve(false);
      return runWrite(state.userId, async () => {
        await addBranchRoleAssignment(state.userId, body);
      });
    },
    [runWrite],
  );

  const removeBranchRole = useCallback((): Promise<boolean> => {
    const state = latestRef.current;
    const activeRemoval = scopedForUser(state.removalState, state.userId);
    if (inFlightRef.current || !activeRemoval || !state.branchReady) {
      if (!state.enabled) setRemovalState(null);
      return Promise.resolve(false);
    }
    return runWrite(state.userId, async () => {
      await removeBranchRoleAssignment(state.userId, activeRemoval.id);
      latestRef.current.removalState = null;
      setRemovalState(null);
    });
  }, [runWrite]);

  const commitBranchRoles = useCallback((): Promise<boolean> => {
    const state = latestRef.current;
    const activeDraft = scopedForUser(state.branchDraftState, state.userId);
    if (inFlightRef.current || !activeDraft || !state.branchReady) {
      if (!state.enabled) setBranchReviewUserId(null);
      return Promise.resolve(false);
    }
    return runWrite(state.userId, async () => {
      await replaceBranchRoleAssignments(state.userId, activeDraft);
      setBranchDraft(null);
      setBranchReviewUserId(null);
    });
  }, [runWrite, setBranchDraft]);

  const branchDiff = useCallback(
    (describe: (grant: BranchRoleGrant) => { label: string; hint?: string }): ReplacementDiff =>
      computeReplacementDiff(
        branchRoles.map((a) => ({ id: branchRoleAssignmentKey(a), ...describe(a) })),
        (branchDraft ?? []).map((g) => ({ id: branchRoleAssignmentKey(g), ...describe(g) })),
      ),
    [branchDraft, branchRoles],
  );

  const commitScopeRoles = useCallback((): Promise<boolean> => {
    const state = latestRef.current;
    const activeDraft = scopedForUser(state.draftState, state.userId);
    if (inFlightRef.current || !activeDraft || !state.scopeReady) {
      if (!state.enabled || !state.isTenantOwnerActor) setReviewUserId(null);
      return Promise.resolve(false);
    }
    return runWrite(state.userId, async () => {
      await replaceScopeRoleAssignments(state.userId, activeDraft);
      setDraft(null);
      setReviewUserId(null);
    });
  }, [runWrite, setDraft]);

  const scopeDiff = useCallback(
    (describe: (item: ScopeRoleAssignmentInput) => { label: string; hint?: string }): ReplacementDiff =>
      computeReplacementDiff(
        scopeRoles.map((a) => ({ id: scopeRoleAssignmentKey(a), ...describe(toAssignmentInput(a)) })),
        (draft ?? []).map((a) => ({ id: scopeRoleAssignmentKey(a), ...describe(a) })),
      ),
    [draft, scopeRoles],
  );

  return {
    branchRoles,
    branchError: data.branchError,
    isBranchLoading: data.isBranchLoading,
    scopeRoles,
    scopeError: data.scopeError,
    isScopeLoading: data.isScopeLoading,
    writeError,
    clearWriteError,
    isSubmitting,
    reload,
    addBranchRole,
    pendingRemoval,
    requestRemoval: (target: BranchRoleAssignment | null) => {
      const state = latestRef.current;
      if (target && (inFlightRef.current || !state.branchReady)) return;
      setWriteErrorState(null);
      const scoped = target ? { userId: state.userId, value: target } : null;
      latestRef.current.removalState = scoped;
      setRemovalState(scoped);
    },
    cancelRemoval: () => {
      if (inFlightRef.current) return;
      latestRef.current.removalState = null;
      setRemovalState(null);
      setWriteErrorState(null);
    },
    removeBranchRole,
    branchDraft,
    setBranchDraft,
    startBranchReplace: () => {
      const state = latestRef.current;
      if (inFlightRef.current || !state.branchReady) return;
      setWriteErrorState(null);
      setBranchDraft(state.branchRoles.map(({ branchId, roleId }) => ({ branchId, roleId })));
    },
    cancelBranchReplace: () => {
      if (inFlightRef.current) return;
      setBranchDraft(null);
      setBranchReviewUserId(null);
      setWriteErrorState(null);
    },
    isReviewingBranch: branchReviewUserId === userId && enabled && branchDraft !== null,
    reviewBranch: () => {
      const state = latestRef.current;
      if (!inFlightRef.current && state.branchReady && scopedForUser(state.branchDraftState, state.userId)) {
        setBranchReviewUserId(state.userId);
      }
    },
    closeBranchReview: () => {
      if (!inFlightRef.current) setBranchReviewUserId(null);
    },
    commitBranchRoles,
    branchDiff,
    draft,
    setDraft,
    startScopeEdit: () => {
      const state = latestRef.current;
      if (inFlightRef.current || !state.scopeReady) return;
      setWriteErrorState(null);
      setDraft(state.scopeRoles.map(toAssignmentInput));
    },
    cancelScopeEdit: () => {
      if (inFlightRef.current) return;
      setDraft(null);
      setReviewUserId(null);
      setWriteErrorState(null);
    },
    isReviewing: reviewUserId === userId && enabled && isTenantOwnerActor && draft !== null,
    review: () => {
      const state = latestRef.current;
      if (!inFlightRef.current && state.scopeReady && scopedForUser(state.draftState, state.userId)) {
        setReviewUserId(state.userId);
      }
    },
    closeReview: () => {
      if (!inFlightRef.current) setReviewUserId(null);
    },
    commitScopeRoles,
    scopeDiff,
  };
}
