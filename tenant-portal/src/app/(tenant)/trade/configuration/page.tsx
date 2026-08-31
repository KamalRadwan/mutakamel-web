"use client";

import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  PageHeader,
  PermissionGate,
  SubNav,
  TRADE_FOUNDATION_NAV_ITEMS,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { TradeScopeBar } from "../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../trade-scope";
import {
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
  isConfigurationScope,
  isMergeStrategy,
  isRiskClass,
  type ConfigurationDefinition,
} from "./configuration-contract";

export default function TradeConfigurationPage() {
  const { t } = useI18n();
  const configuration = useConfigurationDefinitions();
  const selected =
    configuration.items.find((definition) => definition.id === configuration.selectedId) ?? null;

  const columns: ColumnDef<ConfigurationDefinition>[] = [
    {
      id: "key",
      header: t.trade.definitionKey,
      cell: (definition) => <span className="font-mono text-xs">{definition.key}</span>,
    },
    {
      id: "mergeStrategy",
      header: t.trade.definitionMergeStrategy,
      cell: (definition) =>
        isMergeStrategy(definition.mergeStrategy)
          ? t.trade[`mergeStrategy_${definition.mergeStrategy}`]
          : definition.mergeStrategy,
    },
    {
      id: "riskClass",
      header: t.trade.definitionRiskClass,
      // Risk is a category, not an outcome, so it takes the neutral tone —
      // colouring it would be the hue-coded-control anti-pattern.
      cell: (definition) => (
        <Badge tone="neutral">
          {isRiskClass(definition.riskClass)
            ? t.trade[`riskClass_${definition.riskClass}`]
            : definition.riskClass}
        </Badge>
      ),
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
  ];

  return (
    <PermissionGate require={TRADE_PERMISSIONS.configurationRead}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.trade.configurationTitle}
          description={t.trade.configurationSubtitle}
          primaryAction={
            configuration.canManage
              ? { label: t.trade.definitionCreate, onClick: configuration.openCreate }
              : undefined
          }
          secondaryActions={
            <Button
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

        <SubNav items={TRADE_FOUNDATION_NAV_ITEMS} />

        <TradeScopeBar />

        {/* Selecting a row opens its versions below. trade-app publishes no GET
            for a single definition, so a detail ROUTE would have to page the
            whole list to render one record — see Q71. */}
        <DataTable
          columns={columns}
          rows={configuration.items}
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
      </div>
    </PermissionGate>
  );
}
