"use client";

import { CheckCircle2, Plus, RefreshCw, Send } from "lucide-react";
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
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../trade-advanced-validation";
import {
  DOCUMENT_PROFILE_READ_PERMISSION,
  FILTERABLE_DOCUMENT_TYPES,
  type DocumentProfile,
} from "./document-profile-contract";
import {
  CreateDocumentProfileModal,
  CreateDocumentProfileVersionDrawer,
  PublishDocumentProfileVersionModal,
} from "./components/DocumentProfileModals";
import { useDocumentProfiles } from "./hooks/useDocumentProfiles";

export default function DocumentProfilesPage() {
  const {
    t,
    canRead,
    canManage,
    canValidate,
    canPublish,
    branchIds,
    branchId,
    selectBranch,
    items,
    pageInfo,
    documentType,
    isLoading,
    isRefreshing,
    queryError,
    createOpen,
    versionFor,
    publishFor,
    isSubmitting,
    formError,
    pendingId,
    setPage,
    setDocumentType,
    openCreate,
    closeCreate,
    openVersion,
    closeVersion,
    openPublish,
    closePublish,
    createProfile,
    createVersion,
    validateVersion,
    publishVersion,
    reload,
  } = useDocumentProfiles();

  const filterValues: FilterValues = documentType
    ? { documentType: { kind: "select", value: documentType } }
    : {};

  const columns: ColumnDef<DocumentProfile>[] = [
    { id: "code", header: t.tradeGovernance.code, cell: (row) => row.code },
    {
      id: "documentType",
      header: t.tradeGovernance.documentType,
      cell: (row) => tradeStatusLabel(t.tradeStatus, row.documentType, t.common.unknownCode),
    },
    {
      id: "scopeTarget",
      header: t.tradeGovernance.scopeTarget,
      cell: (row) => tradeStatusLabel(t.tradeStatus, row.scopeTarget, t.common.unknownCode),
    },
    {
      id: "versions",
      header: t.tradeGovernance.versions,
      cell: (row) =>
        row.versions.length === 0 ? (
          <span className="text-muted-foreground">{t.tradeGovernance.noVersions}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {row.versions.slice(0, 6).map((version) => (
              <span key={version.id} className="flex items-center gap-1">
                <Badge tone={version.status === "PUBLISHED" ? "positive" : "neutral"}>
                  {`v${version.profileVersion} · ${tradeStatusLabel(t.tradeStatus, version.status, t.common.unknownCode)}`}
                </Badge>
                {canValidate ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t.tradeGovernance.validate}
                    disabled={pendingId !== null}
                    loading={pendingId === version.id}
                    onClick={() => void validateVersion(version)}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
                {canPublish ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t.tradeCommon.publish}
                    disabled={pendingId !== null}
                    onClick={() => openPublish(version)}
                  >
                    <Send className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </span>
            ))}
          </span>
        ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            cell: (row: DocumentProfile) => (
              <Button variant="ghost" size="sm" onClick={() => openVersion(row)}>
                <Plus className="size-4" aria-hidden="true" />
                {t.tradeGovernance.newVersion}
              </Button>
            ),
          },
        ]
      : []),
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.tradeGovernance.profilesTitle}
        description={t.tradeGovernance.profilesSubtitle}
        primaryAction={
          canManage ? { label: t.tradeGovernance.profileCreate, onClick: openCreate } : undefined
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

      {/* A statement about the API, not a fault: there is no GET for a profile
          or a profile version by id, so every action is driven from the list
          row and no detail screen exists. */}
      <DegradedBanner message={t.tradeGovernance.profilesNoDetailRoute} />

      <FilterBar
        filters={[
          {
            id: "documentType",
            kind: "select",
            label: t.tradeGovernance.documentType,
            placeholder: t.tradeCommon.anyStatus,
            options: FILTERABLE_DOCUMENT_TYPES.map((value) => ({
              value,
              label: tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode),
            })),
          },
        ]}
        values={filterValues}
        onChange={(next) => {
          const value = next.documentType;
          setDocumentType(value?.kind === "select" && value.value ? value.value : undefined);
        }}
        onReset={() => setDocumentType(undefined)}
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
        rowKey={(row) => row.id}
        labels={{
          retry: t.common.retry,
          errorTitle: t.tradeGovernance.profilesLoadFailed,
          emptyTitle: documentType ? t.tradeCommon.emptyForFilter : t.tradeGovernance.profilesEmpty,
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

      <CreateDocumentProfileModal
        key={createOpen ? "create-open" : "create-closed"}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={createProfile}
        isSubmitting={isSubmitting}
        error={formError}
      />

      {versionFor ? (
        <CreateDocumentProfileVersionDrawer
          key={versionFor.id}
          profileCode={versionFor.code}
          onClose={closeVersion}
          onSubmit={createVersion}
          isSubmitting={isSubmitting}
          error={formError}
        />
      ) : null}

      {publishFor ? (
        <PublishDocumentProfileVersionModal
          key={publishFor.id}
          onClose={closePublish}
          onSubmit={publishVersion}
          isSubmitting={pendingId !== null}
          error={formError}
        />
      ) : null}
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={DOCUMENT_PROFILE_READ_PERMISSION}>{content}</PermissionGate>
  );
}
