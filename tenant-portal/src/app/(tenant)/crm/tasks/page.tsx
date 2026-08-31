"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Button,
  DataTable,
  DegradedBanner,
  EmptyState,
  FilterBar,
  PageHeader,
  PermissionGate,
  useToast,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { useCrmActivityCapabilities } from "@/hooks/useCrmActivityCapabilities";
import { formatTemplate } from "@/lib/format/template";
import type { NormalizedApiError } from "@/lib/api/errors";
import {
  CRM_TASK_STATUSES,
  type CrmTask,
  type CrmTaskStatus,
} from "../activities/activity-contract";
import { CreateTaskDrawer } from "./components/CreateTaskDrawer";
import { EditTaskDrawer } from "./components/EditTaskDrawer";
import { useTaskColumns } from "./components/useTaskColumns";
import { useCrmTasks, type TaskWriteResult } from "./hooks/useCrmTasks";

export default function CrmTasksPage() {
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
    status,
    setStatus,
    search,
    setSearch,
    setPage,
    create,
    update,
    reload,
  } = useCrmTasks();
  // S6 / D11: create admission comes from the capabilities endpoint, which
  // accounts for branch and owner scope; a permission string does not.
  const capabilities = useCrmActivityCapabilities(branchId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>(undefined);
  const [editTask, setEditTask] = useState<CrmTask | null>(null);
  const [editError, setEditError] = useState<string | undefined>(undefined);

  function describeFailure(error: NormalizedApiError): string {
    return t.crmTasks.errors[error.code ?? ""] ?? t.crmTasks.actionFailed;
  }

  function report(result: TaskWriteResult, successTitle: string): boolean {
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

  const columns = useTaskColumns({
    canUpdate,
    isSubmitting,
    onEdit: (task) => {
      setEditError(undefined);
      setEditTask(task);
    },
  });

  return (
    <PermissionGate require="crm.activities.read" scoped>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.crmTasks.pageTitle}
          description={t.crmTasks.subtitle}
          primaryAction={
            capabilities.canCreate && branchId
              ? {
                  label: t.crmTasks.add,
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

        {/* A capabilities call that could not be ASKED is not the same as a
            403 answer, and hiding the create control for a network blip would
            be indistinguishable from "you may not". */}
        {capabilities.error ? (
          <DegradedBanner message={t.crmTasks.capabilitiesUnavailable} />
        ) : null}

        <FilterBar
          filters={[
            {
              id: "status",
              kind: "select",
              label: t.common.status,
              placeholder: t.crmTasks.allStatuses,
              options: CRM_TASK_STATUSES.map((value) => ({
                value,
                label: t.statusValues[`CrmTaskStatus.${value}`] ?? value,
              })),
            },
          ]}
          values={status ? { status: { kind: "select", value: status } } : {}}
          onChange={(next) => {
            const value = next.status;
            setStatus(
              value && value.kind === "select"
                ? (value.value as CrmTaskStatus)
                : "",
            );
          }}
          onReset={() => {
            setStatus("");
            setSearch("");
          }}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t.crmTasks.search}
          clearAllLabel={t.common.dismiss}
          moreChipsLabel={t.crmPipelines.moreChips}
          removeChipLabel={t.crmPipelines.removeChip}
          overflowChipsLabel={t.crmPipelines.overflowChips}
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
            rowKey={(task) => task.id}
            page={pageInfo}
            onPageChange={setPage}
            labels={{
              retry: t.common.retry,
              errorTitle: t.crmTasks.loadFailed,
              emptyTitle:
                status || search.trim()
                  ? t.crmTasks.emptyFiltered
                  : t.crmTasks.empty,
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
          <CreateTaskDrawer
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
                  report(result, t.crmTasks.created);
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

        <EditTaskDrawer
          key={editTask?.id ?? "closed"}
          task={editTask}
          isSubmitting={isSubmitting}
          error={editError}
          onClose={() => {
            setEditError(undefined);
            setEditTask(null);
          }}
          onSubmit={(input) => {
            const target = editTask;
            if (!target) return;
            void update(target, input).then((result) => {
              if (result.ok) {
                setEditTask(null);
                report(result, t.crmTasks.updated);
                return;
              }
              setEditError(
                result.error ? describeFailure(result.error) : undefined,
              );
              if (result.error) toast.outcomeFromApi(result.error);
            });
          }}
        />
      </div>
    </PermissionGate>
  );
}
