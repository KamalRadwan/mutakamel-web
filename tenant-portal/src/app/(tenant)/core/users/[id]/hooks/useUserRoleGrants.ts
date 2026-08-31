"use client";

import { useCallback, useEffect, useState } from "react";
import { computeReplacementDiff, type ReplacementDiff } from "@/design-system";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  addBranchRoleAssignment,
  branchRoleAssignmentKey,
  fetchBranchRoleAssignments,
  fetchScopeRoleAssignments,
  removeBranchRoleAssignment,
  replaceBranchRoleAssignments,
  replaceScopeRoleAssignments,
  scopeRoleAssignmentKey,
  type BranchRoleAssignment,
  type ScopeRoleAssignment,
  type ScopeRoleAssignmentInput,
} from "../../../contracts/role-assignment-contract";

/**
 * The two grant models a Core user can hold, loaded independently.
 *
 * They are a **union**, not alternatives: `tenant_user_branch_roles` scopes one
 * role to one branch and supports add/remove, `tenant_user_scope_roles` scopes a
 * role to TENANT / COMPANY / BRANCH and is replaced atomically by an owner. A
 * separate request each, so a 403 on the owner-only scope list cannot blank the
 * branch grants the caller is allowed to see.
 */
export interface BranchRoleGrant {
  branchId: string;
  roleId: string;
}

function toAssignmentInput(assignment: ScopeRoleAssignment): ScopeRoleAssignmentInput {
  return {
    scopeTarget: assignment.scopeTarget,
    roleId: assignment.roleId,
    companyId: assignment.companyId ?? undefined,
    branchId: assignment.branchId ?? undefined,
  };
}

export function useUserRoleGrants(userId: string, enabled: boolean) {
  const [branchRoles, setBranchRoles] = useState<BranchRoleAssignment[]>([]);
  const [branchError, setBranchError] = useState<NormalizedApiError | null>(null);
  const [isBranchLoading, setIsBranchLoading] = useState(enabled);

  const [scopeRoles, setScopeRoles] = useState<ScopeRoleAssignment[]>([]);
  const [scopeError, setScopeError] = useState<NormalizedApiError | null>(null);
  const [isScopeLoading, setIsScopeLoading] = useState(enabled);

  const [writeError, setWriteError] = useState<NormalizedApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [pendingRemoval, setPendingRemoval] = useState<BranchRoleAssignment | null>(null);
  const [draft, setDraft] = useState<ScopeRoleAssignmentInput[] | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [branchDraft, setBranchDraft] = useState<BranchRoleGrant[] | null>(null);
  const [isReviewingBranch, setIsReviewingBranch] = useState(false);

  useEffect(() => {
    // Deferred past the effect body on purpose: a synchronous setState there
    // cascades an extra render (react-hooks/set-state-in-effect), and the abort
    // check means a torn-down screen never writes at all.
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (!enabled || !isUUIDv7(userId)) {
        setIsBranchLoading(false);
        setIsScopeLoading(false);
        return;
      }
      setIsBranchLoading(true);
      setIsScopeLoading(true);
      setBranchError(null);
      setScopeError(null);

      fetchBranchRoleAssignments(userId, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setBranchRoles(result);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setBranchRoles([]);
          setBranchError(normalizeApiError(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsBranchLoading(false);
        });

      fetchScopeRoleAssignments(userId, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setScopeRoles(result);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setScopeRoles([]);
          setScopeError(normalizeApiError(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsScopeLoading(false);
        });
    });
    return () => controller.abort();
  }, [enabled, reloadToken, userId]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const runWrite = useCallback(
    async (work: () => Promise<void>) => {
      setIsSubmitting(true);
      setWriteError(null);
      try {
        await work();
        reload();
      } catch (error) {
        setWriteError(normalizeApiError(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [reload],
  );

  const addBranchRole = useCallback(
    (body: { branchId: string; roleId: string }) =>
      runWrite(async () => {
        await addBranchRoleAssignment(userId, body);
      }),
    [runWrite, userId],
  );

  const removeBranchRole = useCallback(() => {
    const target = pendingRemoval;
    if (!target) return Promise.resolve();
    return runWrite(async () => {
      await removeBranchRoleAssignment(userId, target.id);
      setPendingRemoval(null);
    });
  }, [pendingRemoval, runWrite, userId]);

  const commitBranchRoles = useCallback(() => {
    const next = branchDraft;
    if (!next) return Promise.resolve();
    return runWrite(async () => {
      await replaceBranchRoleAssignments(userId, next);
      setBranchDraft(null);
      setIsReviewingBranch(false);
    });
  }, [branchDraft, runWrite, userId]);

  const branchDiff = useCallback(
    (describe: (grant: BranchRoleGrant) => { label: string; hint?: string }): ReplacementDiff =>
      computeReplacementDiff(
        branchRoles.map((assignment) => ({
          id: branchRoleAssignmentKey(assignment),
          ...describe(assignment),
        })),
        (branchDraft ?? []).map((grant) => ({
          id: branchRoleAssignmentKey(grant),
          ...describe(grant),
        })),
      ),
    [branchDraft, branchRoles],
  );

  const commitScopeRoles = useCallback(() => {
    const next = draft;
    if (!next) return Promise.resolve();
    return runWrite(async () => {
      await replaceScopeRoleAssignments(userId, next);
      setDraft(null);
      setIsReviewing(false);
    });
  }, [draft, runWrite, userId]);

  const scopeDiff = useCallback(
    (describe: (assignment: ScopeRoleAssignmentInput) => { label: string; hint?: string }): ReplacementDiff =>
      computeReplacementDiff(
        // The stored row carries `null` where the DTO carries `undefined`; the
        // key function treats them identically, so the diff lines up.
        scopeRoles.map((assignment) => ({
          id: scopeRoleAssignmentKey(assignment),
          ...describe(toAssignmentInput(assignment)),
        })),
        (draft ?? []).map((assignment) => ({
          id: scopeRoleAssignmentKey(assignment),
          ...describe(assignment),
        })),
      ),
    [draft, scopeRoles],
  );

  return {
    branchRoles,
    branchError,
    isBranchLoading,
    scopeRoles,
    scopeError,
    isScopeLoading,
    writeError,
    isSubmitting,
    reload,
    addBranchRole,
    pendingRemoval,
    requestRemoval: setPendingRemoval,
    cancelRemoval: () => setPendingRemoval(null),
    removeBranchRole,
    branchDraft,
    setBranchDraft,
    startBranchReplace: () =>
      setBranchDraft(
        branchRoles.map(({ branchId, roleId }) => ({ branchId, roleId })),
      ),
    cancelBranchReplace: () => {
      setBranchDraft(null);
      setIsReviewingBranch(false);
    },
    isReviewingBranch,
    reviewBranch: () => setIsReviewingBranch(true),
    closeBranchReview: () => setIsReviewingBranch(false),
    commitBranchRoles,
    branchDiff,
    draft,
    setDraft,
    startScopeEdit: () =>
      setDraft(
        scopeRoles.map(({ scopeTarget, roleId, companyId, branchId }) => ({
          scopeTarget,
          roleId,
          companyId: companyId ?? undefined,
          branchId: branchId ?? undefined,
        })),
      ),
    cancelScopeEdit: () => {
      setDraft(null);
      setIsReviewing(false);
    },
    isReviewing,
    review: () => setIsReviewing(true),
    closeReview: () => setIsReviewing(false),
    commitScopeRoles,
    scopeDiff,
  };
}
