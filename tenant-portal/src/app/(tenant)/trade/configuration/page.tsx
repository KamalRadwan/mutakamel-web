"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  GitMerge,
  LayoutGrid,
  Layers,
  List,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  IdentifierText,
  Input,
  PageHeader,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { TradeScopeBar } from "../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../trade-scope";
import {
  ConfigurationInspectModal,
  CreateDefinitionDrawer,
  CreateVersionDrawer,
} from "./components/ConfigurationDrawers";
import {
  DefaultPriceBooksPanel,
  ResolvePanel,
  VersionsPanel,
} from "./components/ConfigurationPanels";
import { useConfigurationDefinitions } from "./hooks/useConfigurationDefinitions";
import {
  MERGE_STRATEGIES,
  RISK_CLASSES,
  isConfigurationScope,
  isMergeStrategy,
  isRiskClass,
  type ConfigurationDefinition,
  type MergeStrategy,
  type RiskClass,
} from "./configuration-contract";
import {
  CONFIG_UI_COPY,
  MERGE_STRATEGY_INFO,
  RISK_CLASS_PALETTES,
  describeValueSchemaHumanReadable,
} from "./configuration-catalogue-metadata";

export default function TradeConfigurationPage() {
  const { t, lang } = useI18n();
  const copy = CONFIG_UI_COPY[lang];
  const configuration = useConfigurationDefinitions();

  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskClass | "ALL">("ALL");
  const [strategyFilter, setStrategyFilter] = useState<MergeStrategy | "ALL">("ALL");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [inspecting, setInspecting] = useState<ConfigurationDefinition | null>(null);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return configuration.items.filter((def) => {
      if (riskFilter !== "ALL" && def.riskClass !== riskFilter) return false;
      if (strategyFilter !== "ALL" && def.mergeStrategy !== strategyFilter) return false;
      if (
        q.length > 0 &&
        !def.key.toLowerCase().includes(q) &&
        !def.mergeStrategy.toLowerCase().includes(q) &&
        !def.riskClass.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [configuration.items, searchQuery, riskFilter, strategyFilter]);

  const selected =
    configuration.items.find((definition) => definition.id === configuration.selectedId) ??
    filteredItems[0] ??
    null;

  const kpiStats = useMemo(() => {
    const total = configuration.pageInfo.total || configuration.items.length;
    const publishedVersions = configuration.items.reduce(
      (acc, d) => acc + d.versions.filter((v) => v.status === "PUBLISHED").length,
      0,
    );
    const highCriticalCount = configuration.items.filter(
      (d) => d.riskClass === "HIGH" || d.riskClass === "CRITICAL",
    ).length;
    const distinctStrategies = new Set(configuration.items.map((d) => d.mergeStrategy)).size;
    return { total, publishedVersions, highCriticalCount, distinctStrategies };
  }, [configuration.items, configuration.pageInfo.total]);

  const columns: ColumnDef<ConfigurationDefinition>[] = [
    {
      id: "key",
      header: t.trade.definitionKey,
      cell: (definition) => {
        const risk = isRiskClass(definition.riskClass) ? definition.riskClass : "MEDIUM";
        const palette = RISK_CLASS_PALETTES[risk];
        return (
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", palette.dotClass)} />
            <IdentifierText className="text-xs font-semibold text-foreground">
              {definition.key}
            </IdentifierText>
          </div>
        );
      },
    },
    {
      id: "mergeStrategy",
      header: t.trade.definitionMergeStrategy,
      cell: (definition) => {
        if (isMergeStrategy(definition.mergeStrategy)) {
          const info = MERGE_STRATEGY_INFO[definition.mergeStrategy];
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                info.badgeClass,
              )}
            >
              <GitMerge className="size-3" aria-hidden="true" />
              {t.trade[`mergeStrategy_${definition.mergeStrategy}`]}
            </span>
          );
        }
        return definition.mergeStrategy;
      },
    },
    {
      id: "riskClass",
      header: t.trade.definitionRiskClass,
      cell: (definition) => {
        if (isRiskClass(definition.riskClass)) {
          const palette = RISK_CLASS_PALETTES[definition.riskClass];
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
                palette.badgeClass,
              )}
            >
              <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
              {t.trade[`riskClass_${definition.riskClass}`]}
            </span>
          );
        }
        return <Badge tone="neutral">{definition.riskClass}</Badge>;
      },
    },
    {
      id: "scopes",
      header: t.trade.definitionAllowedScopes,
      cell: (definition) => (
        <span className="flex flex-wrap gap-1">
          {definition.allowedScopes.map((scope) => (
            <Badge key={scope} tone="neutral">
              {isConfigurationScope(scope) ? t.trade[`scopeTarget_${scope}`] : scope}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      id: "versions",
      header: t.trade.versionsTitle,
      numeric: true,
      cell: (definition) => definition.versions.length,
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end" as const,
      sticky: "end" as const,
      width: "6.5rem",
      cell: (definition: ConfigurationDefinition) => (
        <span className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className="w-7 px-0"
                aria-label={t.trade.versionsTitle}
                onClick={(e) => {
                  e.stopPropagation();
                  setInspecting(definition);
                }}
              >
                <Eye className="size-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.trade.versionsTitle}</TooltipContent>
          </Tooltip>
          {configuration.canManage && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  className="w-7 px-0"
                  aria-label={t.trade.versionCreate}
                  onClick={(e) => {
                    e.stopPropagation();
                    configuration.openVersion(definition);
                  }}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.trade.versionCreate}</TooltipContent>
            </Tooltip>
          )}
        </span>
      ),
    },
  ];

  return (
    <PermissionGate require={TRADE_PERMISSIONS.configurationRead}>
      <div className="flex flex-col gap-4">
        <PageHeader
          className="sr-only"
          title={t.trade.configurationTitle}
          description={t.trade.configurationSubtitle}
          primaryAction={
            configuration.canManage
              ? { label: t.trade.definitionCreate, onClick: configuration.openCreate }
              : undefined
          }
          secondaryActions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void configuration.reload()}
              disabled={configuration.isRefreshing}
            >
              <RefreshCw
                className={configuration.isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.trade.reload}
            </Button>
          }
        />

        <TradeScopeBar hideWhenSingleScope />

        {/* Executive Colorful KPI Strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div
            className={cn(
              "relative overflow-hidden rounded-lg border p-3.5 shadow-xs",
              SWATCH_SURFACE_PALETTES.indigo.sectionCard,
            )}
          >
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-1",
                SWATCH_SURFACE_PALETTES.indigo.dot,
              )}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {copy.kpiTotalTitle}
              </span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-md border",
                  SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle,
                  SWATCH_SURFACE_PALETTES.indigo.iconText,
                )}
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{kpiStats.total}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{copy.kpiTotalSub}</p>
          </div>

          <div
            className={cn(
              "relative overflow-hidden rounded-lg border p-3.5 shadow-xs",
              SWATCH_SURFACE_PALETTES.green.sectionCard,
            )}
          >
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-1",
                SWATCH_SURFACE_PALETTES.green.dot,
              )}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {copy.kpiPublishedTitle}
              </span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-md border",
                  SWATCH_SURFACE_PALETTES.green.iconBoxIdle,
                  SWATCH_SURFACE_PALETTES.green.iconText,
                )}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
              </span>
            </div>
            <p
              className={cn(
                "mt-2 text-2xl font-semibold",
                SWATCH_SURFACE_PALETTES.green.iconText,
              )}
            >
              {kpiStats.publishedVersions}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{copy.kpiPublishedSub}</p>
          </div>

          <div
            className={cn(
              "relative overflow-hidden rounded-lg border p-3.5 shadow-xs",
              SWATCH_SURFACE_PALETTES.red.sectionCard,
            )}
          >
            <div
              className={cn("absolute inset-x-0 top-0 h-1", SWATCH_SURFACE_PALETTES.red.dot)}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {copy.kpiHighRiskTitle}
              </span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-md border",
                  SWATCH_SURFACE_PALETTES.red.iconBoxIdle,
                  SWATCH_SURFACE_PALETTES.red.iconText,
                )}
              >
                <ShieldAlert className="size-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {kpiStats.highCriticalCount}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{copy.kpiHighRiskSub}</p>
          </div>

          <div
            className={cn(
              "relative overflow-hidden rounded-lg border p-3.5 shadow-xs",
              SWATCH_SURFACE_PALETTES.blue.sectionCard,
            )}
          >
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-1",
                SWATCH_SURFACE_PALETTES.blue.dot,
              )}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t.trade.definitionMergeStrategy}
              </span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-md border",
                  SWATCH_SURFACE_PALETTES.blue.iconBoxIdle,
                  SWATCH_SURFACE_PALETTES.blue.iconText,
                )}
              >
                <GitMerge className="size-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {kpiStats.distinctStrategies}{" "}
              <span className="text-sm font-normal text-muted-foreground">/ 6</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{copy.kpiMergeSub}</p>
          </div>
        </div>

        {/* Filter & View Switcher Ribbon */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search
                className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                size="sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={copy.searchPlaceholder}
                className="ps-8"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
                <Button
                  type="button"
                  size="xs"
                  variant={viewMode === "table" ? "primary" : "ghost"}
                  onClick={() => setViewMode("table")}
                >
                  <List className="size-3.5" aria-hidden="true" />
                  {copy.tableView}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={viewMode === "cards" ? "primary" : "ghost"}
                  onClick={() => setViewMode("cards")}
                >
                  <LayoutGrid className="size-3.5" aria-hidden="true" />
                  {copy.cardsView}
                </Button>
              </div>

              {configuration.canManage && (
                <Button size="sm" variant="primary" onClick={configuration.openCreate}>
                  <Plus className="size-3.5" aria-hidden="true" />
                  {t.trade.definitionCreate}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
            <Button
              type="button"
              size="xs"
              variant={
                riskFilter === "ALL" && strategyFilter === "ALL" ? "primary" : "outline"
              }
              onClick={() => {
                setRiskFilter("ALL");
                setStrategyFilter("ALL");
              }}
            >
              {copy.allFilter} ({configuration.items.length})
            </Button>
            {RISK_CLASSES.map((risk) => {
              const palette = RISK_CLASS_PALETTES[risk];
              const active = riskFilter === risk;
              return (
                <Button
                  key={risk}
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setRiskFilter(active ? "ALL" : risk)}
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    active && palette.badgeClass,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
                  <span>{t.trade[`riskClass_${risk}`]}</span>
                </Button>
              );
            })}
            <span className="mx-1 h-4 w-px bg-border" />
            {MERGE_STRATEGIES.map((strategy) => {
              const info = MERGE_STRATEGY_INFO[strategy];
              const active = strategyFilter === strategy;
              return (
                <Button
                  key={strategy}
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setStrategyFilter(active ? "ALL" : strategy)}
                  className={cn("inline-flex items-center gap-1", active && info.badgeClass)}
                >
                  <span>{t.trade[`mergeStrategy_${strategy}`]}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Split Workspace: Primary List/Cards + Right-Side 360° Live Policy Definition Inspector */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className={cn(selected ? "xl:col-span-8" : "xl:col-span-12")}>
            {viewMode === "table" ? (
              <DataTable
                density="compact"
                columns={columns}
                rows={filteredItems}
                isLoading={configuration.isLoading}
                error={configuration.queryError}
                onRetry={() => void configuration.reload()}
                page={configuration.pageInfo}
                onPageChange={configuration.setPage}
                rowKey={(definition) => definition.id}
                onRowClick={(definition) => configuration.setSelectedId(definition.id)}
                labels={{
                  retry: t.common.retry,
                  errorTitle: t.trade.definitionLoadFailed,
                  emptyTitle: t.trade.definitionEmpty,
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
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredItems.map((definition) => {
                  const riskKey = isRiskClass(definition.riskClass)
                    ? definition.riskClass
                    : "MEDIUM";
                  const riskPalette = RISK_CLASS_PALETTES[riskKey];
                  const mergeKey = isMergeStrategy(definition.mergeStrategy)
                    ? definition.mergeStrategy
                    : "OVERRIDE";
                  const mergeInfo = MERGE_STRATEGY_INFO[mergeKey];
                  const isSelected = selected?.id === definition.id;
                  return (
                    <div
                      key={definition.id}
                      onClick={() => configuration.setSelectedId(definition.id)}
                      className={cn(
                        "relative cursor-pointer overflow-hidden rounded-lg border bg-card p-4 shadow-xs transition-all hover:shadow-md",
                        isSelected
                          ? cn("ring-2 ring-primary/30", riskPalette.cardBorderClass)
                          : "border-border",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute inset-x-0 top-0 h-1.5",
                          riskPalette.topAccentClass,
                        )}
                      />
                      <div className="flex items-start justify-between gap-2 pt-1">
                        <IdentifierText className="truncate text-xs font-semibold text-foreground">
                          {definition.key}
                        </IdentifierText>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold",
                            riskPalette.badgeClass,
                          )}
                        >
                          <span className={cn("size-1.5 rounded-full", riskPalette.dotClass)} />
                          {isRiskClass(definition.riskClass)
                            ? t.trade[`riskClass_${definition.riskClass}`]
                            : definition.riskClass}
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {describeValueSchemaHumanReadable(definition.valueSchema, lang)}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold",
                            mergeInfo.badgeClass,
                          )}
                        >
                          <GitMerge className="size-3" aria-hidden="true" />
                          {isMergeStrategy(definition.mergeStrategy)
                            ? t.trade[`mergeStrategy_${definition.mergeStrategy}`]
                            : definition.mergeStrategy}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <Badge tone="neutral">
                            <Layers className="me-1 size-3" aria-hidden="true" />
                            {definition.versions.length}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspecting(definition);
                            }}
                          >
                            <Eye className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right-Side 360° Live Policy Definition Inspector */}
          {selected && (
            <aside className="xl:col-span-4">
              {(() => {
                const riskKey = isRiskClass(selected.riskClass)
                  ? selected.riskClass
                  : "MEDIUM";
                const riskPalette = RISK_CLASS_PALETTES[riskKey];
                const mergeKey = isMergeStrategy(selected.mergeStrategy)
                  ? selected.mergeStrategy
                  : "OVERRIDE";
                const mergeInfo = MERGE_STRATEGY_INFO[mergeKey];
                const humanSchema = describeValueSchemaHumanReadable(
                  selected.valueSchema,
                  lang,
                );
                return (
                  <div
                    className={cn(
                      "sticky top-4 overflow-hidden rounded-lg border bg-card p-4 shadow-xs",
                      riskPalette.cardBorderClass,
                    )}
                  >
                    <div
                      className={cn(
                        "-mx-4 -mt-4 mb-3.5 h-1.5",
                        riskPalette.topAccentClass,
                      )}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {copy.inspectorTitle}
                        </span>
                        <h3 className="mt-0.5 truncate text-xs font-semibold text-foreground">
                          <IdentifierText>{selected.key}</IdentifierText>
                        </h3>
                      </div>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold",
                          riskPalette.badgeClass,
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", riskPalette.dotClass)} />
                        {isRiskClass(selected.riskClass)
                          ? t.trade[`riskClass_${selected.riskClass}`]
                          : selected.riskClass}
                      </span>
                    </div>

                    <div className="mt-3 rounded-md border border-border/80 bg-muted/25 p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {t.trade.definitionMergeStrategy}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold",
                            mergeInfo.badgeClass,
                          )}
                        >
                          <GitMerge className="size-3" aria-hidden="true" />
                          {isMergeStrategy(selected.mergeStrategy)
                            ? t.trade[`mergeStrategy_${selected.mergeStrategy}`]
                            : selected.mergeStrategy}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {mergeInfo.summaries[lang]}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border border-border/60 bg-card p-2">
                        <span className="text-xs text-muted-foreground">
                          {copy.valueConstraintType}
                        </span>
                        <p className="mt-0.5 font-semibold text-foreground">{humanSchema}</p>
                      </div>
                      <div className="rounded-md border border-border/60 bg-card p-2">
                        <span className="text-xs text-muted-foreground">
                          {t.trade.versionsTitle}
                        </span>
                        <p className="mt-0.5 font-semibold text-foreground">
                          {selected.versions.length}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="flex-1"
                        onClick={() => setInspecting(selected)}
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                        {copy.inspectFullModalBtn}
                      </Button>
                      {configuration.canManage && (
                        <Button
                          type="button"
                          variant="primary"
                          size="xs"
                          onClick={() => configuration.openVersion(selected)}
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                          {t.trade.versionCreate}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </aside>
          )}
        </div>

        {selected ? (
          <VersionsPanel
            definition={selected}
            canManage={configuration.canManage}
            canPublish={configuration.canPublish}
            isSubmitting={configuration.isSubmitting}
            report={configuration.report}
            onCreate={() => configuration.openVersion(selected)}
            onAction={(version, action) => void configuration.runVersionAction(version, action)}
          />
        ) : null}

        <ResolvePanel />

        <DefaultPriceBooksPanel />

        <CreateDefinitionDrawer
          key={configuration.createOpen ? "create-open" : "create-closed"}
          isOpen={configuration.createOpen}
          isSubmitting={configuration.isSubmitting}
          error={configuration.formError}
          onClose={configuration.closeCreate}
          onSubmit={configuration.createDefinition}
        />

        {configuration.versionFor ? (
          <CreateVersionDrawer
            key={configuration.versionFor.id}
            definition={configuration.versionFor}
            isSubmitting={configuration.isSubmitting}
            error={configuration.formError}
            onClose={configuration.closeVersion}
            onSubmit={configuration.createVersion}
          />
        ) : null}

        <ConfigurationInspectModal
          definition={inspecting}
          canManage={configuration.canManage}
          onClose={() => setInspecting(null)}
          onCreateVersion={(definition) => configuration.openVersion(definition)}
        />
      </div>
    </PermissionGate>
  );
}
