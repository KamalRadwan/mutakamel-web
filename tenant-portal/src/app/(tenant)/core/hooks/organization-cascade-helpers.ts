export type OrganizationCascadeLevel = "company" | "branch" | "department" | "team";

export interface OrganizationCascadeSelection {
  companyId: string;
  branchId: string;
  departmentId: string;
  teamId: string;
}

export type OrganizationCascadePatch = Partial<OrganizationCascadeSelection>;

export interface CascadePatchFlags {
  includeBranches?: boolean;
  includeDepartments?: boolean;
  includeTeams?: boolean;
}

export interface ControlledCascadeSnapshot extends OrganizationCascadeSelection {
  enabled: boolean;
}

export interface DismissedCascadeScopes {
  company: boolean;
  branchForCompany: string | null;
  departmentForBranch: string | null;
  teamForDepartment: string | null;
}

export function createEmptyDismissedScopes(): DismissedCascadeScopes {
  return {
    company: false,
    branchForCompany: null,
    departmentForBranch: null,
    teamForDepartment: null,
  };
}

export function buildCascadeSelectionPatch(
  level: OrganizationCascadeLevel,
  nextId: string | null | undefined,
  flags: CascadePatchFlags = {},
): OrganizationCascadePatch {
  const normalized = nextId?.trim() ?? "";
  const { includeBranches = true, includeDepartments = true, includeTeams = false } = flags;

  if (level === "company") {
    return {
      companyId: normalized,
      ...(includeBranches ? { branchId: "" } : {}),
      ...(includeDepartments ? { departmentId: "" } : {}),
      ...(includeTeams ? { teamId: "" } : {}),
    };
  }
  if (level === "branch") {
    return {
      branchId: normalized,
      ...(includeDepartments ? { departmentId: "" } : {}),
      ...(includeTeams ? { teamId: "" } : {}),
    };
  }
  if (level === "department") {
    return {
      departmentId: normalized,
      ...(includeTeams ? { teamId: "" } : {}),
    };
  }
  return { teamId: normalized };
}

export function applyManualCascadeSelection(
  level: OrganizationCascadeLevel,
  nextId: string | null | undefined,
  current: OrganizationCascadeSelection,
  dismissed: DismissedCascadeScopes,
  flags: CascadePatchFlags,
): {
  shouldFenceEpoch: boolean;
  patch: OrganizationCascadePatch | null;
  nextDismissed: DismissedCascadeScopes;
} {
  const normalized = nextId?.trim() ?? "";
  const currentId =
    level === "company"
      ? current.companyId
      : level === "branch"
        ? current.branchId
        : level === "department"
          ? current.departmentId
          : current.teamId;

  if (normalized !== "" && normalized === currentId) {
    return { shouldFenceEpoch: false, patch: null, nextDismissed: dismissed };
  }

  const nextDismissed: DismissedCascadeScopes =
    level === "company"
      ? {
          company: normalized === "",
          branchForCompany: null,
          departmentForBranch: null,
          teamForDepartment: null,
        }
      : level === "branch"
        ? {
            ...dismissed,
            branchForCompany: normalized === "" ? current.companyId : null,
            departmentForBranch: null,
            teamForDepartment: null,
          }
        : level === "department"
          ? {
              ...dismissed,
              departmentForBranch: normalized === "" ? current.branchId : null,
              teamForDepartment: null,
            }
          : {
              ...dismissed,
              teamForDepartment: normalized === "" ? current.departmentId : null,
            };

  const alreadyCleared =
    normalized === "" &&
    currentId === "" &&
    (level === "team" || current.teamId === "") &&
    (level === "team" || level === "department" || current.departmentId === "") &&
    (level !== "company" || current.branchId === "");

  return {
    shouldFenceEpoch: true,
    patch: alreadyCleared ? null : buildCascadeSelectionPatch(level, normalized, flags),
    nextDismissed,
  };
}

/**
 * Detects when a caller mutates an upstream ID directly through controlled props
 * while leaving descendant IDs at their previous non-empty values.
 */
