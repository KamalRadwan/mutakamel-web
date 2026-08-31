"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
  FilterBar,
  PageHeader,
  PermissionGate,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../trade-advanced-validation";
import {
  EXTENSION_PROFILE_STATUSES,
  EXTENSION_READ_PERMISSION,
  EXTENSION_TARGET_CODES,
  isExtensionProfileStatus,
  isExtensionTargetCode,
  type ExtensionProfile,
} from "./extension-contract";
import { CreateExtensionProfileModal } from "./components/CreateExtensionProfileModal";
import { useExtensionProfiles } from "./hooks/useExtensionProfiles";

export default function ExtensionProfilesPage() {
  const {
    t,
    lang,
    canRead,
    canManage,
    branchIds,
    branchId,
    selectBranch,
    items,
    catalogue,
    catalogueUnavailable,
    pageInfo,
    targetCode,
    status,
    isLoading,
    isRefreshing,
    queryError,
    createOpen,
    isSubmitting,
    formError,
    setPage,
    setTargetCode,
    setStatus,
    openCreate,
    closeCreate,
    create,
    reload,
  } = useExtensionProfiles();

  const filterValues: FilterValues = {
    ...(targetCode ? { targetCode: { kind: "select" as const, value: targetCode } } : {}),
    ...(status ? { status: { kind: "select" as const, value: status } } : {}),
  };

  const columns: ColumnDef<ExtensionProfile>[] = [
    {
      id: "code",
      header: t.tradeAutomation.code,
      cell: (profile) => (
        <Link
          href={`${TENANT_ROUTES.tradeExtensions}/${profile.id}`}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {profile.code}
        </Link>
      ),
    },
    {
      id: "targetCode",
      header: t.tradeAutomation.targetCode,
      cell: (profile) => tradeStatusLabel(t.tradeStatus, profile.targetCode),
    },
    {
      id: "scopeTarget",
      header: t.tradeGovernance.scopeTarget,
      cell: (profile) => tradeStatusLabel(t.tradeStatus, profile.scopeTarget),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (profile) => (
        <Badge tone={profile.status === "ACTIVE" ? "positive" : "neutral"}>
          {tradeStatusLabel(t.tradeStatus, profile.status)}
        </Badge>
      ),
    },
    {
      id: "published",
      header: t.tradeAutomation.publishedVersion,
      cell: (profile) =>
        profile.currentPublishedVersion
          ? `v${profile.currentPublishedVersion.versionNumber}`
          : "—",
    },
    {
      id: "draft",
      header: t.tradeAutomation.draftVersion,
      cell: (profile) =>
        profile.editableDraftVersion
          ? `v${profile.editableDraftVersion.versionNumber}`
          : "—",
    },
    {
      id: "updatedAt",
      header: t.tradeCommon.updatedAt,
      cell: (profile) => formatDateTime(profile.updatedAt, lang),
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeAutomation.profilesTitle}
        description={t.tradeAutomation.profilesSubtitle}
        primaryAction={
          canManage ? { label: t.tradeAutomation.profileCreate, onClick: openCreate } : undefined
        }
        secondaryActions={
          <>
            <TenantBranchSelect
              branchIds={branchIds}
              branchId={branchId}
              onChange={selectBranch}
              disabled={isRefreshing}
            />
            <Button variant="outline" onClick={() => void reload()} disabled={isRefreshing}>
              <RefreshCw
                className={isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.tradeCommon.reload}
            </Button>
          </>
        }
      />

      {/* Per-source degradation: the list is one request and the target
          catalogue is another, so losing the catalogue names what is missing
          rather than blanking the screen. */}
      {catalogueUnavailable ? (
        <DegradedBanner message={t.tradeAutomation.targetsUnavailable} />
      ) : catalogue ? (
        <p className="text-xs text-muted-foreground">
          {formatTemplate(t.tradeAutomation.registryVersion, {
            version: catalogue.registryVersion,
            fields: catalogue.fieldsPerProfile,
          })}
        </p>
      ) : null}

      <FilterBar
        filters={[
          {
            id: "targetCode",
            kind: "select",
            label: t.tradeAutomation.targetCode,
            placeholder: t.tradeCommon.anyStatus,
            options: EXTENSION_TARGET_CODES.map((value) => ({
              value,
              label: tradeStatusLabel(t.tradeStatus, value),
            })),
          },
          {
            id: "status",
            kind: "select",
            label: t.common.status,
            placeholder: t.tradeCommon.anyStatus,
            options: EXTENSION_PROFILE_STATUSES.map((value) => ({
              value,
              label: tradeStatusLabel(t.tradeStatus, value),
            })),
          },
        ]}
        values={filterValues}
        onChange={(next) => {
          const target = next.targetCode;
          const state = next.status;
          setTargetCode(
            target?.kind === "select" && isExtensionTargetCode(target.value)
              ? target.value
              : undefined,
          );
          setStatus(
            state?.kind === "select" && isExtensionProfileStatus(state.value)
              ? state.value
              : undefined,
          );
        }}
        onReset={() => {
          setTargetCode(undefined);
          setStatus(undefined);
        }}
        searchValue=""
        onSearchChange={() => undefined}
        filtersLabel={t.common.filter}
        clearAllLabel={t.filters.clearAll}
      />

      <DataTable
        columns={columns}
        rows={items}
        isLoading={isLoading}
        error={queryError}
        onRetry={() => void reload()}
        page={pageInfo}
        onPageChange={setPage}
        rowKey={(profile) => profile.id}
        labels={{
          retry: t.common.retry,
          errorTitle: t.tradeAutomation.profilesLoadFailed,
          emptyTitle:
            targetCode || status ? t.tradeCommon.emptyForFilter : t.tradeAutomation.profilesEmpty,
          selectAll: t.common.actions,
          selectRow: t.common.actions,
          sortAscending: t.common.actions,
          sortDescending: t.common.actions,
          notSorted: t.common.actions,
          pagination: {
            previous: t.common.previousPage,
            next: t.common.nextPage,
            summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
          },
        }}
      />

      <CreateExtensionProfileModal
        key={createOpen ? "create-open" : "create-closed"}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={create}
        isSubmitting={isSubmitting}
        error={formError}
      />
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={EXTENSION_READ_PERMISSION}>{content}</PermissionGate>
  );
}
