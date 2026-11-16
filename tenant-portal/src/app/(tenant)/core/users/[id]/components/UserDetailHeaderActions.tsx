"use client";

import Link from "next/link";
import { LogOut, Pencil, Send, ShieldOff, Trash2, UserCheck } from "lucide-react";
import { Badge, Button } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { TenantUser } from "../../../contracts/user-contract";
import { USER_STATUS_TONE } from "../../components/useUserColumns";
import type { AllowedUserActions, UserRowAction } from "../../user-permissions";

export function UserDetailStatusBadges({
  user,
  copy,
}: {
  user: TenantUser;
  copy: Dictionary["coreIdentity"];
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Badge tone={USER_STATUS_TONE[user.status]}>
        {copy.userStatus[user.status]}
      </Badge>
      {user.isTenantOwner ? (
        <Badge tone="brand">{copy.users.owner}</Badge>
      ) : null}
      {user.status === "INVITED" ? (
        <Badge tone="neutral">{copy.users.invitePending}</Badge>
      ) : null}
    </span>
  );
}

interface UserDetailSecondaryActionsProps {
  id: string;
  user: TenantUser;
  t: Dictionary;
  canReadAddonAssignments: boolean;
  canUpdateInBranch: boolean;
  isProtectedTarget: boolean;
  allowedActions: AllowedUserActions;
  onEdit: () => void;
  onRequestAction: (action: UserRowAction) => void;
}

export function UserDetailSecondaryActions({
  id,
  user,
  t,
  canReadAddonAssignments,
  canUpdateInBranch,
  isProtectedTarget,
  allowedActions,
  onEdit,
  onRequestAction,
}: UserDetailSecondaryActionsProps) {
  const copy = t.coreIdentity;

  return (
    <>
      {canReadAddonAssignments ? (
        <Button size="sm" variant="outline" asChild>
          <Link href={`${TENANT_ROUTES.coreAddonSeats}/${id}`}>
            {t.addonAssignments.nav}
          </Link>
        </Button>
      ) : null}
      {canUpdateInBranch ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          disabled={isProtectedTarget || !allowedActions.edit}
          aria-describedby={
            isProtectedTarget ? "user-management-protection" : undefined
          }
        >
          <Pencil className="size-4" aria-hidden="true" />
          {copy.actions.edit}
        </Button>
      ) : null}
      {allowedActions.resendInvite ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRequestAction("resendInvite")}
        >
          <Send className="size-4" aria-hidden="true" />
          {copy.users.resendInvite}
        </Button>
      ) : null}
      {allowedActions.suspend ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRequestAction("suspend")}
        >
          <ShieldOff className="size-4" aria-hidden="true" />
          {user.status === "INVITED" ? copy.users.revokeInvite : copy.users.suspend}
        </Button>
      ) : null}
      {allowedActions.activate ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRequestAction("activate")}
        >
          <UserCheck className="size-4" aria-hidden="true" />
          {copy.users.activate}
        </Button>
      ) : null}
      {allowedActions.revokeSessions ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRequestAction("revokeSessions")}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {copy.users.revokeSessions}
        </Button>
      ) : null}
      {allowedActions.delete ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRequestAction("delete")}
        >
          <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          {copy.actions.delete}
        </Button>
      ) : null}
    </>
  );
}
