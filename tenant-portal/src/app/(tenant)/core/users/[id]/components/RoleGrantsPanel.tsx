"use client";

import { DetailSection, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type {
  ScopeRoleAssignment,
  ScopeRoleAssignmentInput,
} from "../../../contracts/role-assignment-contract";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import { useOrgNodeOptions, useRoleOptions } from "../../../hooks/useCoreOptions";
import { useUserRoleGrants } from "../hooks/useUserRoleGrants";
import { BranchRolesSection } from "./BranchRolesSection";
import { ScopeRolesSection } from "./ScopeRolesSection";

interface RoleGrantsPanelProps {
  userId: string;
  canAssignRoles: boolean;
  isTenantOwnerActor: boolean;
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
}: RoleGrantsPanelProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const describeError = useCoreErrorText();
  const panel = useUserRoleGrants(userId, canAssignRoles);
  const roles = useRoleOptions(canAssignRoles);
  const branches = useOrgNodeOptions("branches", { enabled: canAssignRoles });
  const companies = useOrgNodeOptions("companies", { enabled: canAssignRoles });

  const roleLabel = (id: string) => roles.labelFor(id) ?? id;
  const branchLabel = (id: string | null | undefined) => (id ? (branches.labelFor(id) ?? id) : "");
  const companyLabel = (id: string | null | undefined) =>
    id ? (companies.labelFor(id) ?? id) : "";

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
            roles={roles}
            branches={branches}
            roleLabel={roleLabel}
            branchLabel={branchLabel}
          />

          <ScopeRolesSection
            panel={panel}
            roles={roles}
            companies={companies}
            branches={branches}
            isTenantOwnerActor={isTenantOwnerActor}
            describe={describeScope}
            targetLabel={targetLabel}
          />

          <p className="rounded-sm border border-border bg-muted p-2.5 text-2xs text-muted-foreground">
            {copy.grants.unionNote}
          </p>
        </div>
      </DetailSection>
    </PermissionGate>
  );
}
