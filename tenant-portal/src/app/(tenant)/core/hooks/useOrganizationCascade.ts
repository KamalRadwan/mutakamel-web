"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useOrgNodeOptions, type RemoteOptions } from "./useCoreOptions";
import {
  applyManualCascadeSelection,
  computeControlledUpstreamReset,
  computeNextAutoSelectionPatch,
  createEmptyDismissedScopes,
  type ControlledCascadeSnapshot,
  type DismissedCascadeScopes,
  type OrganizationCascadeLevel,
  type OrganizationCascadePatch,
} from "./organization-cascade-helpers";

export interface UseOrganizationCascadeOptions {
  enabled: boolean;
  companyId: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string;
  includeBranches?: boolean;
  includeDepartments?: boolean;
  includeTeams?: boolean;
  /** Optional team placement stays blank unless explicitly opted into auto-select. */
  autoSelectTeams?: boolean;
  onChange: (patch: OrganizationCascadePatch) => void;
}

export interface OrganizationCascadeResult {
  companies: RemoteOptions;
  branches: RemoteOptions;
  departments: RemoteOptions;
  teams: RemoteOptions;
  selectCompany: (id: string | null | undefined) => void;
  selectBranch: (id: string | null | undefined) => void;
  selectDepartment: (id: string | null | undefined) => void;
  selectTeam: (id: string | null | undefined) => void;
}

/**
 * Returns the sole eligible option ID only when an unsearched, completed
 * response proves the entire server catalogue for this scope has exactly one
 * active selectable item (`total === 1 && hasNext === false`).
 */
export function getSoleEligibleOptionId(remote: RemoteOptions): string | undefined {
  if (
    remote.isLoading ||
    Boolean(remote.error) ||
    remote.isUnsearchedReady !== true ||
    remote.hasNext !== false ||
    remote.total !== 1 ||
    remote.options.length !== 1
  ) {
    return undefined;
  }
  const [soleOption] = remote.options;
  if (!soleOption || soleOption.disabled || soleOption.value.trim().length === 0) {
    return undefined;
  }
  return soleOption.value;
}

export function isSoleEligibleOption(remote: RemoteOptions): boolean {
  return getSoleEligibleOptionId(remote) !== undefined;
}

/** True only after a clean completed load with zero items (`403`/errors are never empty). */
export function isRemoteOptionsEmpty(remote: RemoteOptions): boolean {
  return (
    !remote.isLoading &&
    !remote.error &&
    remote.isReady === true &&
    remote.options.length === 0 &&
    remote.hasNext === false
  );
}

export function isRemoteOptionsForbidden(remote: RemoteOptions): boolean {
  return remote.error?.status === 403;
}

