"use client";

import { useState } from "react";
import { Pencil, RefreshCw } from "lucide-react";
import {
  Button,
  DataTable,
  DateTime,
  DegradedBanner,
  EmptyState,
  FilterBar,
  PageHeader,
  PermissionGate,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useToast,
  type ColumnDef,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { useCrmActivityCapabilities } from "@/hooks/useCrmActivityCapabilities";
import { formatTemplate } from "@/lib/format/template";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { CrmCalendarEvent } from "../activities/activity-contract";
import { CalendarEventDrawer } from "./components/CalendarEventDrawer";
import {
  useCrmCalendarEvents,
  type EventWriteResult,
} from "./hooks/useCrmCalendarEvents";

export default function CrmCalendarPage() {
  const { t } = useI18n();
  const toast = useToast();
  const {
    items,
    pageInfo,
    hasLoaded,
    isLoading,
    isSubmitting,
    queryError,
    canUpdate,
    branchIds,
    branchId,
    selectBranch,
    search,
    setSearch,
    setPage,
    create,
    update,
    reload,
  } = useCrmCalendarEvents();
  const capabilities = useCrmActivityCapabilities(branchId);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerEvent, setDrawerEvent] = useState<CrmCalendarEvent | null>(null);
  const [drawerError, setDrawerError] = useState<string | undefined>(undefined);

  function describeFailure(error: NormalizedApiError): string {
    return t.crmCalendar.errors[error.code ?? ""] ?? t.crmCalendar.actionFailed;
  }

  function report(result: EventWriteResult, successTitle: string): boolean {
    if (result.ok) {
      if (result.replayed) {
        toast.info(
          t.errors.idempotencyReplayedTitle,
          t.errors.idempotencyReplayedDescription,
        );
      } else {
        toast.success(successTitle);
      }
      return true;
    }
    if (result.error && !toast.outcomeFromApi(result.error)) {
      toast.errorFromApi(describeFailure(result.error), result.error);
    }
    return false;
  }

  function handleResult(result: EventWriteResult, isEdit: boolean) {
    if (result.ok) {
      setIsDrawerOpen(false);
      setDrawerEvent(null);
      report(result, isEdit ? t.crmCalendar.updated : t.crmCalendar.created);
      return;
    }
    setDrawerError(result.error ? describeFailure(result.error) : undefined);
    if (result.error) toast.outcomeFromApi(result.error);
  }

  const columns: ColumnDef<CrmCalendarEvent>[] = [
    {
      id: "title",
      header: t.crmCalendar.title,
      cell: (event) => (
        <span className="font-medium text-foreground">{event.title}</span>
      ),
    },
    {
      id: "startsAt",
      header: t.crmCalendar.startsAt,
      cell: (event) => <DateTime value={event.startsAt} />,
    },
    {
      id: "endsAt",
      header: t.crmCalendar.endsAt,
      cell: (event) => <DateTime value={event.endsAt} />,
    },
    {
      id: "source",
      header: t.crmCalendar.sourceType,
      cell: (event) => (
        <span className="text-xs text-muted-foreground">
          {event.sourceType
            ? (t.crmTasks.sourceTypeValues[event.sourceType] ?? event.sourceType)
            : t.common.noData}
        </span>
      ),
    },
  ];

  if (canUpdate) {
    columns.push({
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (event) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              aria-label={`${t.crmCalendar.editTitle}: ${event.title}`}
              onClick={() => {
                setDrawerError(undefined);
                setDrawerEvent(event);
                setIsDrawerOpen(true);
              }}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t.crmCalendar.editTitle}</TooltipContent>
        </Tooltip>
      ),
    });
  }

  return (
    <PermissionGate require="crm.activities.read" scoped>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.crmCalendar.pageTitle}
          description={t.crmCalendar.subtitle}
          primaryAction={
            capabilities.canCreate && branchId
              ? {
                  label: t.crmCalendar.add,
                  onClick: () => {
                    setDrawerError(undefined);
                    setDrawerEvent(null);
                    setIsDrawerOpen(true);
                  },
                }
              : undefined
          }
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

        {capabilities.error ? (
          <DegradedBanner message={t.crmTasks.capabilitiesUnavailable} />
        ) : null}

        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => undefined}
          onReset={() => setSearch("")}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t.crmCalendar.search}
          clearAllLabel={t.common.dismiss}
        />

        {!branchId ? (
          <EmptyState
            title={t.crmActivities.branchRequiredTitle}
            description={t.crmActivities.branchRequiredDescription}
          />
        ) : (
          /* listScopedEvents orders by `e.starts_at DESC`, hardcoded — the
             shared sortBy/sortDir are accepted and ignored, so no column
             offers a sort the server would not honour. */
          <DataTable
            columns={columns}
            rows={items}
            isLoading={isLoading && !hasLoaded}
            error={queryError}
            onRetry={() => void reload()}
            rowKey={(event) => event.id}
            page={pageInfo}
            onPageChange={setPage}
            labels={{
              retry: t.common.retry,
              errorTitle: t.crmCalendar.loadFailed,
              emptyTitle: search.trim()
                ? t.crmCalendar.emptyFiltered
                : t.crmCalendar.empty,
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

        {branchId ? (
          <CalendarEventDrawer
            key={`${drawerEvent?.id ?? "new"}-${isDrawerOpen}`}
            open={isDrawerOpen}
            onOpenChange={(open) => {
              if (!open) {
                setDrawerError(undefined);
                setDrawerEvent(null);
              }
              setIsDrawerOpen(open);
            }}
            branchId={branchId}
            event={drawerEvent}
            isSubmitting={isSubmitting}
            error={drawerError}
            onCreate={(input) => {
              void create(input).then((result) => handleResult(result, false));
            }}
            onUpdate={(input) => {
              const target = drawerEvent;
              if (!target) return;
              void update(target, input).then((result) =>
                handleResult(result, true),
              );
            }}
          />
        ) : null}
      </div>
    </PermissionGate>
  );
}
