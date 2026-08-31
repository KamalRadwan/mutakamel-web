"use client";

import Link from "next/link";
import { ShieldOff, Trash2, UserCheck } from "lucide-react";
import {
  Badge,
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  userDisplayName,
  type TenantUser,
  type UserStatus,
} from "../../contracts/user-contract";
import { allowedUserActions, type UserRowAction } from "../hooks/useTenantUsers";

/**
 * All four `UserStatusEnum` values get a tone, `DEACTIVATED` included.
 *
 * `INVITED` is neutral rather than a hue: it is a stage, not an outcome, and
 * docs/design/tokens.md#status-mapping keeps colour for outcomes only.
 */
const STATUS_TONE: Record<UserStatus, "positive" | "caution" | "negative" | "neutral"> = {
  ACTIVE: "positive",
  SUSPENDED: "caution",
  DEACTIVATED: "negative",
  INVITED: "neutral",
};

interface UserColumnOptions {
  actingUserId: string | null;
  canDeactivate: boolean;
  canDelete: boolean;
  onAction: (user: TenantUser, action: UserRowAction) => void;
}

export function useUserColumns({
  actingUserId,
  canDeactivate,
  canDelete,
  onAction,
}: UserColumnOptions): ColumnDef<TenantUser>[] {
  const { t } = useI18n();
  const copy = t.coreIdentity;

  const columns: ColumnDef<TenantUser>[] = [
    {
      id: "name",
      header: copy.users.name,
      cell: (user) => (
        <div className="flex flex-col">
          <Link
            href={`${TENANT_ROUTES.coreUsers}/${user.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {userDisplayName(user)}
          </Link>
          <span dir="ltr" className="text-2xs text-muted-foreground">
            {user.email}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: copy.fields.status,
      cell: (user) => (
        <div className="flex items-center gap-1.5">
          <Badge tone={STATUS_TONE[user.status]}>{copy.userStatus[user.status]}</Badge>
          {user.isTenantOwner ? <Badge tone="brand">{copy.users.owner}</Badge> : null}
        </div>
      ),
    },
    {
      id: "jobTitle",
      header: copy.users.jobTitle,
      cell: (user) => user.jobTitle ?? t.detail.notRecorded,
    },
    {
      id: "employeeCode",
      header: copy.users.employeeCode,
      cell: (user) => <span className="font-mono text-2xs">{user.employeeCode ?? ""}</span>,
    },
  ];

  if (!canDeactivate && !canDelete) return columns;

  return [
    ...columns,
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (user) => {
        const allowed = allowedUserActions(user, actingUserId);
        // The owner and self guards run server-side before every one of the
        // three writes, so the row says why the controls are absent rather than
        // offering a button that is guaranteed to be refused.
        const guardReason = user.isTenantOwner
          ? copy.users.ownerProtected
          : user.id === actingUserId
            ? copy.users.selfProtected
            : null;

        return (
          <div className="flex items-center justify-end gap-1">
            {guardReason ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-2xs text-muted-foreground">{copy.users.protected}</span>
                </TooltipTrigger>
                <TooltipContent>{guardReason}</TooltipContent>
              </Tooltip>
            ) : null}
            {canDeactivate && allowed.suspend ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction(user, "suspend")}
                aria-label={`${copy.users.suspend}: ${userDisplayName(user)}`}
              >
                <ShieldOff className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
            {canDeactivate && allowed.activate ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction(user, "activate")}
                aria-label={`${copy.users.activate}: ${userDisplayName(user)}`}
              >
                <UserCheck className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
            {canDelete && allowed.delete ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction(user, "delete")}
                aria-label={`${t.common.delete}: ${userDisplayName(user)}`}
              >
                <Trash2 className="size-4 text-destructive" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];
}
