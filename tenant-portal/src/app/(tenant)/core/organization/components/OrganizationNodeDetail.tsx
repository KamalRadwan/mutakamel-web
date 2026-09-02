"use client";

import {
  Badge,
  DetailHeader,
  DetailSection,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { useCoreErrorText } from "../../hooks/useCoreErrorText";
import type { OrgLevel } from "../../contracts/organization-contract";
import { useOrganizationNode } from "../hooks/useOrganizationNode";

export function OrganizationNodeDetail<L extends OrgLevel>({
  level,
  id,
}: {
  level: L;
  id: string;
}) {
  const { t, lang, config, node, isLoading, loadError, isMissing, reload } =
    useOrganizationNode(level, id);
  const copy = t.coreIdentity;
  const levelCopy = copy.levels[level];
  const describeError = useCoreErrorText();

  return (
    <PermissionGate require={config.readPermission}>
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
              breadcrumbs={[{ label: levelCopy.title, href: config.href }, { label: node.name }]}
              status={
                <Badge tone={node.status === "ACTIVE" ? "positive" : "neutral"}>
                  {copy.orgStatus[node.status]}
                </Badge>
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
                  ? [{ label: copy.fields.taxNumber, value: node.taxNumber }]
                  : []),
                ...("currencyCode" in node
                  ? [{ label: copy.fields.currencyCode, value: node.currencyCode }]
                  : []),
                ...("address" in node
                  ? [{ label: copy.fields.address, value: node.address, wide: true }]
                  : []),
                ...("phone" in node ? [{ label: copy.fields.phone, value: node.phone }] : []),
                ...("isHeadquarters" in node
                  ? [
                      {
                        label: copy.fields.isHeadquarters,
                        value: node.isHeadquarters ? t.filters.yes : t.filters.no,
                      },
                    ]
                  : []),
              ]}
            />

            <DetailSection
              title={copy.detail.placement}
              description={copy.detail.placementDescription}
              emptyValueLabel={t.detail.notRecorded}
              fields={[
                ...("companyId" in node
                  ? [{ label: copy.levels.companies.parentLabel, value: idValue(node.companyId) }]
                  : []),
                ...("branchId" in node
                  ? [{ label: copy.levels.branches.parentLabel, value: idValue(node.branchId) }]
                  : []),
                ...("departmentId" in node
                  ? [
                      {
                        label: copy.levels.departments.parentLabel,
                        value: idValue(node.departmentId),
                      },
                    ]
                  : []),
                ...("leadUserId" in node
                  ? [{ label: copy.fields.leadUser, value: idValue(node.leadUserId) }]
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

/**
 * The organization detail routes return foreign keys only — no joined name is
 * on the response — so the id renders as an id rather than being resolved by a
 * second guess. Showing a fabricated label would be worse than showing the key.
 */
function idValue(value: string | null): React.ReactNode {
  return value ? <IdentifierText className="text-2xs">{value}</IdentifierText> : null;
}
