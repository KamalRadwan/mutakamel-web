"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  DataTable,
  DegradedBanner,
  FilterBar,
  PageHeader,
  PermissionGate,
  SubNav,
  NAV_SECTIONS,
  useToast,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { NormalizedApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { WidgetDefinition } from "../dashboards/widget-contract";
import { WidgetFormDrawer } from "./components/WidgetFormDrawer";
import { useWidgetColumns } from "./components/useWidgetColumns";
import { useWidgets, type WidgetWriteResult } from "./hooks/useWidgets";

const CRM_ANALYTICS_ITEMS =
  NAV_SECTIONS.find((section) => section.id === "crmAnalytics")?.items ?? [];

export default function WidgetsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const widgets = useWidgets();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<WidgetDefinition | null>(null);

  function describe(error: NormalizedApiError): string {
    return t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed;
  }

  function report(result: WidgetWriteResult, successTitle: string): boolean {
    if (result.ok) {
      if (result.replayed) {
        toast.info(t.errors.idempotencyReplayedTitle, t.errors.idempotencyReplayedDescription);
      } else {
        toast.success(successTitle);
      }
      return true;
    }
    if (result.error && !toast.outcomeFromApi(result.error)) {
      toast.errorFromApi(describe(result.error), result.error);
    }
    return false;
  }

  const columns = useWidgetColumns({
    canCreate: widgets.canCreate,
    canDelete: widgets.canDelete,
    pendingId: widgets.pendingId,
    onClone: (widget) => {
      void widgets.clone(widget.id).then((result) => report(result, t.crmWidgets.cloned));
    },
    onDelete: setPendingDelete,
  });

  return (
    <PermissionGate require="crm.widgets.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.crmWidgets.title}
          description={t.crmWidgets.subtitle}
          primaryAction={
            widgets.canCreate
              ? {
                  label: t.crmWidgets.add,
                  onClick: () => {
                    widgets.clearPreview();
                    setCreateError(undefined);
                    setIsCreateOpen(true);
                  },
                }
              : undefined
          }
          secondaryActions={
            <Button
              variant="outline"
              onClick={() => void widgets.reload()}
              disabled={widgets.isLoading}
            >
              <RefreshCw
                className={widgets.isLoading ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.common.retry}
            </Button>
          }
        />

        <SubNav items={CRM_ANALYTICS_ITEMS} />

        {widgets.catalogFailed ? (
          <DegradedBanner message={t.crmWidgets.catalogueUnavailableForBuilder} />
        ) : null}

        {widgets.canCreate ? null : (
          <p
            role="note"
            className="rounded-sm border border-border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground"
          >
            {t.crmWidgets.readOnlyReason}
          </p>
        )}

        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => undefined}
          onReset={() => undefined}
          searchValue={widgets.searchQuery}
          onSearchChange={widgets.setSearchQuery}
          searchPlaceholder={t.crmWidgets.search}
        />

        {/* `GET /widgets` declares no pagination — `accessibleWidgets` returns
            one array of every visible widget. */}
        <DataTable
          columns={columns}
          rows={widgets.items}
          isLoading={widgets.isLoading && !widgets.hasLoaded}
          error={widgets.queryError}
          onRetry={() => void widgets.reload()}
          rowKey={(widget) => widget.id}
          onRowClick={(widget) => router.push(`${TENANT_ROUTES.crmWidgets}/${widget.id}`)}
          labels={{
            retry: t.common.retry,
            errorTitle: t.crmWidgets.loadFailed,
            emptyTitle: widgets.searchQuery.trim() ? t.crmWidgets.emptyFiltered : t.crmWidgets.empty,
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

        <WidgetFormDrawer
          key={isCreateOpen ? "open" : "closed"}
          open={isCreateOpen}
          onOpenChange={(open) => {
            if (!open) {
              setCreateError(undefined);
              widgets.clearPreview();
            }
            setIsCreateOpen(open);
          }}
          title={t.crmWidgets.createTitle}
          submitLabel={t.common.create}
          catalog={widgets.catalog}
          isSubmitting={widgets.isSubmitting}
          error={createError}
          canPreview={widgets.canPreview}
          preview={widgets.preview}
          previewError={widgets.previewError}
          isPreviewing={widgets.isPreviewing}
          onPreview={(input) => void widgets.runPreview(input)}
          onSubmit={(input) => {
            void widgets.create(input).then((result) => {
              if (result.ok) {
                setIsCreateOpen(false);
                setCreateError(undefined);
                report(result, t.crmWidgets.created);
                if (result.createdId) {
                  router.push(`${TENANT_ROUTES.crmWidgets}/${result.createdId}`);
                }
                return;
              }
              setCreateError(result.error ? describe(result.error) : undefined);
              if (result.error) toast.outcomeFromApi(result.error);
            });
          }}
        />

        <ConfirmActionModal
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          title={t.crmWidgets.deleteTitle}
          description={formatTemplate(t.crmWidgets.deleteDescription, {
            name: pendingDelete?.name ?? "",
          })}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          loading={widgets.pendingId !== null}
          onConfirm={() => {
            const target = pendingDelete;
            if (!target) return;
            void widgets.remove(target.id).then((result) => {
              if (report(result, t.crmWidgets.deleted)) setPendingDelete(null);
            });
          }}
        />
      </div>
    </PermissionGate>
  );
}
