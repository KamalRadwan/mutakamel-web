"use client";

import { useCallback, useState } from "react";
import {
  SCOPE_ROLE_TARGETS,
  scopeRoleAssignmentKey,
  type ScopeRoleAssignmentInput,
  type ScopeRoleTarget,
} from "../../../contracts/role-assignment-contract";
import { useOrganizationCascade } from "../../../hooks/useOrganizationCascade";

interface UseScopeRoleDraftFormOptions {
  draft: ScopeRoleAssignmentInput[];
  initialKeys: string[];
  onDraftChange: (next: ScopeRoleAssignmentInput[]) => void;
}

/**
 * Enforces `ScopeRoleAssignmentsService` ACTIVE_SCOPE_PREDICATE:
 * - `TENANT`: neither `companyId` nor `branchId`
 * - `COMPANY`: `companyId` required, `branchId` omitted
 * - `BRANCH`: both `companyId` and a matching `branchId` under that company required
 */
export function useScopeRoleDraftForm({
  draft,
  initialKeys,
  onDraftChange,
}: UseScopeRoleDraftFormOptions) {
  const [scopeTarget, setScopeTarget] = useState<ScopeRoleTarget>("TENANT");
  const [roleId, setRoleId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");

  const handleCascadePatch = useCallback(
    (patch: { companyId?: string; branchId?: string }) => {
      if (patch.companyId !== undefined) setCompanyId(patch.companyId);
      if (patch.branchId !== undefined) setBranchId(patch.branchId);
    },
    [],
  );

  const cascade = useOrganizationCascade({
    enabled: scopeTarget !== "TENANT",
    companyId,
    branchId: scopeTarget === "BRANCH" ? branchId : undefined,
    includeBranches: scopeTarget === "BRANCH",
    includeDepartments: false,
    includeTeams: false,
    onChange: handleCascadePatch,
  });

  const canAdd =
    Boolean(roleId) &&
    (scopeTarget === "TENANT" ||
      (scopeTarget === "COMPANY" && Boolean(companyId)) ||
      (scopeTarget === "BRANCH" && Boolean(companyId) && Boolean(branchId)));

  const handleScopeTargetChange = useCallback((next: string) => {
    const resolved = SCOPE_ROLE_TARGETS.find((item) => item === next) ?? "TENANT";
    setScopeTarget(resolved);
    if (resolved === "TENANT") {
      setCompanyId("");
      setBranchId("");
    } else if (resolved === "COMPANY") {
      setBranchId("");
    }
  }, []);

  const addRow = useCallback(() => {
    if (!canAdd) return;
    const candidate: ScopeRoleAssignmentInput = {
      scopeTarget,
      roleId,
      companyId:
        scopeTarget === "COMPANY" || scopeTarget === "BRANCH"
          ? companyId
          : undefined,
      branchId: scopeTarget === "BRANCH" ? branchId : undefined,
    };
    const key = scopeRoleAssignmentKey(candidate);
    if (draft.some((item) => scopeRoleAssignmentKey(item) === key)) return;
    onDraftChange([...draft, candidate]);
    setRoleId("");
  }, [branchId, canAdd, companyId, draft, onDraftChange, roleId, scopeTarget]);

  const removeRow = useCallback(
    (key: string) => {
      onDraftChange(
        draft.filter((entry) => scopeRoleAssignmentKey(entry) !== key),
      );
    },
    [draft, onDraftChange],
  );

  const currentKeys = draft.map(scopeRoleAssignmentKey);
  const isDirty =
    currentKeys.length !== initialKeys.length ||
    currentKeys.some((key, index) => key !== initialKeys[index]);

  return {
    scopeTarget,
    roleId,
    setRoleId,
    companyId,
    branchId,
    cascade,
    canAdd,
    isDirty,
    handleScopeTargetChange,
    addRow,
    removeRow,
  };
}
