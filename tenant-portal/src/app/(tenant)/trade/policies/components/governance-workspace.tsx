"use client";

import {
  Building2,
  CheckCircle2,
  Edit3,
  GitBranch,
  Globe,
  LayoutGrid,
  PanelRightOpen,
  Plus,
  RefreshCw,
  ShieldCheck,
  Table2,
} from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  FilterBar,
  IdentifierText,
  PageHeader,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  cn,
  type ColumnDef,
  type FilterValues,
  type SwatchHue,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
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

const KIND_HUES: Record<string, SwatchHue> = {
  CREDIT: "amber",
  PRICING_GUARD: "indigo",
  ORDER_CONFIRMATION: "green",
  PURCHASE_APPROVAL: "teal",
  INVENTORY_NEGATIVE: "red",
  INVENTORY_RESERVATION: "blue",
  INVENTORY_OVER_RECEIPT: "purple",
  PRICING_OVERRIDE: "indigo",
  CREDIT_CONTROL: "amber",
  DISCOUNT_GOVERNANCE: "purple",
  DOCUMENT_APPROVAL: "green",
  QUOTATION: "blue",
  SALES_ORDER: "indigo",
  PURCHASE_ORDER: "teal",
  PRICE_PUBLICATION: "purple",
  CONFIGURATION_PUBLICATION: "amber",
};

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
    allItems,
    selectedDefinition,
    setSelectedId,
    viewMode,
    setViewMode,
    search,
    setSearch,
    pageInfo,
    kind,
    status,
    isLoading,
    isRefreshing,
    queryError,
    createOpen,
    versionFor,
    editingVersionFor,
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
    openEditVersion,
    closeEditVersion,
    openLadder,
    closeLadder,
    createDefinition,
    createVersion,
    updateVersion,
    runAction,
    reload,
  } = useGovernanceStudio(family);

  const kinds: readonly string[] = family === "policy" ? POLICY_KINDS : WORKFLOW_KINDS;
  const activeCount = allItems.filter((d) => d.status === "ACTIVE").length;
  const companyCount = allItems.filter((d) => d.scopeTarget === "COMPANY").length;
  const otherScopeCount = allItems.filter((d) => d.scopeTarget !== "COMPANY").length;

  const filterValues: FilterValues = {
    ...(kind ? { kind: { kind: "select" as const, value: kind } } : {}),
    ...(status ? { status: { kind: "select" as const, value: status } } : {}),
  };

  const columns: ColumnDef<GovernedDefinition>[] = [
    {
      id: "code",
      header: t.tradeGovernance.code,
      cell: (row) => (
        <IdentifierText className="font-semibold text-foreground">{row.code}</IdentifierText>
      ),
    },
    {
      id: "kind",
      header: family === "policy" ? t.tradeGovernance.policyKind : t.tradeGovernance.workflowKind,
      cell: (row) => {
        const hue = KIND_HUES[row.kind] ?? "indigo";
        const palette = SWATCH_SURFACE_PALETTES[hue];
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
              palette.badge,
            )}
          >
            <span className={cn("size-1.5 rounded-full", palette.dot)} />
            {tradeStatusLabel(t.tradeStatus, row.kind, t.common.unknownCode)}
          </span>
        );
      },
    },
    {
      id: "scopeTarget",
      header: t.tradeGovernance.scopeTarget,
      cell: (row) => (
        <Badge tone="brand">
          {tradeStatusLabel(t.tradeStatus, row.scopeTarget, t.common.unknownCode)}
        </Badge>
      ),
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
              <Badge
                key={version.id}
                tone={
                  version.status === "PUBLISHED"
                    ? "positive"
                    : version.status === "TESTED"
                      ? "brand"
                      : "neutral"
                }
              >
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
          <Button
            variant="ghost"
            size="xs"
            onClick={(event) => {
              event.stopPropagation();
              openLadder(row);
            }}
          >
            <GitBranch className="size-3.5" aria-hidden="true" />
            {t.tradeGovernance.openLadder}
          </Button>
          {canManage ? (
            <Button
              variant="outline"
              size="xs"
              onClick={(event) => {
                event.stopPropagation();
                openVersion(row);
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {t.tradeGovernance.newVersion}
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  const kpiCards = [
    {
      id: "total",
      label: t.tradeGovernance.kpiTotalDefinitions,
      value: String(pageInfo.total || allItems.length),
      sub:
        family === "policy"
          ? t.tradeGovernance.policiesSubtitle
          : t.tradeGovernance.workflowsSubtitle,
      palette: SWATCH_SURFACE_PALETTES.indigo,
      Icon: family === "policy" ? ShieldCheck : GitBranch,
    },
    {
      id: "active",
      label: t.tradeGovernance.kpiActiveDefinitions,
      value: String(activeCount),
      sub: t.tradeGovernance.definitionStatus,
      palette: SWATCH_SURFACE_PALETTES.green,
      Icon: CheckCircle2,
    },
    {
      id: "company",
      label: t.tradeGovernance.kpiCompanyScoped,
      value: String(companyCount),
      sub: t.tradeGovernance.scopeTarget,
      palette: SWATCH_SURFACE_PALETTES.blue,
      Icon: Building2,
    },
    {
      id: "other",
      label: t.tradeGovernance.kpiBranchAndTenantScoped,
      value: String(otherScopeCount),
      sub: t.tradeGovernance.scopeTargetHint,
      palette: SWATCH_SURFACE_PALETTES.purple,
      Icon: Globe,
    },
  ];

  const renderInspector = (def: GovernedDefinition | null) => {
    if (!def) {
      return (
        <div className="flex h-full min-h-60 items-center justify-center rounded-lg border border-border bg-card p-6 text-center text-xs text-muted-foreground">
          {t.tradeGovernance.selectDefinitionPrompt}
        </div>
      );
    }
    const hue = KIND_HUES[def.kind] ?? "indigo";
    const palette = SWATCH_SURFACE_PALETTES[hue];

    return (
      <div
        className={cn(
          "flex flex-col gap-4 rounded-lg border border-s-4 bg-card p-4",
          palette.accentBorder,
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <IdentifierText className="text-base font-semibold text-foreground">
                {def.code}
              </IdentifierText>
              <Badge tone="brand">
                {tradeStatusLabel(t.tradeStatus, def.scopeTarget, t.common.unknownCode)}
              </Badge>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                  palette.badge,
                )}
              >
                <span className={cn("size-1.5 rounded-full", palette.dot)} />
                {tradeStatusLabel(t.tradeStatus, def.kind, t.common.unknownCode)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {t.tradeGovernance.inspectorTitle} · {`${t.tradeCommon.version} v${def.version}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="xs" variant="outline" onClick={() => openLadder(def)}>
              <GitBranch className="size-3.5" aria-hidden="true" />
              {t.tradeGovernance.openLadder}
            </Button>
            {canManage && (
              <Button size="xs" variant="primary" onClick={() => openVersion(def)}>
                <Plus className="size-3.5" aria-hidden="true" />
                {t.tradeGovernance.newVersion}
              </Button>
            )}
          </div>
        </div>

        {/* Versions List with Direct PATCH Edit & Ladder Trigger */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-foreground">
            {t.tradeGovernance.versions} ({def.versions.length})
          </span>
          {def.versions.length === 0 ? (
            <p className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              {t.tradeGovernance.noVersionsDescription}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {def.versions.map((ver) => (
                <div
                  key={ver.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <IdentifierText className="text-xs font-semibold text-foreground">
                        {`v${ver.versionNumber}`}
                      </IdentifierText>
                      <Badge
                        tone={
                          ver.status === "PUBLISHED"
                            ? "positive"
                            : ver.status === "TESTED"
                              ? "brand"
                              : "neutral"
                        }
                      >
                        {tradeStatusLabel(t.tradeStatus, ver.status, t.common.unknownCode)}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(ver.effectiveFrom, lang)}
                      {ver.effectiveTo ? ` → ${formatDateTime(ver.effectiveTo, lang)}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canManage && (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => openEditVersion(def, ver)}
                      >
                        <Edit3 className="size-3.5" aria-hidden="true" />
                        {t.tradeGovernance.editDraftVersion}
                      </Button>
                    )}
                    <Button size="xs" variant="ghost" onClick={() => openLadder(def)}>
                      <GitBranch className="size-3.5" aria-hidden="true" />
                      {t.tradeGovernance.openLadder}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const content = (
    <div className="flex flex-col gap-4">
      <PageHeader
        className="sr-only"
        title={
          family === "policy" ? t.tradeGovernance.policiesTitle : t.tradeGovernance.workflowsTitle
        }
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => void reload()}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.tradeCommon.reload}
            </Button>
          </>
        }
      />

      {/* Colorful 4-Card KPI Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.Icon;
          return (
            <div
              key={card.id}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs",
                card.palette.accentBorder,
              )}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                <IdentifierText className="text-xl font-semibold tabular-nums text-foreground">
                  {card.value}
                </IdentifierText>
                <span className="truncate text-xs text-muted-foreground">{card.sub}</span>
              </div>
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                  card.palette.iconBoxIdle,
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
            </div>
          );
        })}
      </div>

      {/* Kind Quick Pills + View Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="xs"
            variant={kind === undefined ? "primary" : "ghost"}
            onClick={() => setKind(undefined)}
          >
            {t.tradeGovernance.filterAllKinds}
          </Button>
          {kinds.map((k) => (
            <Button
              key={k}
              size="xs"
              variant={kind === k ? "primary" : "ghost"}
              onClick={() => setKind(k)}
            >
              {tradeStatusLabel(t.tradeStatus, k, t.common.unknownCode)}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="xs"
            variant={viewMode === "bento" ? "primary" : "outline"}
            onClick={() => setViewMode("bento")}
          >
            <LayoutGrid className="size-3.5" aria-hidden="true" />
            {t.tradeGovernance.viewBento}
          </Button>
          <Button
            size="xs"
            variant={viewMode === "table" ? "primary" : "outline"}
            onClick={() => setViewMode("table")}
          >
            <Table2 className="size-3.5" aria-hidden="true" />
            {t.tradeGovernance.viewTable}
          </Button>
          <Button
            size="xs"
            variant={viewMode === "split" ? "primary" : "outline"}
            onClick={() => setViewMode("split")}
          >
            <PanelRightOpen className="size-3.5" aria-hidden="true" />
            {t.tradeGovernance.viewSplit}
          </Button>
          {canManage && (
            <Button size="xs" variant="primary" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden="true" />
              {family === "policy"
                ? t.tradeGovernance.policyCreate
                : t.tradeGovernance.workflowCreate}
            </Button>
          )}
        </div>
      </div>

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
          setSearch("");
        }}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t.tradeGovernance.searchPlaceholder}
        filtersLabel={t.common.filter}
        clearAllLabel={t.filters.clearAll}
      />

      {viewMode === "bento" && items.length > 0 ? (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((def) => {
            const hue = KIND_HUES[def.kind] ?? "indigo";
            const palette = SWATCH_SURFACE_PALETTES[hue];
            const firstDraft = def.versions.find((v) => v.status === "DRAFT") ?? def.versions[0];
            return (
              <div
                key={def.id}
                className={cn(
                  "flex flex-col justify-between gap-3 rounded-lg border border-s-4 bg-card p-4 shadow-2xs transition-colors hover:bg-muted/20",
                  palette.accentBorder,
                )}
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                          palette.iconBoxIdle,
                        )}
                      >
                        {family === "policy" ? (
                          <ShieldCheck className="size-4" aria-hidden="true" />
                        ) : (
                          <GitBranch className="size-4" aria-hidden="true" />
                        )}
                      </span>
                      <div className="flex flex-col">
                        <IdentifierText className="text-sm font-semibold text-foreground">
                          {def.code}
                        </IdentifierText>
                        <span className="text-xs text-muted-foreground">
                          {`${t.tradeCommon.version} v${def.version}`}
                        </span>
                      </div>
                    </div>
                    <Badge tone="brand">
                      {tradeStatusLabel(t.tradeStatus, def.scopeTarget, t.common.unknownCode)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                        palette.badge,
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", palette.dot)} />
                      {tradeStatusLabel(t.tradeStatus, def.kind, t.common.unknownCode)}
                    </span>
                    <Badge tone={def.status === "ACTIVE" ? "positive" : "neutral"}>
                      {tradeStatusLabel(t.tradeStatus, def.status, t.common.unknownCode)}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t.tradeGovernance.versions} ({def.versions.length})
                    </span>
                    {def.versions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {t.tradeGovernance.noVersions}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {def.versions.slice(0, 4).map((ver) => (
                          <Badge
                            key={ver.id}
                            tone={
                              ver.status === "PUBLISHED"
                                ? "positive"
                                : ver.status === "TESTED"
                                  ? "brand"
                                  : "neutral"
                            }
                          >
                            {`v${ver.versionNumber} · ${tradeStatusLabel(t.tradeStatus, ver.status, t.common.unknownCode)}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <div className="flex items-center gap-1.5">
                    <Button size="xs" variant="ghost" onClick={() => openLadder(def)}>
                      <GitBranch className="size-3.5" aria-hidden="true" />
                      {t.tradeGovernance.openLadder}
                    </Button>
                    {canManage && firstDraft && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => openEditVersion(def, firstDraft)}
                      >
                        <Edit3 className="size-3.5" aria-hidden="true" />
                        {t.tradeGovernance.editDraftVersion}
                      </Button>
                    )}
                  </div>
                  {canManage && (
                    <Button size="xs" variant="primary" onClick={() => openVersion(def)}>
                      <Plus className="size-3.5" aria-hidden="true" />
                      {t.tradeGovernance.newVersion}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === "split" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <DataTable
              density="compact"
              columns={columns}
              rows={items}
              isLoading={isLoading}
              error={queryError}
              onRetry={() => void reload()}
              page={pageInfo}
              onPageChange={setPage}
              rowKey={(row) => row.id}
              onRowClick={(row) => setSelectedId(row.id)}
              labels={{
                retry: t.common.retry,
                errorTitle: t.tradeGovernance.loadFailed,
                emptyTitle:
                  kind || status ? t.tradeCommon.emptyForFilter : t.tradeGovernance.empty,
                selectAll: t.common.actions,
                selectRow: t.common.actions,
                sortAscending: t.common.actions,
                sortDescending: t.common.actions,
                notSorted: t.common.actions,
                pagination: {
                  previous: t.common.previousPage,
                  next: t.common.nextPage,
                  summary: (from, to, total) =>
                    formatTemplate(t.common.showingOf, { from, to, total }),
                },
              }}
            />
          </div>
          <div className="lg:col-span-5">{renderInspector(selectedDefinition)}</div>
        </div>
      ) : (
        <DataTable
          density="compact"
          columns={columns}
          rows={items}
          isLoading={isLoading}
          error={queryError}
          onRetry={() => void reload()}
          page={pageInfo}
          onPageChange={setPage}
          rowKey={(row) => row.id}
          onRowClick={(row) => setSelectedId(row.id)}
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
      )}

      <CreateDefinitionModal
        key={createOpen ? "create-def-open" : "create-def-closed"}
        family={family}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={createDefinition}
        isSubmitting={isSubmitting}
        error={formError}
      />

      {versionFor ? (
        <GovernedVersionDrawer
          key={`create-ver-${versionFor.id}`}
          family={family}
          mode="create"
          definitionCode={versionFor.code}
          onClose={closeVersion}
          onSubmit={createVersion}
          isSubmitting={isSubmitting}
          error={formError}
        />
      ) : null}

      {editingVersionFor ? (
        <GovernedVersionDrawer
          key={`edit-ver-${editingVersionFor.version.id}`}
          family={family}
          mode="edit"
          definitionCode={editingVersionFor.definition.code}
          initialVersion={editingVersionFor.version}
          onClose={closeEditVersion}
          onSubmit={updateVersion}
          isSubmitting={isSubmitting}
          error={formError}
        />
      ) : null}

      {ladderFor ? (
        <VersionLadderSheet
          key={`ladder-${ladderFor.id}`}
          definition={ladderFor}
          lang={lang}
          canManage={canManage}
          canRun={canRun}
          pendingAction={pendingAction}
          onRun={runAction}
          onEditVersion={(ver) => {
            const targetDef = ladderFor;
            closeLadder();
            openEditVersion(targetDef, ver);
          }}
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
