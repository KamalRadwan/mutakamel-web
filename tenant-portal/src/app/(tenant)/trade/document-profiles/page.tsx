"use client";

import {
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Send,
  ShoppingBag,
  Table2,
} from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DegradedBanner,
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
import { tradeStatusLabel } from "../trade-advanced-validation";
import {
  CREATABLE_DOCUMENT_TYPES,
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

const DOC_TYPE_HUES: Record<string, SwatchHue> = {
  QUOTATION: "blue",
  SALES_ORDER: "indigo",
  PURCHASE_ORDER: "teal",
  SALES_RETURN: "amber",
  PURCHASE_RETURN: "purple",
  POS_SALE: "green",
  GOODS_RECEIPT: "green",
  DELIVERY_ORDER: "purple",
  RETURN_ORDER: "amber",
};

export default function DocumentProfilesPage() {
  const {
    t,
    lang,
    canRead,
    canManage,
    canValidate,
    canPublish,
    branchIds,
    branchId,
    selectBranch,
    items,
    allItems,
    selectedProfile,
    setSelectedId,
    viewMode,
    setViewMode,
    search,
    setSearch,
    pageInfo,
    documentType,
    isLoading,
    isRefreshing,
    queryError,
    createOpen,
    versionFor,
    publishFor,
    publishProfile,
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

  const quotationCount = allItems.filter((p) => p.documentType === "QUOTATION").length;
  const salesOrderCount = allItems.filter((p) => p.documentType === "SALES_ORDER").length;
  const purchaseOrderCount = allItems.filter((p) => p.documentType === "PURCHASE_ORDER").length;

  const filterValues: FilterValues = documentType
    ? { documentType: { kind: "select", value: documentType } }
    : {};

  const columns: ColumnDef<DocumentProfile>[] = [
    {
      id: "code",
      header: t.tradeGovernance.code,
      cell: (row) => (
        <IdentifierText className="font-semibold text-foreground">{row.code}</IdentifierText>
      ),
    },
    {
      id: "documentType",
      header: t.tradeGovernance.documentType,
      cell: (row) => {
        const hue = DOC_TYPE_HUES[row.documentType] ?? "indigo";
        const palette = SWATCH_SURFACE_PALETTES[hue];
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
              palette.badge,
            )}
          >
            <span className={cn("size-1.5 rounded-full", palette.dot)} />
            {tradeStatusLabel(t.tradeStatus, row.documentType, t.common.unknownCode)}
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
      id: "versions",
      header: t.tradeGovernance.versions,
      cell: (row) =>
        row.versions.length === 0 ? (
          <span className="text-muted-foreground">{t.tradeGovernance.noVersions}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {row.versions.slice(0, 6).map((version) => (
              <span key={version.id} className="flex items-center gap-1">
                <Badge
                  tone={
                    version.status === "PUBLISHED"
                      ? "positive"
                      : version.status === "TESTED"
                        ? "brand"
                        : "neutral"
                  }
                >
                  {`v${version.profileVersion} · ${tradeStatusLabel(t.tradeStatus, version.status, t.common.unknownCode)}`}
                </Badge>
                {canValidate ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="w-7 px-0"
                    aria-label={t.tradeGovernance.validate}
                    disabled={pendingId !== null}
                    loading={pendingId === version.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void validateVersion(version);
                    }}
                  >
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
                {canPublish ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="w-7 px-0"
                    aria-label={t.tradeCommon.publish}
                    disabled={pendingId !== null}
                    onClick={(event) => {
                      event.stopPropagation();
                      openPublish(version, row);
                    }}
                  >
                    <Send className="size-3.5" aria-hidden="true" />
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
            ),
          },
        ]
      : []),
  ];

  const kpiCards = [
    {
      id: "total",
      label: t.tradeGovernance.profileKpiTotal,
      value: String(pageInfo.total || allItems.length),
      sub: t.tradeGovernance.profilesSubtitle,
      palette: SWATCH_SURFACE_PALETTES.indigo,
      Icon: FileText,
    },
    {
      id: "quotations",
      label: t.tradeGovernance.profileKpiQuotations,
      value: String(quotationCount),
      sub: "QUOTATION",
      palette: SWATCH_SURFACE_PALETTES.blue,
      Icon: FileSpreadsheet,
    },
    {
      id: "salesOrders",
      label: t.tradeGovernance.profileKpiSalesOrders,
      value: String(salesOrderCount),
      sub: "SALES_ORDER",
      palette: SWATCH_SURFACE_PALETTES.purple,
      Icon: ClipboardList,
    },
    {
      id: "purchaseOrders",
      label: t.tradeGovernance.profileKpiPurchaseOrders,
      value: String(purchaseOrderCount),
      sub: "PURCHASE_ORDER",
      palette: SWATCH_SURFACE_PALETTES.teal,
      Icon: ShoppingBag,
    },
  ];

  const renderInspector = (profile: DocumentProfile | null) => {
    if (!profile) {
      return (
        <div className="flex h-full min-h-60 items-center justify-center rounded-lg border border-border bg-card p-6 text-center text-xs text-muted-foreground">
          {t.tradeGovernance.selectDefinitionPrompt}
        </div>
      );
    }
    const hue = DOC_TYPE_HUES[profile.documentType] ?? "indigo";
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
                {profile.code}
              </IdentifierText>
              <Badge tone="brand">
                {tradeStatusLabel(t.tradeStatus, profile.scopeTarget, t.common.unknownCode)}
              </Badge>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                  palette.badge,
                )}
              >
                <span className={cn("size-1.5 rounded-full", palette.dot)} />
                {tradeStatusLabel(t.tradeStatus, profile.documentType, t.common.unknownCode)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {`${t.tradeGovernance.pointerVersionShort}: ${profile.pointerVersion ?? 0} · v${profile.version}`}
            </span>
          </div>

          {canManage && (
            <Button size="xs" variant="primary" onClick={() => openVersion(profile)}>
              <Plus className="size-3.5" aria-hidden="true" />
              {t.tradeGovernance.newVersion}
            </Button>
          )}
        </div>

        {/* Versions & Validation / Publish Actions */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-foreground">
            {t.tradeGovernance.versions} ({profile.versions.length})
          </span>
          {profile.versions.length === 0 ? (
            <p className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              {t.tradeGovernance.noVersions}
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {profile.versions.map((ver) => (
                <div
                  key={ver.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <IdentifierText className="text-xs font-semibold text-foreground">
                        {`v${ver.profileVersion}`}
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
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(ver.effectiveFrom, lang)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {canValidate && (
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={pendingId !== null}
                          loading={pendingId === ver.id}
                          onClick={() => void validateVersion(ver)}
                        >
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          {t.tradeGovernance.validate}
                        </Button>
                      )}
                      {canPublish && (
                        <Button
                          size="xs"
                          variant="primary"
                          disabled={pendingId !== null}
                          onClick={() => openPublish(ver, profile)}
                        >
                          <Send className="size-3.5" aria-hidden="true" />
                          {t.tradeCommon.publish}
                        </Button>
                      )}
                    </div>
                  </div>

                  {ver.content && Object.keys(ver.content).length > 0 && (
                    <pre
                      dir="ltr"
                      className="max-h-36 overflow-auto rounded-md border border-border bg-card p-2 font-mono text-xs text-foreground"
                    >
                      {JSON.stringify(ver.content, null, 2)}
                    </pre>
                  )}
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

      <DegradedBanner message={t.tradeGovernance.profilesNoDetailRoute} />

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
                <IdentifierText className="truncate text-xs text-muted-foreground">
                  {card.sub}
                </IdentifierText>
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

      {/* Document Type Quick Pills + View Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="xs"
            variant={documentType === undefined ? "primary" : "ghost"}
            onClick={() => setDocumentType(undefined)}
          >
            {t.tradeGovernance.filterAllKinds}
          </Button>
          {CREATABLE_DOCUMENT_TYPES.map((dt) => (
            <Button
              key={dt}
              size="xs"
              variant={documentType === dt ? "primary" : "ghost"}
              onClick={() => setDocumentType(dt)}
            >
              {tradeStatusLabel(t.tradeStatus, dt, t.common.unknownCode)}
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
              {t.tradeGovernance.profileCreate}
            </Button>
          )}
        </div>
      </div>

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
        onReset={() => {
          setDocumentType(undefined);
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
          {items.map((profile) => {
            const hue = DOC_TYPE_HUES[profile.documentType] ?? "indigo";
            const palette = SWATCH_SURFACE_PALETTES[hue];
            return (
              <div
                key={profile.id}
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
                        <FileText className="size-4" aria-hidden="true" />
                      </span>
                      <div className="flex flex-col">
                        <IdentifierText className="text-sm font-semibold text-foreground">
                          {profile.code}
                        </IdentifierText>
                        <span className="text-xs text-muted-foreground">
                          {`${t.tradeGovernance.pointerVersionShort}: ${profile.pointerVersion ?? 0} · v${profile.version}`}
                        </span>
                      </div>
                    </div>
                    <Badge tone="brand">
                      {tradeStatusLabel(t.tradeStatus, profile.scopeTarget, t.common.unknownCode)}
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
                      {tradeStatusLabel(t.tradeStatus, profile.documentType, t.common.unknownCode)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t.tradeGovernance.versions} ({profile.versions.length})
                    </span>
                    {profile.versions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {t.tradeGovernance.noVersions}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {profile.versions.slice(0, 4).map((version) => (
                          <span key={version.id} className="inline-flex items-center gap-1">
                            <Badge
                              tone={
                                version.status === "PUBLISHED"
                                  ? "positive"
                                  : version.status === "TESTED"
                                    ? "brand"
                                    : "neutral"
                              }
                            >
                              {`v${version.profileVersion} · ${tradeStatusLabel(t.tradeStatus, version.status, t.common.unknownCode)}`}
                            </Badge>
                            {canValidate ? (
                              <Button
                                variant="ghost"
                                size="xs"
                                className="w-7 px-0"
                                aria-label={t.tradeGovernance.validate}
                                disabled={pendingId !== null}
                                loading={pendingId === version.id}
                                onClick={() => void validateVersion(version)}
                              >
                                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                              </Button>
                            ) : null}
                            {canPublish ? (
                              <Button
                                variant="ghost"
                                size="xs"
                                className="w-7 px-0"
                                aria-label={t.tradeCommon.publish}
                                disabled={pendingId !== null}
                                onClick={() => openPublish(version, profile)}
                              >
                                <Send className="size-3.5" aria-hidden="true" />
                              </Button>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setSelectedId(profile.id);
                      setViewMode("split");
                    }}
                  >
                    <PanelRightOpen className="size-3.5" aria-hidden="true" />
                    {t.tradeGovernance.viewSplit}
                  </Button>
                  {canManage && (
                    <Button size="xs" variant="primary" onClick={() => openVersion(profile)}>
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
                errorTitle: t.tradeGovernance.profilesLoadFailed,
                emptyTitle: documentType
                  ? t.tradeCommon.emptyForFilter
                  : t.tradeGovernance.profilesEmpty,
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
          <div className="lg:col-span-5">{renderInspector(selectedProfile)}</div>
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
            errorTitle: t.tradeGovernance.profilesLoadFailed,
            emptyTitle: documentType
              ? t.tradeCommon.emptyForFilter
              : t.tradeGovernance.profilesEmpty,
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

      <CreateDocumentProfileModal
        key={createOpen ? "create-prof-open" : "create-prof-closed"}
        isOpen={createOpen}
        onClose={closeCreate}
        onSubmit={createProfile}
        isSubmitting={isSubmitting}
        error={formError}
      />

      {versionFor ? (
        <CreateDocumentProfileVersionDrawer
          key={`prof-ver-${versionFor.id}`}
          profileCode={versionFor.code}
          documentType={versionFor.documentType}
          onClose={closeVersion}
          onSubmit={createVersion}
          isSubmitting={isSubmitting}
          error={formError}
        />
      ) : null}

      {publishFor ? (
        <PublishDocumentProfileVersionModal
          key={`prof-pub-${publishFor.id}`}
          defaultPointerVersion={publishProfile?.pointerVersion ?? 0}
          versionRowNumber={publishFor.version}
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
