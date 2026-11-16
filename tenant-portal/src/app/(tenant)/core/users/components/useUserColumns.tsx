import Link from "next/link";
import { useMemo } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IdentifierText,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type BadgeProps,
  type ColumnDef,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  userDisplayName,
  type TenantUser,
  type UserStatus,
} from "../../contracts/user-contract";
import type { ResolvedUserPlacement } from "../hooks/useUsersWorkplaceLookups";
import type { AllowedUserActions, UserRowAction } from "../user-permissions";

export const USER_STATUS_TONE: Record<
  UserStatus,
  NonNullable<BadgeProps["tone"]>
> = {
  ACTIVE: "positive",
  INVITED: "caution",
  SUSPENDED: "caution",
  DEACTIVATED: "neutral",
};

function userInitials(user: TenantUser): string {
  const first = user.firstName.trim().charAt(0);
  const last = user.lastName.trim().charAt(0);
  const combined = `${first}${last}`.toUpperCase();
  return combined || user.email.trim().charAt(0).toUpperCase();
}

interface UseUserColumnsOptions {
  t: Dictionary;
  resolveActions: (user: TenantUser) => AllowedUserActions;
  resolvePlacement: (user: TenantUser) => ResolvedUserPlacement;
  onEdit: (user: TenantUser) => void;
  onAction: (user: TenantUser, action: UserRowAction) => void;
}

export function useUserColumns({
  t,
  resolveActions,
  resolvePlacement,
  onEdit,
  onAction,
}: UseUserColumnsOptions): ColumnDef<TenantUser>[] {
  const copy = t.coreIdentity.users;
  const actionsCopy = t.coreIdentity.actions;

  return useMemo<ColumnDef<TenantUser>[]>(
    () => [
      {
        id: "firstName",
        sortable: true,
        header: copy.name,
        cell: (user) => {
          const displayName = userDisplayName(user);
          return (
            <div className="flex items-center gap-2.5">
              <Avatar className="size-7">
                <AvatarFallback>{userInitials(user)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`${TENANT_ROUTES.coreUsers}/${user.id}`}
                    className="truncate text-foreground hover:underline"
                  >
                    {displayName}
                  </Link>
                  {user.isTenantOwner ? (
                    <Badge tone="brand">{copy.owner}</Badge>
                  ) : null}
                </div>
                <span className="truncate text-2xs text-muted-foreground" dir="ltr">
                  {user.email}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "placement",
        header: t.coreIdentity.detail.placement,
        cell: (user) => {
          const placement = resolvePlacement(user);
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground">{placement.branchLabel}</span>
              <span className="text-2xs text-muted-foreground">
                {placement.teamLabel
                  ? `${placement.departmentLabel} · ${placement.teamLabel}`
                  : placement.departmentLabel}
              </span>
            </div>
          );
        },
      },
      {
        id: "jobTitle",
        header: copy.jobTitle,
        cell: (user) =>
          user.jobTitle ? (
            <span className="text-foreground">{user.jobTitle}</span>
          ) : (
            <span className="text-muted-foreground">{t.detail.notRecorded}</span>
          ),
      },
      {
        id: "employeeCode",
        sortable: true,
        header: copy.employeeCode,
        cell: (user) =>
          user.employeeCode ? (
            <IdentifierText>{user.employeeCode}</IdentifierText>
          ) : (
            <span className="text-muted-foreground">{t.detail.notRecorded}</span>
          ),
      },
      {
        id: "status",
        header: t.coreIdentity.fields.status,
        cell: (user) => (
          <Badge tone={USER_STATUS_TONE[user.status]}>
            {t.coreIdentity.userStatus[user.status]}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: t.common.actions,
        align: "end" as const,
        sticky: "end" as const,
        cell: (user: TenantUser) => {
          const allowed = resolveActions(user);
          const name = userDisplayName(user);
          const hasMenuItems =
            allowed.resendInvite ||
            allowed.suspend ||
            allowed.activate ||
            allowed.revokeSessions ||
            allowed.delete;
          const hasNonDeleteItems =
            allowed.resendInvite ||
            allowed.suspend ||
            allowed.activate ||
            allowed.revokeSessions;

          return (
            <div className="flex items-center justify-end gap-1">
              <Button asChild variant="ghost" size="sm">
                <Link
                  href={`${TENANT_ROUTES.coreUsers}/${user.id}`}
                  aria-label={`${actionsCopy.view}: ${name}`}
                >
                  {actionsCopy.view}
                </Link>
              </Button>
              {allowed.edit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(user)}
                  aria-label={`${actionsCopy.edit}: ${name}`}
                >
                  {actionsCopy.edit}
                </Button>
              ) : null}
              {allowed.reason ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className="cursor-default rounded-sm px-1.5 py-0.5 text-2xs text-muted-foreground"
                    >
                      {copy.protected}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{copy[allowed.reason]}</TooltipContent>
                </Tooltip>
              ) : null}
              {hasMenuItems ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`${t.common.actions}: ${name}`}
                    >
                      <MoreHorizontal className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {allowed.resendInvite ? (
                      <DropdownMenuItem
                        onSelect={() => onAction(user, "resendInvite")}
                      >
                        {copy.resendInvite}
                      </DropdownMenuItem>
                    ) : null}
                    {allowed.suspend ? (
                      <DropdownMenuItem
                        onSelect={() => onAction(user, "suspend")}
                      >
                        {user.status === "INVITED" ? copy.revokeInvite : copy.suspend}
                      </DropdownMenuItem>
                    ) : null}
                    {allowed.activate ? (
                      <DropdownMenuItem
                        onSelect={() => onAction(user, "activate")}
                      >
                        {copy.activate}
                      </DropdownMenuItem>
                    ) : null}
                    {allowed.revokeSessions ? (
                      <DropdownMenuItem
                        onSelect={() => onAction(user, "revokeSessions")}
                      >
                        {copy.revokeSessions}
                      </DropdownMenuItem>
                    ) : null}
                    {allowed.delete && hasNonDeleteItems ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    {allowed.delete ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onAction(user, "delete")}
                      >
                        {actionsCopy.delete}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        },
      },
    ],
    [actionsCopy, copy, onAction, onEdit, resolveActions, resolvePlacement, t],
  );
}
