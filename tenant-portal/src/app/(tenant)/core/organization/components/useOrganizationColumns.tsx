"use client";

import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Badge, Button, IdentifierText, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { Company, OrgLevel, OrgNodeOf } from "../../contracts/organization-contract";
import type { OrgLookupResolver, ResolvedLookup } from "../hooks/useOrgLookupResolver";
import type { OrgLevelConfig } from "../level-config";
import { OrgLeadUserValue, OrgParentLookupValue } from "./OrganizationLookupValue";
import { ORGANIZATION_LEVEL_ICONS } from "../organization-icons";

interface OrganizationColumnOptions<L extends OrgLevel> {
  config: OrgLevelConfig;
  canManageRow: (node: OrgNodeOf<L>) => boolean;
  lookups: OrgLookupResolver;
  onQuickView: (node: OrgNodeOf<L>) => void;
  onEdit: (node: OrgNodeOf<L>) => void;
  onDelete: (node: OrgNodeOf<L>) => void;
}

function resolveCompanyViaBranch(
  branchId: string,
  lookups: OrgLookupResolver,
): ResolvedLookup<Company> {
  const branchLookup = lookups.branch(branchId);
  if (branchLookup.status === "loading") return { status: "loading", value: null };
  if (branchLookup.status !== "ready") return { status: branchLookup.status, value: null };
  return lookups.company(branchLookup.value.companyId);
}

/**
 * Builds the level-specific `DataTable` columns for Companies, Branches,
 * Departments, and Teams, resolving parent hierarchy and team-lead names only
 * when the signed-in user holds the corresponding read permissions.
 */
export function useOrganizationColumns<L extends OrgLevel>({
  config,
  canManageRow,
  lookups,
  onQuickView,
  onEdit,
  onDelete,
}: OrganizationColumnOptions<L>): ColumnDef<OrgNodeOf<L>>[] {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const levelCopy = copy.levels[config.level];
  const emptyDash = t.audit.valueEmpty;
  const LevelIcon = ORGANIZATION_LEVEL_ICONS[config.level];

  const columns: ColumnDef<OrgNodeOf<L>>[] = [
    {
      id: "name",
      sortable: true,
      header: levelCopy.nameLabel,
      cell: (node) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/5 text-primary">
            <LevelIcon className="size-4" aria-hidden="true" />
          </span>
          <Link
            href={`${config.href}/${node.id}`}
            className="truncate text-sm font-normal text-foreground hover:underline"
          >
            {node.name}
          </Link>
        </div>
      ),
    },
    {
      id: "code",
      sortable: true,
      header: copy.fields.code,
      cell: (node) => <IdentifierText className="text-xs">{node.code}</IdentifierText>,
    },
  ];

  if (config.level === "companies") {
    columns.push(
      {
        id: "legalName",
        header: copy.fields.legalName,
        cell: (node) => {
          const legalName = "legalName" in node ? node.legalName : null;
          return legalName ? (
            <span className="text-foreground">{legalName}</span>
          ) : (
            <span className="text-muted-foreground">{emptyDash}</span>
          );
        },
      },
      {
        id: "currencyCode",
        header: copy.fields.currencyCode,
        cell: (node) => {
          const currencyCode = "currencyCode" in node ? node.currencyCode : null;
          return currencyCode ? (
            <IdentifierText className="text-2xs">{currencyCode}</IdentifierText>
          ) : (
            <span className="text-muted-foreground">{emptyDash}</span>
          );
        },
      },
    );
  }

  if (config.level === "branches") {
    columns.push(
      {
        id: "companyId",
        header: copy.levels.companies.parentLabel,
        cell: (node) =>
          "companyId" in node ? (
            <OrgParentLookupValue
              lookup={lookups.company(node.companyId)}
              baseHref={TENANT_ROUTES.coreCompanies}
              showCode={false}
            />
          ) : null,
      },
      {
        id: "isHeadquarters",
        header: copy.fields.isHeadquarters,
        cell: (node) =>
          "isHeadquarters" in node && node.isHeadquarters ? (
            <Badge tone="brand">{copy.fields.headquarters}</Badge>
          ) : (
            <span className="text-muted-foreground">{emptyDash}</span>
          ),
      },
      {
        id: "address",
        header: copy.fields.address,
        cell: (node) => {
          const address = "address" in node ? node.address : null;
          return address ? (
            <span className="line-clamp-1 max-w-xs text-foreground">{address}</span>
          ) : (
            <span className="text-muted-foreground">{emptyDash}</span>
          );
        },
      },
    );
  }

  if (config.level === "departments") {
    columns.push(
      {
        id: "branchId",
        header: copy.levels.branches.parentLabel,
        cell: (node) =>
          "branchId" in node ? (
            <OrgParentLookupValue
              lookup={lookups.branch(node.branchId)}
              baseHref={TENANT_ROUTES.coreBranches}
              showCode={false}
            />
          ) : null,
      },
      {
        id: "companyId",
        header: copy.levels.companies.parentLabel,
        cell: (node) =>
          "branchId" in node ? (
            <OrgParentLookupValue
              lookup={resolveCompanyViaBranch(node.branchId, lookups)}
              baseHref={TENANT_ROUTES.coreCompanies}
              showCode={false}
            />
          ) : null,
      },
    );
  }

  if (config.level === "teams") {
    columns.push(
      {
        id: "departmentId",
        header: copy.levels.departments.parentLabel,
        cell: (node) =>
          "departmentId" in node ? (
            <OrgParentLookupValue
              lookup={lookups.department(node.departmentId)}
              baseHref={TENANT_ROUTES.coreDepartments}
              showCode={false}
            />
          ) : null,
      },
      {
        id: "branchId",
        header: copy.levels.branches.parentLabel,
        cell: (node) => {
          if (!("departmentId" in node)) return null;
          const dept = lookups.department(node.departmentId);
          const branchLookup =
            dept.status === "ready"
              ? lookups.branch(dept.value.branchId)
              : dept.status === "loading"
                ? ({ status: "loading", value: null } as const)
                : ({ status: dept.status, value: null } as const);
          return (
            <OrgParentLookupValue
              lookup={branchLookup}
              baseHref={TENANT_ROUTES.coreBranches}
              showCode={false}
            />
          );
        },
      },
      {
        id: "leadUserId",
        header: copy.fields.leadUser,
        cell: (node) =>
          "leadUserId" in node ? (
            <OrgLeadUserValue
              leadUserId={node.leadUserId}
              lookup={lookups.user(node.leadUserId)}
              emptyLabel={emptyDash}
            />
          ) : null,
      },
    );
  }

  columns.push({
    id: "status",
    header: copy.fields.status,
    cell: (node) => (
      <Badge tone={node.status === "ACTIVE" ? "positive" : "neutral"}>
        {copy.orgStatus[node.status]}
      </Badge>
    ),
  });

  columns.push({
    id: "actions",
    header: t.common.actions,
    align: "end",
    sticky: "end",
    cell: (node) => {
      const canManage = canManageRow(node);
      return (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onQuickView(node)}
            aria-label={`${copy.actions.view}: ${node.name}`}
          >
            <Eye className="size-4" aria-hidden="true" />
          </Button>
          {canManage ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(node)}
                aria-label={`${copy.actions.edit}: ${node.name}`}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(node)}
                aria-label={`${copy.actions.delete}: ${node.name}`}
              >
                <Trash2 className="size-4 text-destructive" aria-hidden="true" />
              </Button>
            </>
          ) : null}
        </div>
      );
    },
  });

  return columns;
}
