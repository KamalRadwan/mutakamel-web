"use client";

import { Button, DetailSection, PermissionGate } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import type {
  ScopeRoleAssignment,
  ScopeRoleAssignmentInput,
} from "../../../contracts/role-assignment-contract";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import { useOrgNodeOptions, useRoleOptions } from "../../../hooks/useCoreOptions";
import { useRoleGrantOptions } from "../../../hooks/useRoleGrantOptions";
import { useUserRoleGrants } from "../hooks/useUserRoleGrants";
import { BranchRolesSection } from "./BranchRolesSection";
import { ScopeRolesSection } from "./ScopeRolesSection";

interface RoleGrantsPanelProps {
  userId: string;
  canAssignRoles: boolean;
  isTenantOwnerActor: boolean;
  protectedTargetReason?: string;
}

/**
 * Both grant models, side by side and never nested.
 *
 * The layout is deliberate: two sibling sections with one closing line saying
 * the effective permissions are their **union**. Rendering scoped roles as a
 * sub-section of branch roles, or vice versa, would imply a precedence the
 * backend does not have.
 */
export function RoleGrantsPanel({
  userId,
  canAssignRoles,
  isTenantOwnerActor,
  protectedTargetReason,
}: RoleGrantsPanelProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const describeError = useCoreErrorText();
  const enabled = canAssignRoles && !protectedTargetReason;
  const panel = useUserRoleGrants(userId, enabled, isTenantOwnerActor);
  const grants = useRoleGrantOptions(userId, enabled);
  const { user: actor } = useTenantAuth();
  const canReadScopeOptions = isTenantOwnerActor || ["roles.role.read", "org.branch.read", "org.company.read"]
    .every((permission) => actor?.permissions.includes(permission));
  const scopeOptionsEnabled = enabled && isTenantOwnerActor && canReadScopeOptions;
  const roles = useRoleOptions(scopeOptionsEnabled, true);
  const branches = useOrgNodeOptions("branches", { enabled: scopeOptionsEnabled });
  const companies = useOrgNodeOptions("companies", { enabled: scopeOptionsEnabled });
  const scopeOptionsReady = grants.isReady && roles.isReady && branches.isReady && companies.isReady;

  if (protectedTargetReason) {
    return (
      <PermissionGate require="users.user.assign_roles">
        <DetailSection title={copy.grants.title} columns={1}>
          <p className="text-xs text-muted-foreground">{protectedTargetReason}</p>
        </DetailSection>
      </PermissionGate>
    );
  }

  const unresolvedName = grants.isLoading ? copy.picker.loading : copy.grants.nameUnavailable;
  const roleLabel = (id: string) => grants.labelFor("role", id) ?? roles.labelFor(id) ?? unresolvedName;
  const branchLabel = (id: string | null | undefined) => (id ? (grants.labelFor("branch", id) ?? branches.labelFor(id) ?? unresolvedName) : "");
  const companyLabel = (id: string | null | undefined) =>
    id ? (grants.labelFor("company", id) ?? companies.labelFor(id) ?? unresolvedName) : "";

  const targetLabel = (assignment: ScopeRoleAssignment) =>
    branchLabel(assignment.branchId) ||
    companyLabel(assignment.companyId) ||
    copy.grants.wholeTenant;

  const describeScope = (assignment: ScopeRoleAssignmentInput) => ({
    label: roleLabel(assignment.roleId),
    hint: `${copy.scopeTarget[assignment.scopeTarget]} · ${
      branchLabel(assignment.branchId) ||
      companyLabel(assignment.companyId) ||
      copy.grants.wholeTenant
    }`,
  });

  const writeText = describeError(panel.writeError);

  return (
    <PermissionGate require="users.user.assign_roles">
      <DetailSection title={copy.grants.title} description={copy.grants.description} columns={1}>
        <div className="flex flex-col gap-5">
          {writeText ? (
            <p
              role="alert"
              className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
            >
              {writeText}
            </p>
          ) : null}

          <BranchRolesSection
            panel={panel}
            grantOptions={grants}
            roleLabel={roleLabel}
            branchLabel={branchLabel}
          />

          {isTenantOwnerActor && !scopeOptionsReady ? (
            <p role="status" className="text-xs text-muted-foreground">
              {!canReadScopeOptions ? copy.grants.companionReadsRequired :
                roles.error || branches.error || companies.error || grants.error
                  ? copy.grants.optionsLoadFailed : copy.picker.loading}
              {roles.error || branches.error || companies.error || grants.error ? (
                <Button variant="ghost" size="sm" onClick={() => {
                  roles.retry?.(); branches.retry?.(); companies.retry?.(); grants.retry();
                }}>{t.common.retry}</Button>
              ) : null}
            </p>
          ) : null}
          <fieldset disabled={isTenantOwnerActor && !scopeOptionsReady} className="min-w-0">
            <ScopeRolesSection
              panel={panel}
              roles={roles}
              companies={companies}
              branches={branches}
              isTenantOwnerActor={isTenantOwnerActor}
              describe={describeScope}
              targetLabel={targetLabel}
            />
          </fieldset>

          <p className="rounded-sm border border-border bg-muted p-2.5 text-2xs text-muted-foreground">
            {copy.grants.unionNote}
          </p>
        </div>
      </DetailSection>
    </PermissionGate>
  );
}