export function computeControlledUpstreamReset(
  prev: ControlledCascadeSnapshot,
  next: ControlledCascadeSnapshot,
  dismissed: DismissedCascadeScopes,
  flags: CascadePatchFlags,
): { patch: OrganizationCascadePatch | null; nextDismissed: DismissedCascadeScopes } {
  if (!next.enabled) return { patch: null, nextDismissed: createEmptyDismissedScopes() };
  if (!prev.enabled) return { patch: null, nextDismissed: dismissed };

  const nextDismissed: DismissedCascadeScopes = { ...dismissed };

  if (prev.companyId !== "" && prev.companyId !== next.companyId) {
    if (next.companyId === "") nextDismissed.company = true;
    nextDismissed.branchForCompany = null;
    nextDismissed.departmentForBranch = null;
    nextDismissed.teamForDepartment = null;
    const stale =
      (next.branchId !== "" && next.branchId === prev.branchId) ||
      (next.departmentId !== "" && next.departmentId === prev.departmentId) ||
      (next.teamId !== "" && next.teamId === prev.teamId);
    return {
      patch: stale ? buildCascadeSelectionPatch("company", next.companyId, flags) : null,
      nextDismissed,
    };
  }
  if (prev.companyId === next.companyId && prev.branchId !== "" && prev.branchId !== next.branchId) {
    if (next.branchId === "") nextDismissed.branchForCompany = next.companyId;
    nextDismissed.departmentForBranch = null;
    nextDismissed.teamForDepartment = null;
    const stale =
      (next.departmentId !== "" && next.departmentId === prev.departmentId) ||
      (next.teamId !== "" && next.teamId === prev.teamId);
    return {
      patch: stale ? buildCascadeSelectionPatch("branch", next.branchId, flags) : null,
      nextDismissed,
    };
  }
  if (
    prev.companyId === next.companyId &&
    prev.branchId === next.branchId &&
    prev.departmentId !== "" &&
    prev.departmentId !== next.departmentId
  ) {
    if (next.departmentId === "") nextDismissed.departmentForBranch = next.branchId;
    nextDismissed.teamForDepartment = null;
    const stale = next.teamId !== "" && next.teamId === prev.teamId;
    return {
      patch: stale ? buildCascadeSelectionPatch("department", next.departmentId, flags) : null,
      nextDismissed,
    };
  }
  return { patch: null, nextDismissed };
}

export function computeNextAutoSelectionPatch(params: {
  selection: OrganizationCascadeSelection;
  soleIds: { companyId?: string; branchId?: string; departmentId?: string; teamId?: string };
  includeBranches: boolean;
  includeDepartments: boolean;
  includeTeams: boolean;
  autoSelectTeams: boolean;
  dismissed: DismissedCascadeScopes;
  flags: CascadePatchFlags;
}): OrganizationCascadePatch | null {
  const { selection, soleIds, includeBranches, includeDepartments, includeTeams, autoSelectTeams, dismissed, flags } =
    params;

  if (selection.companyId === "" && soleIds.companyId && !dismissed.company) {
    return buildCascadeSelectionPatch("company", soleIds.companyId, flags);
  }
  if (
    includeBranches &&
    selection.companyId !== "" &&
    selection.branchId === "" &&
    soleIds.branchId &&
    dismissed.branchForCompany !== selection.companyId
  ) {
    return buildCascadeSelectionPatch("branch", soleIds.branchId, flags);
  }
  if (
    includeDepartments &&
    selection.companyId !== "" &&
    selection.branchId !== "" &&
    selection.departmentId === "" &&
    soleIds.departmentId &&
    dismissed.departmentForBranch !== selection.branchId
  ) {
    return buildCascadeSelectionPatch("department", soleIds.departmentId, flags);
  }
  if (
    includeTeams &&
    autoSelectTeams &&
    selection.companyId !== "" &&
    selection.branchId !== "" &&
    selection.departmentId !== "" &&
    selection.teamId === "" &&
    soleIds.teamId &&
    dismissed.teamForDepartment !== selection.departmentId
  ) {
    return buildCascadeSelectionPatch("team", soleIds.teamId, flags);
  }
  return null;
}