export function useOrganizationCascade(
  options: UseOrganizationCascadeOptions,
): OrganizationCascadeResult {
  const {
    enabled,
    companyId,
    branchId,
    departmentId,
    teamId,
    includeBranches = true,
    includeDepartments = true,
    includeTeams = false,
    autoSelectTeams = false,
    onChange,
  } = options;

  const normalizedCompanyId = companyId.trim();
  const normalizedBranchId = branchId?.trim() ?? "";
  const normalizedDepartmentId = departmentId?.trim() ?? "";
  const normalizedTeamId = teamId?.trim() ?? "";

  const hasBranchField = includeBranches || branchId !== undefined;
  const hasDepartmentField = includeDepartments || departmentId !== undefined;
  const hasTeamField = includeTeams || teamId !== undefined;
  const patchFlags = useMemo(
    () => ({
      includeBranches: hasBranchField,
      includeDepartments: hasDepartmentField,
      includeTeams: hasTeamField,
    }),
    [hasBranchField, hasDepartmentField, hasTeamField],
  );

  // Each level filters strictly by its backend parent query key:
  // branches -> companyId, departments -> branchId, teams -> departmentId.
  const companies = useOrgNodeOptions("companies", { enabled });
  const branches = useOrgNodeOptions("branches", {
    parentId: normalizedCompanyId || undefined,
    enabled: Boolean(enabled && includeBranches && normalizedCompanyId),
  });
  const departments = useOrgNodeOptions("departments", {
    parentId: normalizedBranchId || undefined,
    enabled: Boolean(enabled && includeDepartments && normalizedCompanyId && normalizedBranchId),
  });
  const teams = useOrgNodeOptions("teams", {
    parentId: normalizedDepartmentId || undefined,
    enabled: Boolean(
      enabled && includeTeams && normalizedCompanyId && normalizedBranchId && normalizedDepartmentId,
    ),
  });

  const selectionEpochRef = useRef(0);
  const dismissedScopesRef = useRef<DismissedCascadeScopes>(createEmptyDismissedScopes());
  const prevControlledRef = useRef<ControlledCascadeSnapshot>({
    enabled: false,
    companyId: "",
    branchId: "",
    departmentId: "",
    teamId: "",
  });
  const latestRef = useRef({
    enabled,
    companyId: normalizedCompanyId,
    branchId: normalizedBranchId,
    departmentId: normalizedDepartmentId,
    teamId: normalizedTeamId,
    onChange,
  });

  useEffect(() => {
    latestRef.current = {
      enabled,
      companyId: normalizedCompanyId,
      branchId: normalizedBranchId,
      departmentId: normalizedDepartmentId,
      teamId: normalizedTeamId,
      onChange,
    };
  });

  useEffect(() => {
    const nextSnapshot: ControlledCascadeSnapshot = {
      enabled,
      companyId: normalizedCompanyId,
      branchId: normalizedBranchId,
      departmentId: normalizedDepartmentId,
      teamId: normalizedTeamId,
    };
    const { patch, nextDismissed } = computeControlledUpstreamReset(
      prevControlledRef.current,
      nextSnapshot,
      dismissedScopesRef.current,
      patchFlags,
    );
    prevControlledRef.current = nextSnapshot;
    dismissedScopesRef.current = nextDismissed;

    if (!enabled) {
      selectionEpochRef.current += 1;
      return;
    }
    if (!patch) return;

    const epoch = ++selectionEpochRef.current;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || selectionEpochRef.current !== epoch || !latestRef.current.enabled) return;
      latestRef.current.onChange(patch);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, normalizedBranchId, normalizedCompanyId, normalizedDepartmentId, normalizedTeamId, patchFlags]);

  const soleCompanyId = getSoleEligibleOptionId(companies);
  const soleBranchId = includeBranches ? getSoleEligibleOptionId(branches) : undefined;
  const soleDepartmentId = includeDepartments ? getSoleEligibleOptionId(departments) : undefined;
  const soleTeamId = includeTeams && autoSelectTeams ? getSoleEligibleOptionId(teams) : undefined;

  useEffect(() => {
    if (!enabled) return;
    const expected = {
      companyId: normalizedCompanyId,
      branchId: normalizedBranchId,
      departmentId: normalizedDepartmentId,
      teamId: normalizedTeamId,
    };
    const nextPatch = computeNextAutoSelectionPatch({
      selection: expected,
      soleIds: { companyId: soleCompanyId, branchId: soleBranchId, departmentId: soleDepartmentId, teamId: soleTeamId },
      includeBranches,
      includeDepartments,
      includeTeams,
      autoSelectTeams,
      dismissed: dismissedScopesRef.current,
      flags: patchFlags,
    });
    if (!nextPatch) return;

    const epoch = selectionEpochRef.current;
    let cancelled = false;
    queueMicrotask(() => {
      const current = latestRef.current;
      if (
        cancelled ||
        selectionEpochRef.current !== epoch ||
        !current.enabled ||
        current.companyId !== expected.companyId ||
        current.branchId !== expected.branchId ||
        current.departmentId !== expected.departmentId ||
        current.teamId !== expected.teamId
      ) {
        return;
      }
      current.onChange(nextPatch);
    });
    return () => {
      cancelled = true;
    };
  }, [
    autoSelectTeams, enabled, includeBranches, includeDepartments, includeTeams,
    normalizedBranchId, normalizedCompanyId, normalizedDepartmentId, normalizedTeamId,
    patchFlags, soleBranchId, soleCompanyId, soleDepartmentId, soleTeamId,
  ]);

  const handleManualSelect = useCallback(
    (level: OrganizationCascadeLevel, id: string | null | undefined) => {
      const current = latestRef.current;
      const result = applyManualCascadeSelection(level, id, current, dismissedScopesRef.current, patchFlags);
      dismissedScopesRef.current = result.nextDismissed;
      if (result.shouldFenceEpoch) selectionEpochRef.current += 1;
      if (result.patch) current.onChange(result.patch);
    },
    [patchFlags],
  );

  const selectCompany = useCallback((id: string | null | undefined) => handleManualSelect("company", id), [handleManualSelect]);
  const selectBranch = useCallback((id: string | null | undefined) => handleManualSelect("branch", id), [handleManualSelect]);
  const selectDepartment = useCallback((id: string | null | undefined) => handleManualSelect("department", id), [handleManualSelect]);
  const selectTeam = useCallback((id: string | null | undefined) => handleManualSelect("team", id), [handleManualSelect]);

  return { companies, branches, departments, teams, selectCompany, selectBranch, selectDepartment, selectTeam };
}
