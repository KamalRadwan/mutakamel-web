"use client";

import { useCallback } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { can } from "@/lib/auth/permission-scope";
import type {
  ScopeRoleAssignment,
  ScopeRoleAssignmentInput,
} from "../../../contracts/role-assignment-contract";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import { useOrgNodeOptions, useRoleOptions } from "../../../hooks/useCoreOptions";
import { useRoleGrantOptions } from "../../../hooks/useRoleGrantOptions";
import { useUserRoleGrants } from "./useUserRoleGrants";

interface UseRoleGrantsPanelOptions {
  userId: string;
  canAssignRoles: boolean;
  isTenantOwnerActor: boolean;
  protectedTargetReason?: string;
}

function isOptionSourceReady(source: {
  isReady?: boolean;
  isLoading: boolean;
  error?: unknown;
}): boolean {
  return source.isReady ?? (!source.isLoading && !source.error);
}

export function useRoleGrantsPanel({
  userId,
  canAssignRoles,
  isTenantOwnerActor,
  protectedTargetReason,
}: UseRoleGrantsPanelOptions) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const describeError = useCoreErrorText();
  const enabled = canAssignRoles && !protectedTargetReason;
  const panel = useUserRoleGrants(userId, enabled, isTenantOwnerActor);
  const grants = useRoleGrantOptions(userId, enabled);
  const { user: actor } = useTenantAuth();

  const canReadScopeOptions =
    isTenantOwnerActor ||
    (["roles.role.read", "org.branch.read", "org.company.read"] as const).every(
      (permission) => can(actor, permission),
    );
  const scopeOptionsEnabled = enabled && isTenantOwnerActor && canReadScopeOptions;
  const roles = useRoleOptions(scopeOptionsEnabled, true);
  const branches = useOrgNodeOptions("branches", { enabled: scopeOptionsEnabled });
  const companies = useOrgNodeOptions("companies", { enabled: scopeOptionsEnabled });

  const scopeOptionsReady =
    isOptionSourceReady(grants) &&
    isOptionSourceReady(roles) &&
    isOptionSourceReady(branches) &&
    isOptionSourceReady(companies);

  const unresolvedName = grants.isLoading
    ? copy.picker.loading
    : copy.grants.nameUnavailable;

  const roleLabel = useCallback(
    (id: string) =>
      grants.labelFor("role", id) ?? roles.labelFor(id) ?? unresolvedName,
    [grants, roles, unresolvedName],
  );

  const branchLabel = useCallback(
    (id: string | null | undefined) =>
      id
        ? (grants.labelFor("branch", id) ?? branches.labelFor(id) ?? unresolvedName)
        : "",
    [branches, grants, unresolvedName],
  );

  const companyLabel = useCallback(
    (id: string | null | undefined) =>
      id
        ? (grants.labelFor("company", id) ?? companies.labelFor(id) ?? unresolvedName)
        : "",
    [companies, grants, unresolvedName],
  );

  const targetLabel = useCallback(
    (assignment: ScopeRoleAssignment) =>
      branchLabel(assignment.branchId) ||
      companyLabel(assignment.companyId) ||
      copy.grants.wholeTenant,
    [branchLabel, companyLabel, copy.grants.wholeTenant],
  );

  const describeScope = useCallback(
    (assignment: ScopeRoleAssignmentInput) => ({
      label: roleLabel(assignment.roleId),
      hint: `${copy.scopeTarget[assignment.scopeTarget]} · ${
        branchLabel(assignment.branchId) ||
        companyLabel(assignment.companyId) ||
        copy.grants.wholeTenant
      }`,
    }),
    [branchLabel, companyLabel, copy.grants.wholeTenant, copy.scopeTarget, roleLabel],
  );

  const retryScopeOptions = useCallback(() => {
    roles.retry?.();
    branches.retry?.();
    companies.retry?.();
    grants.retry();
  }, [branches, companies, grants, roles]);

  const hasScopeOptionsError = Boolean(
    roles.error || branches.error || companies.error || grants.error,
  );
  const writeText = describeError(panel.writeError);
  const grantOptionsText = describeError(grants.error);
  const scopeOptionsText = describeError(
    roles.error ?? branches.error ?? companies.error ?? grants.error,
  );
  const hasOpenModal =
    panel.branchDraft !== null ||
    panel.draft !== null ||
    panel.isReviewingBranch ||
    panel.isReviewing;

  return {
    t,
    copy,
    panel,
    grants,
    roles,
    branches,
    companies,
    canReadScopeOptions,
    scopeOptionsReady,
    hasScopeOptionsError,
    retryScopeOptions,
    roleLabel,
    branchLabel,
    targetLabel,
    describeScope,
    writeText,
    grantOptionsText,
    scopeOptionsText,
    hasOpenModal,
  };
}
