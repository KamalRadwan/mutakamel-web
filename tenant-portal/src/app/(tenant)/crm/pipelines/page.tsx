"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  DataTable,
  Input,
  PageHeader,
  PermissionGate,
  SubNav,
  NAV_SECTIONS,
  cn,
  iconSize,
  useToast,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import type { NormalizedApiError } from "@/lib/api/errors";
import { CreatePipelineModal } from "./components/CreatePipelineModal";
import { useOpportunityStageCatalogue } from "./hooks/useOpportunityStageCatalogue";
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
  const stageCatalogue = useOpportunityStageCatalogue(isCreateOpen);
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

        {/* One search box, filtering the array already on the screen — and
            that is not a shortcut past a server search, it is the only search
            this endpoint permits. `GET /crm/pipelines` is
            `findAll(@CurrentActor() actor)` and `GET /pipelines/configuration`
            is the same shape (pipelines.controller.ts): NO query parameters
            at all, no page, no search, no filter. There is literally nothing
            to send.

            No field picker either, unlike the leads and customer lists: those
            offer one because their endpoint answers several filters, and a
            picker over a single choice is a control with nothing to choose.
            Name and code are the only two things a pipeline row has to match
            on, and one box matches both.

            Not a `FilterBar`: it was called here with `filters={[]}` and no-op
            handlers — a bare search box wearing a chip bar's clothes — and its
            own 300ms debounce delayed a filter that never leaves the browser. */}
        <div className="relative w-72">
          <Search
            className={cn(
              iconSize({ size: "md" }),
              "pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <Input
            size="sm"
            className="ps-8"
            value={searchQuery}
            placeholder={t.crmPipelines.search}
            aria-label={t.crmPipelines.search}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

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
        <CreatePipelineModal
          key={isCreateOpen ? "open" : "closed"}
          stageCatalogue={stageCatalogue.items}
          isLoadingCatalogue={stageCatalogue.isLoading}
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
