"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useCan } from "@/design-system";
import { isUUIDv7 } from "@/lib/uuid";
import {
  type OrgLevel,
  type OrgNodeOf,
} from "../../contracts/organization-contract";
import { useCoreErrorText } from "../../hooks/useCoreErrorText";
import { useTenantUserOptions } from "../../hooks/useCoreOptions";
import {
  isRemoteOptionsForbidden,
  useOrganizationCascade,
} from "../../hooks/useOrganizationCascade";
import type { EditReadOnlyParents } from "../components/OrganizationCascadeFields";
import { resolveDirectParentId } from "../organization-payloads";
import { useOrganizationForm } from "./useOrganizationForm";
import { useOrganizationLevel } from "./useOrganizationLevel";
import { useOrganizationFilters } from "./useOrganizationFilters";

export function useOrganizationWorkspace<L extends OrgLevel>(level: L) {
  const screen = useOrganizationLevel(level);
  const { t, config, lookups, setDraftDepartmentId } = screen;
  const copy = t.coreIdentity;
  const describeError = useCoreErrorText();

  const mode: "create" | "edit" = screen.editing ? "edit" : "create";
  const isFormOpen = screen.isCreateOpen || screen.editing !== null;
  const formState = useOrganizationForm(level, mode);

  useEffect(() => {
    if (level !== "teams" || !screen.isCreateOpen) {
      setDraftDepartmentId("");
      return;
    }
    setDraftDepartmentId(resolveDirectParentId("teams", formState.form));
  }, [formState.form, level, screen.isCreateOpen, setDraftDepartmentId]);

  const canReadCompanies = useCan("org.company.read");
  const canReadBranches = useCan("org.branch.read");
  const canReadDepartments = useCan("org.department.read");
  const canReadUsers = useCan("users.user.read");

  const missingUpstreamPermission =
    (config.ancestors.includes("companies") && !canReadCompanies) ||
    (config.ancestors.includes("branches") && !canReadBranches) ||
    (config.ancestors.includes("departments") && !canReadDepartments);

  const cascade = useOrganizationCascade({
    enabled: screen.isCreateOpen && Boolean(config.parent) && !missingUpstreamPermission,
    companyId: formState.form.companyId,
    branchId: formState.form.branchId,
    departmentId: formState.form.departmentId,
    includeBranches: level === "departments" || level === "teams",
    includeDepartments: level === "teams",
    includeTeams: false,
    onChange: formState.patch,
  });

  const cascadeForbidden =
    (config.ancestors.includes("companies") && isRemoteOptionsForbidden(cascade.companies)) ||
    (config.ancestors.includes("branches") && isRemoteOptionsForbidden(cascade.branches)) ||
    (config.ancestors.includes("departments") && isRemoteOptionsForbidden(cascade.departments));

  const directParentId = resolveDirectParentId(level, formState.form);
  const createScopeDenied =
    mode === "create" &&
    Boolean(config.parent) &&
    isUUIDv7(directParentId) &&
    !screen.canSubmitCreate(formState.form);
  const isTeamLookupPending =
    level === "teams" &&
    isUUIDv7(directParentId) &&
    lookups.department(directParentId).status === "loading";

  const { filterDefs, filterValues, handleFilterChange, handleFilterReset } = useOrganizationFilters(level, screen);

  const leadUserOptions = useTenantUserOptions(
    isFormOpen && config.fields.includes("leadUserId") && canReadUsers,
  );

  const openCreate = useCallback(() => {
    formState.loadCreateDefaults();
    screen.clearMutationError();
    screen.openCreate();
  }, [formState, screen]);

  const openEdit = useCallback(
    (node: OrgNodeOf<L>) => {
      if (!screen.canManageRow(node)) return;
      formState.loadEditRecord(node);
      screen.clearMutationError();
      screen.startEdit(node);
    },
    [formState, screen],
  );

  const closeModal = useCallback(() => {
    screen.closeCreate();
    screen.cancelEdit();
    screen.clearMutationError();
  }, [screen]);

  const submitModal = useCallback(() => {
    if (!formState.validateForSubmit()) return;
    void (screen.editing
      ? screen.handleUpdate(formState.form)
      : screen.handleCreate(formState.form));
  }, [formState, screen]);

  const editReadOnlyParents = useMemo<EditReadOnlyParents | undefined>(() => {
    const target = screen.editing;
    if (!target) return undefined;
    const deptLookup =
      "departmentId" in target ? lookups.department(target.departmentId) : null;
    const branchId =
      "branchId" in target
        ? target.branchId
        : deptLookup?.status === "ready"
          ? deptLookup.value.branchId
          : null;
    const branchLookup = branchId ? lookups.branch(branchId) : null;
    const companyId =
      "companyId" in target
        ? target.companyId
        : branchLookup?.status === "ready"
          ? branchLookup.value.companyId
          : null;
    const companyLookup = companyId ? lookups.company(companyId) : null;
    return {
      companyLabel: companyLookup?.status === "ready" ? companyLookup.value.name : undefined,
      branchLabel: branchLookup?.status === "ready" ? branchLookup.value.name : undefined,
      departmentLabel: deptLookup?.status === "ready" ? deptLookup.value.name : undefined,
    };
  }, [lookups, screen.editing]);

  const selectedLeadLabel = useMemo(() => {
    if (!formState.form.leadUserId) return undefined;
    const lead = lookups.user(formState.form.leadUserId);
    return lead.status === "ready" ? lead.value.fullName : undefined;
  }, [formState.form.leadUserId, lookups]);

  const quickViewCanManage =
    screen.quickViewTarget?.kind === "node" &&
    screen.canManageRow(screen.quickViewTarget.node as OrgNodeOf<L>);

  const mutationText = describeError(screen.mutationError);
  const modalError =
    mutationText ??
    (createScopeDenied && !isTeamLookupPending ? copy.errors.FORBIDDEN : undefined);

  return {
    screen,
    formState,
    mode,
    isFormOpen,
    cascade,
    leadUserOptions,
    canReadUsers,
    selectedLeadLabel,
    missingUpstreamPermission: missingUpstreamPermission || cascadeForbidden,
    submitDisabled: mode === "create" && (cascadeForbidden || createScopeDenied),
    editReadOnlyParents,
    quickViewCanManage,
    filterDefs,
    filterValues,
    handleFilterChange,
    handleFilterReset,
    openCreate,
    openEdit,
    closeModal,
    submitModal,
    mutationText,
    modalError,
  };
}
