"use client";

import { GitBranch, Plus, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  PageHeader,
  PermissionGate,
  type ColumnDef,
  type FilterValues,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  DEFINITION_STATUSES,
  POLICY_KINDS,
  POLICY_READ_PERMISSION,
  WORKFLOW_KINDS,
  isDefinitionStatus,
  type GovernanceFamily,
  type GovernedDefinition,
} from "../governance-contract";
import { useGovernanceStudio } from "../hooks/useGovernanceStudio";
import { CreateDefinitionModal } from "./CreateDefinitionModal";
import { GovernedVersionDrawer } from "./GovernedVersionDrawer";
import { VersionLadderSheet } from "./VersionLadderSheet";

/**
 * Policies and workflows render the same workspace.
 *
 * They are one controller, one service, one DTO set and one permission family
 * on the server; splitting the screen in two would duplicate every state and
 * every label for a difference that is a single adapter switch.
 */
export function GovernanceWorkspace({ family }: { family: GovernanceFamily }) {
  const {
    t,
    lang,
    canRead,
    canManage,
    canRun,
    branchIds,
    branchId,
    selectBranch,
    items,
    pageInfo,
    kind,
    status,
    isLoading,
    isRefreshing,
    queryError,
    createOpen,
    versionFor,
    ladderFor,
    isSubmitting,
    formError,
    pendingAction,
    setPage,
    setKind,
    setStatus,
    openCreate,
    closeCreate,
    openVersion,
    closeVersion,
    openLadder,
    closeLadder,
    createDefinition,
    createVersion,
    runAction,
    reload,
  } = useGovernanceStudio(family);

  const kinds: readonly string[] = family === "policy" ? POLICY_KINDS : WORKFLOW_KINDS;
  const filterValues: FilterValues = {
    ...(kind ? { kind: { kind: "select" as const, value: kind } } : {}),
    ...(status ? { status: { kind: "select" as const, value: status } } : {}),
  };

  const columns: ColumnDef<GovernedDefinition>[] = [
    { id: "code", header: t.tradeGovernance.code, cell: (row) => row.code },
    {
      id: "kind",
      header: family === "policy" ? t.tradeGovernance.policyKind : t.tradeGovernance.workflowKind,
      cell: (row) => tradeStatusLabel(t.tradeStatus, row.kind, t.common.unknownCode),
    },
    {
      id: "scopeTarget",
      header: t.tradeGovernance.scopeTarget,
      cell: (row) => tradeStatusLabel(t.tradeStatus, row.scopeTarget, t.common.unknownCode),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => (
        <Badge tone={row.status === "ACTIVE" ? "positive" : "neutral"}>
          {tradeStatusLabel(t.tradeStatus, row.status, t.common.unknownCode)}
        </Badge>
      ),
    },
    {
      id: "versions",
      header: t.tradeGovernance.versions,
      cell: (row) =>
        row.versions.length === 0 ? (
          <span className="text-muted-foreground">{t.tradeGovernance.noVersions}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {row.versions.slice(0, 4).map((version) => (
              <Badge key={version.id} tone={version.status === "PUBLISHED" ? "positive" : "neutral"}>
                {`v${version.versionNumber} · ${tradeStatusLabel(t.tradeStatus, version.status, t.common.unknownCode)}`}
              </Badge>
            ))}
          </span>
        ),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (row) => (
        <span className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openLadder(row)}>
            <GitBranch className="size-4" aria-hidden="true" />
            {t.tradeGovernance.openLadder}
          </Button>
          {canManage ? (
            <Button variant="ghost" size="sm" onClick={() => openVersion(row)}>
              <Plus className="size-4" aria-hidden="true" />
              {t.tradeGovernance.newVersion}
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={family === "policy" ? t.tradeGovernance.policiesTitle : t.tradeGovernance.workflowsTitle}
        description={
          family === "policy"
            ? t.tradeGovernance.policiesSubtitle
            : t.tradeGovernance.workflowsSubtitle
        }
        primaryAction={
          canManage
            ? {
                label:
                  family === "policy"
                    ? t.tradeGovernance.policyCreate
                    : t.tradeGovernance.workflowCreate,
                onClick: openCreate,
              }
            : undefined
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

      <FilterBar
        filters={[
          {
            id: "kind",
            kind: "select",
            label:
              family === "policy" ? t.tradeGovernance.policyKind : t.tradeGovernance.workflowKind,
            placeholder: t.tradeCommon.anyStatus,
            options: kinds.map((value) => ({
              value,
              label: tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode),
            })),
          },
          {
            id: "status",
            kind: "select",
            label: t.tradeGovernance.definitionStatus,
            placeholder: t.tradeCommon.anyStatus,
            options: DEFINITION_STATUSES.map((value) => ({
              value,
              label: tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode),
            })),
          },
        ]}
        values={filterValues}
        onChange={(next) => {
          const kindValue = next.kind;
          const statusValue = next.status;
          setKind(
            kindValue?.kind === "select" && kindValue.value ? kindValue.value : undefined,
          );
          setStatus(
            statusValue?.kind === "select" && isDefinitionStatus(statusValue.value)
              ? statusValue.value
              : undefined,
          );
        }}
        onReset={() => {
          setKind(undefined);
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
        rowKey={(row) => row.id}
        labels={{
          retry: t.common.retry,
          errorTitle: t.tradeGovernance.loadFailed,
          emptyTitle: kind || status ? t.tradeCommon.emptyForFilter : t.tradeGovernance.empty,
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

      <CreateDefinitionModal
        key={createOpen ? "create-open" : "create-closed"}
        family={family}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={createDefinition}
        isSubmitting={isSubmitting}
        error={formError}
      />

      {versionFor ? (
        <GovernedVersionDrawer
          key={versionFor.id}
          definitionCode={versionFor.code}
          onClose={closeVersion}
          onSubmit={createVersion}
          isSubmitting={isSubmitting}
          error={formError}
        />
      ) : null}

      {ladderFor ? (
        <VersionLadderSheet
          key={ladderFor.id}
          definition={ladderFor}
          lang={lang}
          canRun={canRun}
          pendingAction={pendingAction}
          onRun={runAction}
          onClose={closeLadder}
        />
      ) : null}
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={POLICY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
