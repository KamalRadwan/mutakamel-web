"use client";

import Link from "next/link";
import {
  Button,
  ConfirmActionModal,
  DetailHeader,
  DetailSection,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  Skeleton,
  TooltipProvider,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { userDisplayName } from "../../../contracts/user-contract";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import { UserFormDrawer } from "../../components/UserFormDrawer";
import { toUpdateInput, userToFormValues } from "../../user-payloads";
import { useTenantUserDetail } from "../hooks/useTenantUserDetail";
import { useUserPlacementNames } from "../hooks/useUserPlacementNames";
import { ModuleSeatsPanel } from "./ModuleSeatsPanel";
import { RoleGrantsPanel } from "./RoleGrantsPanel";
import { TeamMembershipsPanel } from "./TeamMembershipsPanel";
import {
  UserDetailSecondaryActions,
  UserDetailStatusBadges,
} from "./UserDetailHeaderActions";

export function UserDetailWorkspace({ id }: { id: string }) {
  const screen = useTenantUserDetail(id);
  const { t, lang, user } = screen;
  const copy = t.coreIdentity;
  const describeError = useCoreErrorText();
  const actionText = describeError(screen.actionError);
  const placement = useUserPlacementNames(user);
  const pendingCopy = screen.pendingAction
    ? copy.users.confirm[screen.pendingAction]
    : null;
  const isDenied = screen.loadError?.status === 403;

  if (screen.isMissing || screen.loadError || screen.isLoading || !user) {
    return (
      <PermissionGate require="users.user.read" denied={isDenied}>
        {screen.isMissing ? (
          <NotFoundState
            title={copy.users.notFoundTitle}
            description={copy.users.notFoundDescription}
            backLabel={copy.users.backToList}
            backHref={TENANT_ROUTES.coreUsers}
          />
        ) : screen.loadError ? (
          <ErrorState
            title={copy.users.loadFailed}
            description={describeError(screen.loadError)}
            onRetry={screen.reload}
            retryLabel={t.common.retry}
          />
        ) : (
          <div className="flex flex-col gap-3" role="status" aria-busy="true">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
      </PermissionGate>
    );
  }

  return (
    <PermissionGate require="users.user.read" denied={isDenied}>
      <TooltipProvider>
        <div className="flex flex-col gap-4">
          <DetailHeader
            title={userDisplayName(user)}
            subtitle={user.email}
            backLabel={copy.users.backToList}
            backHref={TENANT_ROUTES.coreUsers}
            breadcrumbs={[
              { label: copy.users.title, href: TENANT_ROUTES.coreUsers },
              { label: userDisplayName(user) },
            ]}
            status={<UserDetailStatusBadges user={user} copy={copy} />}
            secondaryActions={
              <UserDetailSecondaryActions
                id={id}
                user={user}
                t={t}
                canReadAddonAssignments={screen.canReadAddonAssignments}
                canUpdateInBranch={screen.canUpdateInBranch}
                isProtectedTarget={screen.isProtectedTarget}
                allowedActions={screen.allowedActions}
                onEdit={screen.openEdit}
                onRequestAction={screen.requestAction}
              />
            }
          />

          {screen.protectedTargetReason ? (
            <p id="user-management-protection" className="text-xs text-muted-foreground">
              {screen.protectedTargetReason}
            </p>
          ) : null}
          {screen.isSelfTarget ? (
            <Button size="sm" variant="outline" className="self-start" asChild>
              <Link href={TENANT_ROUTES.coreProfile}>{copy.users.editMyName}</Link>
            </Button>
          ) : null}

          {screen.inviteQueued ? (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-warning/30 bg-warning-subtle p-2.5 text-xs text-warning-subtle-foreground"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{copy.users.inviteQueued}</span>
                <span>{copy.users.inviteQueuedDescription}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={screen.dismissInviteQueued}
              >
                {t.common.dismiss}
              </Button>
            </div>
          ) : null}

          {screen.isEditOpen ? (
            <UserFormDrawer
              mode="edit"
              isOpen={screen.isEditOpen}
              initial={userToFormValues(user)}
              onClose={screen.closeEdit}
              onSubmit={(values) => screen.saveEdits(toUpdateInput(user, values))}
              isSubmitting={screen.isSubmitting}
              error={actionText}
            />
          ) : null}

          {actionText && !screen.isEditOpen && screen.pendingAction === null ? (
            <p
              role="alert"
              className="rounded-sm border border-destructive/30 bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground"
            >
              {actionText}
            </p>
          ) : null}

          {user.status === "INVITED" ? (
            <p
              role="status"
              className="rounded-sm border border-border bg-muted p-2.5 text-xs text-muted-foreground"
            >
              {copy.users.inviteLifecycleNote}
            </p>
          ) : null}

          <DetailSection
            title={copy.detail.identity}
            emptyValueLabel={t.detail.notRecorded}
            fields={[
              { label: copy.users.firstName, value: user.firstName },
              { label: copy.users.lastName, value: user.lastName },
              { label: copy.users.email, value: <span dir="ltr">{user.email}</span> },
              {
                label: copy.users.employeeCode,
                value: user.employeeCode ? (
                  <IdentifierText>{user.employeeCode}</IdentifierText>
                ) : null,
              },
              { label: copy.users.jobTitle, value: user.jobTitle },
              { label: copy.fields.status, value: copy.userStatus[user.status] },
            ]}
          />

          <DetailSection
            title={copy.detail.placement}
            description={copy.detail.placementDescription}
            emptyValueLabel={t.detail.notRecorded}
            fields={[
              { label: copy.levels.companies.parentLabel, value: placement.companyLabel },
              { label: copy.levels.branches.parentLabel, value: placement.branchLabel },
              {
                label: copy.levels.departments.parentLabel,
                value: placement.departmentLabel,
              },
              { label: copy.levels.teams.parentLabel, value: placement.teamLabel },
              {
                label: copy.users.manager,
                value:
                  user.managerId && placement.managerResolved ? (
                    <Link
                      href={`${TENANT_ROUTES.coreUsers}/${user.managerId}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {placement.managerLabel}
                    </Link>
                  ) : (
                    placement.managerLabel
                  ),
              },
              { label: copy.detail.createdAt, value: formatDateTime(user.createdAt, lang) },
              { label: copy.detail.updatedAt, value: formatDateTime(user.updatedAt, lang) },
            ]}
          />

          <TeamMembershipsPanel
            userId={user.id}
            canManage={screen.canManageMemberships}
            protectedTargetReason={screen.protectedTargetReason}
            homeTeamId={user.teamId}
          />

          <ModuleSeatsPanel userId={user.id} canManage={screen.canManageModules} />

          {screen.canAssignRoles ? (
            <RoleGrantsPanel
              userId={user.id}
              canAssignRoles={screen.canAssignRoles}
              isTenantOwnerActor={screen.isTenantOwnerActor}
              protectedTargetReason={screen.protectedTargetReason}
            />
          ) : null}

          <ConfirmActionModal
            open={screen.pendingAction !== null}
            onOpenChange={(open) => {
              if (!open) screen.cancelAction();
            }}
            title={pendingCopy?.title ?? ""}
            description={
              pendingCopy
                ? [
                    formatTemplate(pendingCopy.description, {
                      name: userDisplayName(user),
                    }),
                    actionText,
                  ]
                    .filter(Boolean)
                    .join("\n\n")
                : ""
            }
            confirmLabel={
              screen.pendingAction === "suspend" && user.status === "INVITED"
                ? copy.users.revokeInvite
                : (pendingCopy?.confirm ?? t.common.confirmDelete)
            }
            cancelLabel={t.common.cancel}
            onConfirm={() => void screen.confirmAction()}
            loading={screen.isSubmitting}
          />
        </div>
      </TooltipProvider>
    </PermissionGate>
  );
}
