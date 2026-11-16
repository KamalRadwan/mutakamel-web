"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DetailHeader,
  DetailSection,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { OrgLevel } from "../../contracts/organization-contract";
import { useCoreErrorText } from "../../hooks/useCoreErrorText";
import { useOrganizationNode } from "../hooks/useOrganizationNode";
import { OrgLeadUserValue, OrgParentLookupValue } from "./OrganizationLookupValue";

export function OrganizationNodeDetail<L extends OrgLevel>({
  level,
  id,
}: {
  level: L;
  id: string;
}) {
  const detail = useOrganizationNode(level, id);
  const { t, lang, config, node, isLoading, loadError, isMissing, reload, canReadApplicationAccess } =
    detail;
  const copy = t.coreIdentity;
  const levelCopy = copy.levels[level];
  const describeError = useCoreErrorText();

  return (
    <PermissionGate require={config.readPermission} denied={loadError?.status === 403}>
      <div className="flex flex-col gap-4">
        {isMissing ? (
          <NotFoundState
            title={levelCopy.notFoundTitle}
            description={levelCopy.notFoundDescription}
            backLabel={levelCopy.backToList}
            backHref={config.href}
          />
        ) : loadError ? (
          <ErrorState
            title={levelCopy.loadFailed}
            description={describeError(loadError)}
            onRetry={reload}
            retryLabel={t.common.retry}
          />
        ) : isLoading || !node ? (
          <div className="flex flex-col gap-3" role="status" aria-busy="true">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <DetailHeader
              title={node.name}
              subtitle={node.code}
              backLabel={levelCopy.backToList}
              backHref={config.href}
              breadcrumbs={[
                { label: copy.tree.title, href: TENANT_ROUTES.coreOrganization },
                { label: levelCopy.title, href: config.href },
                { label: node.name },
              ]}
              status={
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={node.status === "ACTIVE" ? "positive" : "neutral"}>
                    {copy.orgStatus[node.status]}
                  </Badge>
                  {"isHeadquarters" in node && node.isHeadquarters ? (
                    <Badge tone="brand">{copy.fields.headquarters}</Badge>
                  ) : null}
                </div>
              }
              secondaryActions={
                <Button variant="outline" size="sm" onClick={reload}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {copy.actions.refresh}
                </Button>
              }
            />

            <DetailSection
              title={copy.detail.identity}
              emptyValueLabel={t.detail.notRecorded}
              fields={[
                { label: levelCopy.nameLabel, value: node.name },
                { label: copy.fields.code, value: <IdentifierText>{node.code}</IdentifierText> },
                { label: copy.fields.status, value: copy.orgStatus[node.status] },
                ...("legalName" in node
                  ? [{ label: copy.fields.legalName, value: node.legalName }]
                  : []),
                ...("taxNumber" in node
                  ? [
                      {
                        label: copy.fields.taxNumber,
                        value: node.taxNumber ? (
                          <IdentifierText>{node.taxNumber}</IdentifierText>
                        ) : null,
                      },
                    ]
                  : []),
                ...("currencyCode" in node
                  ? [
                      {
                        label: copy.fields.currencyCode,
                        value: node.currencyCode ? (
                          <IdentifierText>{node.currencyCode}</IdentifierText>
                        ) : null,
                      },
                    ]
                  : []),
                ...("isHeadquarters" in node
                  ? [
                      {
                        label: copy.fields.isHeadquarters,
                        value: node.isHeadquarters ? t.filters.yes : t.filters.no,
                      },
                    ]
                  : []),
                ...("phone" in node
                  ? [
                      {
                        label: copy.fields.phone,
                        value: node.phone ? <span dir="ltr">{node.phone}</span> : null,
                      },
                    ]
                  : []),
                ...("address" in node
                  ? [{ label: copy.fields.address, value: node.address, wide: true }]
                  : []),
              ]}
            />

            <DetailSection
              title={copy.detail.placement}
              action={
                canReadApplicationAccess && (level === "companies" || level === "branches") ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/core/application-access/${level}/${id}`}>
                      {t.nav.coreApplicationAccess}
                    </Link>
                  </Button>
                ) : undefined
              }
              emptyValueLabel={t.detail.notRecorded}
              fields={[
                ...(level !== "companies" &&
                (detail.effectiveCompanyId || level === "branches")
                  ? [
                      {
                        label: copy.levels.companies.parentLabel,
                        value: (
                          <OrgParentLookupValue
                            lookup={detail.companyLookup}
                            baseHref={TENANT_ROUTES.coreCompanies}
                          />
                        ),
                      },
                    ]
                  : []),
                ...((level === "departments" || level === "teams") &&
                (detail.effectiveBranchId || level === "departments")
                  ? [
                      {
                        label: copy.levels.branches.parentLabel,
                        value: (
                          <OrgParentLookupValue
                            lookup={detail.branchLookup}
                            baseHref={TENANT_ROUTES.coreBranches}
                          />
                        ),
                      },
                    ]
                  : []),
                ...(level === "teams" && "departmentId" in node
                  ? [
                      {
                        label: copy.levels.departments.parentLabel,
                        value: (
                          <OrgParentLookupValue
                            lookup={detail.departmentLookup}
                            baseHref={TENANT_ROUTES.coreDepartments}
                          />
                        ),
                      },
                    ]
                  : []),
                ...("leadUserId" in node
                  ? [
                      {
                        label: copy.fields.leadUser,
                        value: (
                          <OrgLeadUserValue
                            leadUserId={node.leadUserId}
                            lookup={detail.leadLookup}
                            showEmail
                          />
                        ),
                      },
                    ]
                  : []),
                { label: copy.detail.createdAt, value: formatDateTime(node.createdAt, lang) },
                { label: copy.detail.updatedAt, value: formatDateTime(node.updatedAt, lang) },
              ]}
            />
          </>
        )}
      </div>
    </PermissionGate>
  );
}
