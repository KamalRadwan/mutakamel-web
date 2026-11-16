"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Eye, Lock, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  DateTime,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { TenantRole } from "../../contracts/role-contract";
import type { RoleBranchSummaryEntry } from "../hooks/useRoleBranchListController";

interface UseRoleColumnsOptions {
  canUpdate: boolean;
  canDelete: boolean;
  canAssignBranchPermissions: boolean;
  canViewBranchPermissions: boolean;
  roleBranchSummaries: Readonly<Record<string, RoleBranchSummaryEntry>>;
  onAssignPermissions: (role: TenantRole) => void;
  onInspectSystemRole: (role: TenantRole) => void;
  onEdit: (role: TenantRole) => void;
  onDelete: (role: TenantRole) => void;
}

export function useRoleColumns({
  canUpdate,
  canDelete,
  canAssignBranchPermissions,
  canViewBranchPermissions,
  roleBranchSummaries,
  onAssignPermissions,
  onInspectSystemRole,
  onEdit,
  onDelete,
}: UseRoleColumnsOptions): ColumnDef<TenantRole>[] {
  const { t, lang } = useI18n();
  const copy = t.coreIdentity.roles;
  const branchCopy = t.coreIdentity.roleBranch;
  const actionsCopy = t.coreIdentity.actions;

  return useMemo(
    () => [
      {
        id: "name",
        sortable: true,
        header: copy.name,
        cell: (role) => (
          <div className="flex min-w-0 items-center gap-2">
            {role.isSystem ? (
              <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            )}
            <Link
              href={`${TENANT_ROUTES.coreRoles}/${role.id}`}
              className="truncate text-foreground hover:underline"
            >
              {localizedValue(role.nameAr, role.nameEn, lang)}
            </Link>
          </div>
        ),
      },
      {
        id: "kind",
        header: copy.systemFilter,
        cell: (role) =>
          role.isSystem ? (
            <Badge tone="brand">{copy.systemRole}</Badge>
          ) : (
            <Badge tone="neutral">{copy.customOnly}</Badge>
          ),
      },
      {
        id: "scope",
        header: branchCopy.scopeColumn,
        cell: (role) => {
          if (role.isSystem) {
            return <span className="text-foreground">{branchCopy.scopeGlobal}</span>;
          }
          const summary = roleBranchSummaries[role.id];
          const mode = summary?.permissionMode ?? role.permissionMode;
          const count = summary?.branchCount ?? role.branchProfileCount;
          if (mode === "BRANCH") {
            if (count === 0) {
              return <span className="text-muted-foreground">{branchCopy.scopeNotConfigured}</span>;
            }
            if (count === 1) return <span className="text-foreground">{branchCopy.scopeOneBranch}</span>;
            if (count === 2) return <span className="text-foreground">{branchCopy.scopeTwoBranches}</span>;
            if (typeof count === "number") {
              return (
                <span className="text-foreground">
                  {formatTemplate(branchCopy.scopeBranchesCount, {
                    count: formatNumber(count, lang),
                  })}
                </span>
              );
            }
            return <span className="text-foreground">{branchCopy.scopeManagePerBranch}</span>;
          }
          if (mode === "GLOBAL") {
            return <span className="text-foreground">{branchCopy.scopeGlobal}</span>;
          }
          return <span className="text-muted-foreground">{t.detail.notRecorded}</span>;
        },
      },
      {
        id: "description",
        header: copy.description,
        cell: (role) => {
          const text = localizedValue(role.descriptionAr, role.descriptionEn, lang);
          return text ? (
            <span className="line-clamp-1 text-foreground">{text}</span>
          ) : (
            <span className="text-muted-foreground">{t.detail.notRecorded}</span>
          );
        },
      },
      {
        id: "createdAt",
        sortable: true,
        header: t.coreIdentity.detail.createdAt,
        cell: (role) => (
          <DateTime
            value={role.createdAt}
            precision="date"
            className="text-xs text-muted-foreground"
          />
        ),
      },
      {
        id: "actions",
        header: t.common.actions,
        align: "end",
        sticky: "end",
        cell: (role) => {
          const roleLabel = localizedValue(role.nameAr, role.nameEn, lang);
          if (role.isSystem) {
            return (
              <div className="flex items-center justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onInspectSystemRole(role)}
                      aria-label={`${branchCopy.viewOnlyAction}: ${roleLabel}`}
                    >
                      <Lock className="size-3.5" aria-hidden="true" />
                      {branchCopy.viewOnlyAction}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{copy.systemRoleReadOnly}</TooltipContent>
                </Tooltip>
              </div>
            );
          }

          return (
            <div className="flex items-center justify-end gap-1">
              {canAssignBranchPermissions || canViewBranchPermissions ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAssignPermissions(role)}
                >
                  {canAssignBranchPermissions ? branchCopy.assignAction : branchCopy.viewAction}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" asChild>
                <Link
                  href={`${TENANT_ROUTES.coreRoles}/${role.id}`}
                  aria-label={`${actionsCopy.view}: ${roleLabel}`}
                >
                  <Eye className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              {canUpdate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(role)}
                  aria-label={`${copy.rename}: ${roleLabel}`}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(role)}
                  aria-label={`${actionsCopy.delete}: ${roleLabel}`}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [
      actionsCopy,
      branchCopy,
      canAssignBranchPermissions,
      canDelete,
      canUpdate,
      canViewBranchPermissions,
      copy,
      lang,
      onAssignPermissions,
      onDelete,
      onEdit,
      onInspectSystemRole,
      roleBranchSummaries,
      t.common.actions,
      t.coreIdentity.detail.createdAt,
      t.detail.notRecorded,
    ],
  );
}
