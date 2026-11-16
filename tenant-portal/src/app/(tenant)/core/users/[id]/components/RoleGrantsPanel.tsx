"use client";

import { Button, DetailSection, PermissionGate } from "@/design-system";
import { useRoleGrantsPanel } from "../hooks/useRoleGrantsPanel";
import { BranchRolesSection } from "./BranchRolesSection";
import { ScopeRolesSection } from "./ScopeRolesSection";

interface RoleGrantsPanelProps {
  userId: string;
  canAssignRoles: boolean;
  isTenantOwnerActor: boolean;
  protectedTargetReason?: string;
}

/**
 * Both grant models (`tenant_user_branch_roles` and owner-only
 * `tenant_user_scope_roles`) rendered as sibling summary sections with centered
 * modal editors, preserving the backend's union semantics.
 */
export function RoleGrantsPanel({
  userId,
  canAssignRoles,
  isTenantOwnerActor,
  protectedTargetReason,
}: RoleGrantsPanelProps) {
  const state = useRoleGrantsPanel({
    userId,
    canAssignRoles,
    isTenantOwnerActor,
    protectedTargetReason,
  });
  const { t, copy, panel } = state;

  if (protectedTargetReason) {
    return (
      <PermissionGate require="users.user.assign_roles">
        <DetailSection title={copy.grants.title} columns={1}>
          <p className="text-xs text-muted-foreground">{protectedTargetReason}</p>
        </DetailSection>
      </PermissionGate>
    );
  }

  return (
    <PermissionGate
      require="users.user.assign_roles"
      denied={
        panel.branchError?.status === 403 ||
        state.grants.error?.status === 403 ||
        (isTenantOwnerActor && panel.scopeError?.status === 403)
      }
    >
      <DetailSection
        title={copy.grants.title}
        description={copy.grants.description}
        columns={1}
      >
        <div className="flex flex-col gap-5">
          {state.writeText && !state.hasOpenModal ? (
            <p
              role="alert"
              className="rounded-sm border border-destructive/30 bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground"
            >
              {state.writeText}
            </p>
          ) : null}

          <BranchRolesSection
            panel={panel}
            grantOptions={state.grants}
            roleLabel={state.roleLabel}
            branchLabel={state.branchLabel}
            writeError={state.writeText}
            optionsErrorText={state.grantOptionsText}
          />

          {isTenantOwnerActor && !state.scopeOptionsReady ? (
            <p role="status" className="text-xs text-muted-foreground">
              {!state.canReadScopeOptions
                ? copy.grants.companionReadsRequired
                : state.hasScopeOptionsError
                  ? state.scopeOptionsText ?? copy.grants.optionsLoadFailed
                  : copy.picker.loading}
              {state.hasScopeOptionsError ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={state.retryScopeOptions}
                >
                  {t.common.retry}
                </Button>
              ) : null}
            </p>
          ) : null}
          <fieldset
            disabled={isTenantOwnerActor && !state.scopeOptionsReady}
            className="min-w-0"
          >
            <ScopeRolesSection
              panel={panel}
              roles={state.roles}
              companies={state.companies}
              branches={state.branches}
              isTenantOwnerActor={isTenantOwnerActor}
              describe={state.describeScope}
              targetLabel={state.targetLabel}
              writeError={state.writeText}
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
