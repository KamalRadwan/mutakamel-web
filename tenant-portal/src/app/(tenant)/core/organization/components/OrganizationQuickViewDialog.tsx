"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, ExternalLink, Layers, Pencil, Store, Users } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IdentifierText,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { OrgLevel, OrgNodeOf } from "../../contracts/organization-contract";
import { useCoreErrorText } from "../../hooks/useCoreErrorText";
import { useQuickViewNode, type QuickViewTarget } from "../hooks/useQuickViewNode";
import { OrgLeadUserValue, OrgParentLookupValue } from "./OrganizationLookupValue";

const LEVEL_ICONS = {
  companies: Building2,
  branches: Store,
  departments: Layers,
  teams: Users,
} as const;

interface OrganizationQuickViewDialogProps {
  target: QuickViewTarget | null;
  onClose: () => void;
  canManage?: boolean;
  onEdit?: (node: OrgNodeOf<OrgLevel>) => void;
}

export function OrganizationQuickViewDialog({
  target,
  onClose,
  canManage = false,
  onEdit,
}: OrganizationQuickViewDialogProps) {
  const { t, lang } = useI18n();
  const describeError = useCoreErrorText();
  const state = useQuickViewNode(target);

  if (!target) return null;

  const { config, isDetailForbidden, node, isLoading, loadError } = state;
  const copy = t.coreIdentity;
  const levelCopy = copy.levels[target.level];
  const Icon = LEVEL_ICONS[target.level];

  const displayId = node?.id ?? (target.kind === "summary" ? target.summary.id : target.node.id);
  const displayName =
    node?.name ?? (target.kind === "summary" ? target.summary.name : target.node.name);
  const displayCode =
    node?.code ?? (target.kind === "summary" ? target.summary.code : target.node.code);
  const displayStatus =
    node?.status ?? (target.kind === "summary" ? target.summary.status : target.node.status);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" closeLabel={t.common.close}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="truncate">{displayName}</DialogTitle>
                <Badge tone={displayStatus === "ACTIVE" ? "positive" : "neutral"}>
                  {copy.orgStatus[displayStatus]}
                </Badge>
                {node && "isHeadquarters" in node && node.isHeadquarters ? (
                  <Badge tone="brand">{copy.fields.headquarters}</Badge>
                ) : null}
              </div>
              <DialogDescription className="mt-1 flex items-center gap-2">
                <IdentifierText className="text-2xs">{displayCode}</IdentifierText>
                <span aria-hidden="true">·</span>
                <span>{levelCopy.singular}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="status" aria-busy="true">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : loadError ? (
            <p
              role="alert"
              className="rounded-sm border border-destructive/30 bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground"
            >
              {describeError(loadError)}
            </p>
          ) : null}

          {(node || target.kind === "summary") ? (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <QuickField label={levelCopy.nameLabel} value={displayName} />
              <QuickField
                label={copy.fields.code}
                value={<IdentifierText className="text-xs">{displayCode}</IdentifierText>}
              />

              {node &&
              target.level !== "companies" &&
              (state.effectiveCompanyId || target.level === "branches") ? (
                <QuickField
                  label={copy.levels.companies.parentLabel}
                  value={
                    <OrgParentLookupValue
                      lookup={state.companyLookup}
                      baseHref={TENANT_ROUTES.coreCompanies}
                      onNavigate={onClose}
                    />
                  }
                />
              ) : null}

              {node &&
              (target.level === "departments" || target.level === "teams") &&
              (state.effectiveBranchId || target.level === "departments") ? (
                <QuickField
                  label={copy.levels.branches.parentLabel}
                  value={
                    <OrgParentLookupValue
                      lookup={state.branchLookup}
                      baseHref={TENANT_ROUTES.coreBranches}
                      onNavigate={onClose}
                    />
                  }
                />
              ) : null}

              {target.level === "teams" && node && "departmentId" in node ? (
                <QuickField
                  label={copy.levels.departments.parentLabel}
                  value={
                    <OrgParentLookupValue
                      lookup={state.departmentLookup}
                      baseHref={TENANT_ROUTES.coreDepartments}
                      onNavigate={onClose}
                    />
                  }
                />
              ) : null}

              {node && "legalName" in node ? (
                <QuickField label={copy.fields.legalName} value={node.legalName || t.detail.notRecorded} />
              ) : null}
              {node && "taxNumber" in node ? (
                <QuickField
                  label={copy.fields.taxNumber}
                  value={node.taxNumber ? <IdentifierText className="text-xs">{node.taxNumber}</IdentifierText> : t.detail.notRecorded}
                />
              ) : null}
              {node && "currencyCode" in node ? (
                <QuickField
                  label={copy.fields.currencyCode}
                  value={node.currencyCode ? <IdentifierText className="text-xs">{node.currencyCode}</IdentifierText> : t.detail.notRecorded}
                />
              ) : null}
              {node && "isHeadquarters" in node ? (
                <QuickField label={copy.fields.isHeadquarters} value={node.isHeadquarters ? t.filters.yes : t.filters.no} />
              ) : null}
              {node && "phone" in node ? (
                <QuickField
                  label={copy.fields.phone}
                  value={node.phone ? <span dir="ltr" className="inline-block">{node.phone}</span> : t.detail.notRecorded}
                />
              ) : null}
              {node && "address" in node ? (
                <QuickField label={copy.fields.address} value={node.address || t.detail.notRecorded} wide />
              ) : null}
              {node && "leadUserId" in node ? (
                <QuickField
                  label={copy.fields.leadUser}
                  value={<OrgLeadUserValue leadUserId={node.leadUserId} lookup={state.leadLookup} showEmail />}
                />
              ) : null}
            </dl>
          ) : null}

          {isDetailForbidden ? (
            <PermissionGate require={config.readPermission} denied>
              {null}
            </PermissionGate>
          ) : null}

          {node ? (
            <dl className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
              <QuickField label={copy.detail.createdAt} value={formatDateTime(node.createdAt, lang)} />
              <QuickField label={copy.detail.updatedAt} value={formatDateTime(node.updatedAt, lang)} />
            </dl>
          ) : null}
        </div>

        <DialogFooter>
          {!isDetailForbidden && displayId ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`${config.href}/${displayId}`} onClick={onClose}>
                <ExternalLink className="size-3.5" aria-hidden="true" />
                {t.applicationAccess.viewDetails}
              </Link>
            </Button>
          ) : null}
          {canManage && onEdit && node ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(node);
              }}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              {copy.actions.edit}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={onClose}>
            {t.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickField({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-2xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xs text-foreground">{value}</dd>
    </div>
  );
}
