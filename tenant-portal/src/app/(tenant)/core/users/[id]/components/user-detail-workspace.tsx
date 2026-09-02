"use client";

import { Pencil, ShieldOff, Trash2, UserCheck } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  DetailHeader,
  DetailSection,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { userDisplayName, type UserStatus } from "../../../contracts/user-contract";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import { useTenantUserDetail } from "../hooks/useTenantUserDetail";
import { UserFormDrawer, type UserFormValues } from "../../components/UserFormDrawer";
import { ModuleSeatsPanel } from "./ModuleSeatsPanel";
import { RoleGrantsPanel } from "./RoleGrantsPanel";
import { TeamMembershipsPanel } from "./TeamMembershipsPanel";

const STATUS_TONE: Record<UserStatus, "positive" | "caution" | "negative" | "neutral"> = {
  ACTIVE: "positive",
  SUSPENDED: "caution",
  DEACTIVATED: "negative",
  INVITED: "neutral",
};

export function UserDetailWorkspace({ id }: { id: string }) {
  const screen = useTenantUserDetail(id);
  const { t, lang, user } = screen;
  const copy = t.coreIdentity;
  const describeError = useCoreErrorText();
  const actionText = describeError(screen.actionError);
  const pendingCopy = screen.pendingAction ? copy.users.confirm[screen.pendingAction] : null;

  if (screen.isMissing || screen.loadError || screen.isLoading || !user) {
    return (
      <PermissionGate require="users.user.read">
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
    <PermissionGate require="users.user.read">
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
          status={
            <span className="flex items-center gap-1.5">
              <Badge tone={STATUS_TONE[user.status]}>{copy.userStatus[user.status]}</Badge>
              {user.isTenantOwner ? <Badge tone="brand">{copy.users.owner}</Badge> : null}
              {user.status === "INVITED" ? (
                <Badge tone="neutral">{copy.users.invitePending}</Badge>
              ) : null}
            </span>
          }
          secondaryActions={
            <>
              {screen.canUpdate ? (
                <Button variant="outline" onClick={screen.openEdit}>
                  <Pencil className="size-4" aria-hidden="true" />
                  {copy.actions.edit}
                </Button>
              ) : null}
              {screen.canDeactivate && screen.allowedActions.suspend ? (
                <Button variant="outline" onClick={() => screen.requestAction("suspend")}>
                  <ShieldOff className="size-4" aria-hidden="true" />
                  {copy.users.suspend}
                </Button>
              ) : null}
              {screen.canDeactivate && screen.allowedActions.activate ? (
                <Button variant="outline" onClick={() => screen.requestAction("activate")}>
                  <UserCheck className="size-4" aria-hidden="true" />
                  {copy.users.activate}
                </Button>
              ) : null}
              {screen.canDelete && screen.allowedActions.delete ? (
                <Button variant="outline" onClick={() => screen.requestAction("delete")}>
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                  {user.status === "INVITED" ? copy.users.revokeInvite : t.common.delete}
                </Button>
              ) : null}
            </>
          }
        />

        <UserFormDrawer
          key={screen.isEditOpen ? "edit-open" : "edit-closed"}
          mode="edit"
          isOpen={screen.isEditOpen}
          initial={{
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            companyId: user.companyId,
            branchId: user.branchId,
            departmentId: user.departmentId,
            teamId: user.teamId ?? "",
            managerId: user.managerId ?? "",
            employeeCode: user.employeeCode ?? "",
            jobTitle: user.jobTitle ?? "",
          }}
          onClose={screen.closeEdit}
          onSubmit={(values) => screen.saveEdits(toUpdateInput(values))}
          isSubmitting={screen.isSubmitting}
          error={screen.isEditOpen ? actionText : undefined}
        />

        {actionText ? (
          <p
            role="alert"
            className="rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
          >
            {actionText}
          </p>
        ) : null}

        {user.status === "INVITED" ? (
          // There is no resend-invite route on this controller — the invite mail
          // is sent once by POST /users. Saying so is the honest surface; a
          // resend button would be a control with nothing behind it.
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
            { label: copy.users.employeeCode, value: user.employeeCode },
            { label: copy.users.jobTitle, value: user.jobTitle },
            { label: copy.fields.status, value: copy.userStatus[user.status] },
          ]}
        />

        <DetailSection
          title={copy.detail.placement}
          description={copy.detail.placementDescription}
          emptyValueLabel={t.detail.notRecorded}
          fields={[
            { label: copy.levels.companies.parentLabel, value: idValue(user.companyId) },
            { label: copy.levels.branches.parentLabel, value: idValue(user.branchId) },
            { label: copy.levels.departments.parentLabel, value: idValue(user.departmentId) },
            { label: copy.levels.teams.parentLabel, value: idValue(user.teamId) },
            { label: copy.users.manager, value: idValue(user.managerId) },
            { label: copy.detail.createdAt, value: formatDateTime(user.createdAt, lang) },
            { label: copy.detail.updatedAt, value: formatDateTime(user.updatedAt, lang) },
          ]}
        />

        <TeamMembershipsPanel
          userId={user.id}
          canManage={screen.canManageMemberships}
          homeTeamId={user.teamId}
        />

        <ModuleSeatsPanel userId={user.id} canManage={screen.canUpdate} />

        {screen.canAssignRoles ? (
          <RoleGrantsPanel
            userId={user.id}
            canAssignRoles={screen.canAssignRoles}
            isTenantOwnerActor={screen.isTenantOwnerActor}
          />
        ) : null}

        <ConfirmActionModal
          open={screen.pendingAction !== null}
          onOpenChange={(open) => {
            if (!open) screen.cancelAction();
          }}
          title={pendingCopy?.title ?? ""}
          description={formatTemplate(pendingCopy?.description ?? "", {
            name: userDisplayName(user),
          })}
          confirmLabel={pendingCopy?.confirm ?? t.common.confirmDelete}
          cancelLabel={t.common.cancel}
          onConfirm={() => void screen.confirmAction()}
          loading={screen.isSubmitting}
        />
      </div>
    </PermissionGate>
  );
}

/**
 * `UpdateTenantUserDto` — no `email`, and an emptied optional is sent as an
 * empty string rather than omitted, so clearing a job title actually clears it.
 */
function toUpdateInput(values: UserFormValues) {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    companyId: values.companyId,
    branchId: values.branchId,
    departmentId: values.departmentId,
    ...(values.teamId ? { teamId: values.teamId } : {}),
    ...(values.managerId ? { managerId: values.managerId } : {}),
    employeeCode: values.employeeCode,
    jobTitle: values.jobTitle,
  };
}

/** The user routes return placement as ids; no joined name is on the response. */
function idValue(value: string | null): React.ReactNode {
  return value ? <IdentifierText className="text-2xs">{value}</IdentifierText> : null;
}
