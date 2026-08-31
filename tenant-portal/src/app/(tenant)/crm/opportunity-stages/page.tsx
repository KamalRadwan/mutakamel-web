"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  DataTable,
  FilterBar,
  PageHeader,
  PermissionGate,
  SubNav,
  NAV_SECTIONS,
  useToast,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { OpportunityStageDefinition } from "../pipelines/pipeline-contract";
import { OpportunityStageDrawer } from "./components/OpportunityStageDrawer";
import { useOpportunityStageColumns } from "./components/useOpportunityStageColumns";
import {
  useOpportunityStages,
  type StageWriteResult,
} from "./hooks/useOpportunityStages";

const CRM_SETUP_ITEMS =
  NAV_SECTIONS.find((section) => section.id === "crmSetup")?.items ?? [];

export default function OpportunityStagesPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const {
    items,
    hasLoaded,
    isLoading,
    isSubmitting,
    pendingId,
    queryError,
    canManage,
    searchQuery,
    setSearchQuery,
    create,
    update,
    remove,
    reload,
  } = useOpportunityStages();
  const [drawerStage, setDrawerStage] =
    useState<OpportunityStageDefinition | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerError, setDrawerError] = useState<string | undefined>(undefined);
  const [pendingDelete, setPendingDelete] =
    useState<OpportunityStageDefinition | null>(null);

  function describeFailure(error: NormalizedApiError): string {
    return (
      t.crmOpportunityStages.errors[error.code ?? ""] ??
      t.crmOpportunityStages.actionFailed
    );
  }

  function report(result: StageWriteResult, successTitle: string): boolean {
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

  const columns = useOpportunityStageColumns({
    canManage,
    pendingId,
    onEdit: (stage) => {
      setDrawerError(undefined);
      setDrawerStage(stage);
      setIsDrawerOpen(true);
    },
    onDelete: setPendingDelete,
  });

  // Every route in opportunity-stages.controller.ts declares
  // @RequirePermissions('crm.pipelines.manage') — including the two GETs. The
  // read permission would admit an actor whose every request 403s.
  return (
    <PermissionGate require="crm.pipelines.manage">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.crmOpportunityStages.title}
          description={t.crmOpportunityStages.subtitle}
          primaryAction={
            canManage
              ? {
                  label: t.crmOpportunityStages.add,
                  onClick: () => {
                    setDrawerError(undefined);
                    setDrawerStage(null);
                    setIsDrawerOpen(true);
                  },
                }
              : undefined
          }
          secondaryActions={
            <Button
              variant="outline"
              onClick={() => void reload()}
              disabled={isLoading}
            >
              <RefreshCw
                className={`size-4 ${isLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {t.common.retry}
            </Button>
          }
        />

        <SubNav items={CRM_SETUP_ITEMS} />

        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => undefined}
          onReset={() => undefined}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.crmOpportunityStages.search}
        />

        {/* GET /opportunity-stages takes no pagination query — the whole
            catalogue is one array. states.md#pagination-is-real-or-absent. */}
        <DataTable
          columns={columns}
          rows={items}
          isLoading={isLoading && !hasLoaded}
          error={queryError}
          onRetry={() => void reload()}
          rowKey={(stage) => stage.id}
          onRowClick={(stage) =>
            router.push(`/crm/opportunity-stages/${stage.id}`)
          }
          labels={{
            retry: t.common.retry,
            errorTitle: t.crmOpportunityStages.loadFailed,
            emptyTitle: searchQuery.trim()
              ? t.crmOpportunityStages.emptyFiltered
              : t.crmOpportunityStages.empty,
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

        <OpportunityStageDrawer
          key={`${drawerStage?.id ?? "new"}-${isDrawerOpen}`}
          open={isDrawerOpen}
          onOpenChange={(open) => {
            if (!open) setDrawerError(undefined);
            setIsDrawerOpen(open);
          }}
          stage={drawerStage}
          isSubmitting={isSubmitting}
          error={drawerError}
          onSubmit={(input) => {
            const action = drawerStage
              ? update(drawerStage, input)
              : create(input);
            void action.then((result) => {
              if (result.ok) {
                setIsDrawerOpen(false);
                report(
                  result,
                  drawerStage
                    ? t.crmOpportunityStages.updated
                    : t.crmOpportunityStages.created,
                );
                return;
              }
              setDrawerError(
                result.error ? describeFailure(result.error) : undefined,
              );
              if (result.error) toast.outcomeFromApi(result.error);
            });
          }}
        />

        <ConfirmActionModal
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          title={t.crmOpportunityStages.deleteTitle}
          description={formatTemplate(t.crmOpportunityStages.deleteDescription, {
            name: pendingDelete ? localizedName(pendingDelete, lang) : "",
          })}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          loading={pendingId !== null}
          onConfirm={() => {
            const target = pendingDelete;
            if (!target) return;
            void remove(target.id).then((result) => {
              if (report(result, t.crmOpportunityStages.deleted)) {
                setPendingDelete(null);
              }
            });
          }}
        />
      </div>
    </PermissionGate>
  );
}
