"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DateTime,
  EmptyState,
  FilterBar,
  PageHeader,
  PermissionGate,
  StatusBadge,
  type ColumnDef,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  CRM_ACTIVITY_TYPES,
  type CrmActivity,
  type CrmActivityType,
} from "./activity-contract";
import { ActivityDetailDrawer } from "./components/ActivityDetailDrawer";
import { useCrmActivities } from "./hooks/useCrmActivities";

export default function CrmActivitiesPage() {
  const { t } = useI18n();
  const {
    items,
    pageInfo,
    hasLoaded,
    isLoading,
    queryError,
    branchIds,
    branchId,
    selectBranch,
    filters,
    setFilter,
    resetFilters,
    setPage,
    reload,
  } = useCrmActivities();
  const [selected, setSelected] = useState<CrmActivity | null>(null);

  const columns: ColumnDef<CrmActivity>[] = [
    {
      id: "subject",
      header: t.crmActivities.subject,
      cell: (activity) => (
        <span className="font-medium text-foreground">{activity.subject}</span>
      ),
    },
    {
      id: "type",
      header: t.crmActivities.type,
      cell: (activity) => (
        <Badge tone="neutral">
          {t.crmActivities.typeValues[activity.type] ?? activity.type}
        </Badge>
      ),
    },
    {
      id: "source",
      header: t.crmActivities.source,
      cell: (activity) => (
        <span className="text-xs text-muted-foreground">
          {t.crmActivities.sourceTypes[activity.sourceType] ??
            activity.sourceType}
        </span>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (activity) => (
        <StatusBadge kind="CrmActivityStatus" value={activity.status} />
      ),
    },
    {
      id: "activityAt",
      header: t.crmActivities.activityAt,
      cell: (activity) =>
        activity.activityAt ? (
          <DateTime value={activity.activityAt} />
        ) : (
          <span className="text-muted-foreground">{t.common.noData}</span>
        ),
    },
  ];

  return (
    <PermissionGate require="crm.activities.read" scoped>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.crmActivities.title}
          description={t.crmActivities.subtitle}
          secondaryActions={
            <div className="flex items-center gap-2">
              <TenantBranchSelect
                branchIds={branchIds}
                branchId={branchId}
                onChange={selectBranch}
              />
              <Button
                variant="outline"
                onClick={() => void reload()}
                disabled={isLoading || !branchId}
              >
                <RefreshCw
                  className={`size-4 ${isLoading ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {t.common.retry}
              </Button>
            </div>
          }
        />

        <FilterBar
          filters={[
            {
              id: "type",
              kind: "select",
              label: t.crmActivities.type,
              placeholder: t.crmActivities.allTypes,
              options: CRM_ACTIVITY_TYPES.map((type) => ({
                value: type,
                label: t.crmActivities.typeValues[type] ?? type,
              })),
            },
          ]}
          values={
            filters.type
              ? { type: { kind: "select", value: filters.type } }
              : {}
          }
          onChange={(next) => {
            const value = next.type;
            setFilter(
              "type",
              value && value.kind === "select"
                ? (value.value as CrmActivityType)
                : "",
            );
          }}
          onReset={resetFilters}
          searchValue={filters.search}
          onSearchChange={(query) => setFilter("search", query)}
          searchPlaceholder={t.crmActivities.search}
          clearAllLabel={t.common.dismiss}
          moreChipsLabel={t.crmPipelines.moreChips}
          removeChipLabel={t.crmPipelines.removeChip}
          overflowChipsLabel={t.crmPipelines.overflowChips}
        />

        {/* A branch that cannot be resolved is a setup gap, not a failure —
            "nothing is configured" is an empty state
            (docs/design/states.md). Every CRM list is branch-scoped and a
            request without one is a 422, so nothing is fetched until it
            resolves. */}
        {!branchId ? (
          <EmptyState
            title={t.crmActivities.branchRequiredTitle}
            description={t.crmActivities.branchRequiredDescription}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            isLoading={isLoading && !hasLoaded}
            error={queryError}
            onRetry={() => void reload()}
            rowKey={(activity) => activity.id}
            onRowClick={setSelected}
            page={pageInfo}
            onPageChange={setPage}
            labels={{
              retry: t.common.retry,
              errorTitle: t.crmActivities.loadFailed,
              emptyTitle:
                filters.type || filters.search.trim()
                  ? t.crmActivities.emptyFiltered
                  : t.crmActivities.empty,
              selectAll: t.views.selectAll,
              selectRow: t.views.selectItem,
              sortAscending: t.views.sortAscending,
              sortDescending: t.views.sortDescending,
              notSorted: t.views.notSorted,
              pagination: {
                previous: t.common.previousPage,
                next: t.common.nextPage,
                summary: (from, to, total) =>
                  formatTemplate(t.common.showingOf, { from, to, total }),
              },
            }}
          />
        )}

        {/* No create control: POST /activities requires the sourceType and
            sourceId of the record being logged against, so logging belongs on
            that record's own screen rather than on a cross-record log. */}
        <ActivityDetailDrawer
          activity={selected}
          onClose={() => setSelected(null)}
        />
      </div>
    </PermissionGate>
  );
}
