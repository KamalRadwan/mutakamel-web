"use client";

import { useState } from "react";
import { BellOff, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  DataTable,
  DateTime,
  DegradedBanner,
  EmptyState,
  FilterBar,
  PageHeader,
  PermissionGate,
  StatusBadge,
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
import {
  CRM_REMINDER_STATUSES,
  type CrmReminder,
  type CrmReminderStatus,
} from "../activities/activity-contract";
import { CreateReminderDrawer } from "./components/CreateReminderDrawer";
import {
  useCrmReminders,
  type ReminderWriteResult,
} from "./hooks/useCrmReminders";

export default function CrmRemindersPage() {
  const { t } = useI18n();
  const toast = useToast();
  const {
    items,
    pageInfo,
    hasLoaded,
    isLoading,
    isSubmitting,
    pendingId,
    queryError,
    canCancel,
    branchIds,
    branchId,
    selectBranch,
    status,
    setStatus,
    setPage,
    create,
    cancel,
    reload,
  } = useCrmReminders();
  const capabilities = useCrmActivityCapabilities(branchId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>(undefined);
  const [pendingCancel, setPendingCancel] = useState<CrmReminder | null>(null);

  function describeFailure(error: NormalizedApiError): string {
    return (
      t.crmReminders.errors[error.code ?? ""] ?? t.crmReminders.actionFailed
    );
  }

  function report(result: ReminderWriteResult, successTitle: string): boolean {
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

  const columns: ColumnDef<CrmReminder>[] = [
    {
      id: "remindAt",
      header: t.crmReminders.remindAt,
      cell: (reminder) => <DateTime value={reminder.remindAt} />,
    },
    {
      id: "targetType",
      header: t.crmReminders.targetType,
      cell: (reminder) => (
        <Badge tone="neutral">
          {t.crmReminders.targetTypeValues[reminder.targetType] ??
            reminder.targetType}
        </Badge>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (reminder) => (
        <StatusBadge kind="CrmReminderStatus" value={reminder.status} />
      ),
    },
  ];

  if (canCancel) {
    columns.push({
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (reminder) =>
        // Only a PENDING reminder can be cancelled; the service returns a
        // CANCELLED one unchanged, so offering the control on a SENT or
        // already-cancelled row would promise an action with no effect.
        reminder.status === "PENDING" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={pendingId !== null}
                aria-label={t.crmReminders.cancelReminder}
                onClick={() => setPendingCancel(reminder)}
              >
                <BellOff className="size-4 text-destructive" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.crmReminders.cancelReminder}</TooltipContent>
          </Tooltip>
        ) : null,
    });
  }

  return (
    <PermissionGate require="crm.activities.read" scoped>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.crmReminders.pageTitle}
          description={t.crmReminders.subtitle}
          primaryAction={
            capabilities.canCreate && branchId
              ? {
                  label: t.crmReminders.add,
                  onClick: () => {
                    setCreateError(undefined);
                    setIsCreateOpen(true);
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

        {/* No search box: listScopedReminders passes no search predicate, so
            one would filter nothing. */}
        <FilterBar
          filters={[
            {
              id: "status",
              kind: "select",
              label: t.common.status,
              placeholder: t.crmReminders.allStatuses,
              options: CRM_REMINDER_STATUSES.map((value) => ({
                value,
                label: t.statusValues[`CrmReminderStatus.${value}`] ?? value,
              })),
            },
          ]}
          values={status ? { status: { kind: "select", value: status } } : {}}
          onChange={(next) => {
            const value = next.status;
            setStatus(
              value && value.kind === "select"
                ? (value.value as CrmReminderStatus)
                : "",
            );
          }}
          onReset={() => setStatus("")}
          searchValue=""
          onSearchChange={() => undefined}
          clearAllLabel={t.common.dismiss}
        />

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
            rowKey={(reminder) => reminder.id}
            page={pageInfo}
            onPageChange={setPage}
            labels={{
              retry: t.common.retry,
              errorTitle: t.crmReminders.loadFailed,
              emptyTitle: status
                ? t.crmReminders.emptyFiltered
                : t.crmReminders.empty,
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
          <CreateReminderDrawer
            key={isCreateOpen ? "open" : "closed"}
            open={isCreateOpen}
            onOpenChange={(open) => {
              if (!open) setCreateError(undefined);
              setIsCreateOpen(open);
            }}
            branchId={branchId}
            isSubmitting={isSubmitting}
            error={createError}
            onSubmit={(input) => {
              void create(input).then((result) => {
                if (result.ok) {
                  setIsCreateOpen(false);
                  report(result, t.crmReminders.created);
                  return;
                }
                setCreateError(
                  result.error ? describeFailure(result.error) : undefined,
                );
                if (result.error) toast.outcomeFromApi(result.error);
              });
            }}
          />
        ) : null}

        <ConfirmActionModal
          open={pendingCancel !== null}
          onOpenChange={(open) => {
            if (!open) setPendingCancel(null);
          }}
          title={t.crmReminders.cancelTitle}
          description={t.crmReminders.cancelDescription}
          confirmLabel={t.crmReminders.cancelReminder}
          cancelLabel={t.common.cancel}
          loading={pendingId !== null}
          onConfirm={() => {
            const target = pendingCancel;
            if (!target) return;
            void cancel(target).then((result) => {
              if (report(result, t.crmReminders.cancelled)) {
                setPendingCancel(null);
              }
            });
          }}
        />
      </div>
    </PermissionGate>
  );
}
