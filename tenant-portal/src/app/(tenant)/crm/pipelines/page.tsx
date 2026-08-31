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
import { PipelineFormDrawer } from "./components/PipelineFormDrawer";
import { usePipelineColumns } from "./components/usePipelineColumns";
import { usePipelines, type PipelineWriteResult } from "./hooks/usePipelines";
import type { Pipeline } from "./pipeline-contract";

const CRM_SETUP_ITEMS =
  NAV_SECTIONS.find((section) => section.id === "crmSetup")?.items ?? [];

export default function PipelinesPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const {
    items,
    hasLoaded,
    isLoading,
    isCreating,
    pendingId,
    queryError,
    canManage,
    searchQuery,
    setSearchQuery,
    create,
    remove,
    setDefault,
    reload,
  } = usePipelines();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<Pipeline | null>(null);

  function describeFailure(error: NormalizedApiError): string {
    const code = error.code ?? "";
    return t.crmPipelines.errors[code] ?? t.crmPipelines.actionFailed;
  }

  function report(result: PipelineWriteResult, successTitle: string): boolean {
    if (result.ok) {
      // A replay means the write already ran once — it is a success, never a
      // duplicate error (S8).
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

  const columns = usePipelineColumns({
    canManage,
    pendingId,
    onSetDefault: (pipeline) => {
      void setDefault(pipeline.id).then((result) =>
        report(result, t.crmPipelines.defaultChanged),
      );
    },
    onDelete: setPendingDelete,
  });

  return (
    <PermissionGate require="crm.pipelines.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.crmPipelines.title}
          description={t.crmPipelines.subtitle}
          primaryAction={
            canManage
              ? {
                  label: t.crmPipelines.add,
                  onClick: () => {
                    setCreateError(undefined);
                    setIsCreateOpen(true);
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

        {/* Readable but not writable, and permanently so for this actor —
            that is a read-only surface with a reason, not a `disabled`
            control and not an error (docs/design/states.md, state 5). The
            subscription `ReadOnlyGate` is a different thing and is not
            what applies here. */}
        {canManage ? null : (
          <p
            role="note"
            className="rounded-sm border border-border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground"
          >
            {t.crmPipelines.readOnlyReason}
          </p>
        )}

        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => undefined}
          onReset={() => undefined}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.crmPipelines.search}
        />

        {/* No pagination: GET /pipelines and GET /pipelines/configuration
            declare no page/limit query at all — the whole catalogue comes back
            in one array (pipelines.controller.ts). Rendering a page control
            over it would be the fabricated-pagination failure in
            docs/design/states.md#pagination-is-real-or-absent. */}
        <DataTable
          columns={columns}
          rows={items}
          isLoading={isLoading && !hasLoaded}
          error={queryError}
          onRetry={() => void reload()}
          rowKey={(pipeline) => pipeline.id}
          onRowClick={(pipeline) => router.push(`/crm/pipelines/${pipeline.id}`)}
          labels={{
            retry: t.common.retry,
            errorTitle: t.crmPipelines.loadFailed,
            emptyTitle: searchQuery.trim()
              ? t.crmPipelines.emptyFiltered
              : t.crmPipelines.empty,
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

        {/* Remounted per opening so the form starts empty without an
            effect syncing props into state. */}
        <PipelineFormDrawer
          key={isCreateOpen ? "open" : "closed"}
          open={isCreateOpen}
          onOpenChange={(open) => {
            if (!open) setCreateError(undefined);
            setIsCreateOpen(open);
          }}
          isSubmitting={isCreating}
          error={createError}
          onSubmit={(input) => {
            void create(input).then((result) => {
              if (result.ok) {
                setIsCreateOpen(false);
                setCreateError(undefined);
                report(result, t.crmPipelines.created);
                return;
              }
              setCreateError(
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
          title={t.crmPipelines.deleteTitle}
          description={formatTemplate(t.crmPipelines.deleteDescription, {
            name: pendingDelete ? localizedName(pendingDelete, lang) : "",
          })}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          loading={pendingId !== null}
          onConfirm={() => {
            const target = pendingDelete;
            if (!target) return;
            void remove(target.id).then((result) => {
              if (report(result, t.crmPipelines.deleted)) setPendingDelete(null);
            });
          }}
        />
      </div>
    </PermissionGate>
  );
}
