"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles, Star } from "lucide-react";
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
import { DashboardFormDrawer } from "./components/DashboardFormDrawer";
import { useDashboardColumns } from "./components/useDashboardColumns";
import { useDashboards, type DashboardWriteResult } from "./hooks/useDashboards";
import type { DashboardSummary } from "./dashboard-contract";

const CRM_ANALYTICS_ITEMS =
  NAV_SECTIONS.find((section) => section.id === "crmAnalytics")?.items ?? [];

export default function DashboardsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const {
    items,
    catalog,
    catalogFailed,
    hasLoaded,
    isLoading,
    isSubmitting,
    pendingId,
    queryError,
    canCreate,
    canDelete,
    searchQuery,
    setSearchQuery,
    create,
    ensureTemplate,
    openDefault,
    duplicate,
    remove,
    setDefault,
    setFavorite,
    reload,
  } = useDashboards();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<DashboardSummary | null>(null);

  function describeFailure(error: NormalizedApiError): string {
    return t.crmDashboards.errors[error.code ?? ""] ?? t.crmDashboards.actionFailed;
  }

  function report(result: DashboardWriteResult, successTitle: string): boolean {
    if (result.ok) {
      if (result.replayed) {
        toast.info(t.errors.idempotencyReplayedTitle, t.errors.idempotencyReplayedDescription);
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

  const columns = useDashboardColumns({
    canCreate,
    canDelete,
    pendingId,
    onSetDefault: (dashboard) => {
      void setDefault(dashboard.id).then((result) =>
        report(result, t.crmDashboards.defaultChanged),
      );
    },
    onToggleFavorite: (dashboard) => {
      void setFavorite(dashboard.id, !dashboard.isFavorite).then((result) =>
        report(result, t.crmDashboards.favoriteChanged),
      );
    },
    onDuplicate: (dashboard) => {
      void duplicate(dashboard.id).then((result) => {
        if (report(result, t.crmDashboards.duplicated) && result.createdId) {
          router.push(`${TENANT_ROUTES.crmDashboards}/${result.createdId}`);
        }
      });
    },
    onDelete: setPendingDelete,
  });

  return (
    <PermissionGate require="crm.dashboards.read" scoped>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.crmDashboards.title}
          description={t.crmDashboards.subtitle}
          primaryAction={
            canCreate
              ? {
                  label: t.crmDashboards.add,
                  onClick: () => {
                    setCreateError(undefined);
                    setIsCreateOpen(true);
                  },
                }
              : undefined
          }
          secondaryActions={
            <>
              {/* `GET /dashboards/default` PROVISIONS when the actor has none,
                  so it is bound to an explicit action and never called on
                  mount. */}
              <Button
                variant="outline"
                disabled={isSubmitting}
                onClick={() => {
                  void openDefault().then((result) => {
                    if (result.ok && result.createdId) {
                      router.push(`${TENANT_ROUTES.crmDashboards}/${result.createdId}`);
                      return;
                    }
                    if (result.error && !toast.outcomeFromApi(result.error)) {
                      toast.errorFromApi(describeFailure(result.error), result.error);
                    }
                  });
                }}
              >
                <Star className="size-4" aria-hidden="true" />
                {t.crmDashboards.openDefault}
              </Button>
              {canCreate ? (
                <Button
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => {
                    // PUT, not POST: get-or-create, so pressing it twice does
                    // not leave two standard dashboards behind.
                    void ensureTemplate("CRM_DEFAULT").then((result) => {
                      if (report(result, t.crmDashboards.standardReady) && result.createdId) {
                        router.push(`${TENANT_ROUTES.crmDashboards}/${result.createdId}`);
                      }
                    });
                  }}
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {t.crmDashboards.standardDashboard}
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => void reload()} disabled={isLoading}>
                <RefreshCw
                  className={isLoading ? "size-4 animate-spin" : "size-4"}
                  aria-hidden="true"
                />
                {t.common.retry}
              </Button>
            </>
          }
        />

        <SubNav items={CRM_ANALYTICS_ITEMS} />

        {/* Partial failure: the catalogue only feeds the template picker, so
            losing it degrades one control rather than the screen. */}
        {catalogFailed ? <DegradedBanner message={t.crmDashboards.catalogueUnavailable} /> : null}

        {canCreate ? null : (
          <p
            role="note"
            className="rounded-sm border border-border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground"
          >
            {t.crmDashboards.readOnlyReason}
          </p>
        )}

        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => undefined}
          onReset={() => undefined}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.crmDashboards.search}
        />

        {/* No pagination: `GET /dashboards` declares no page/limit query and
            returns every visible dashboard in one array
            (dashboard-access.service.ts, `accessibleDashboards`). */}
        <DataTable
          columns={columns}
          rows={items}
          isLoading={isLoading && !hasLoaded}
          error={queryError}
          onRetry={() => void reload()}
          rowKey={(dashboard) => dashboard.id}
          onRowClick={(dashboard) =>
            router.push(`${TENANT_ROUTES.crmDashboards}/${dashboard.id}`)
          }
          labels={{
            retry: t.common.retry,
            errorTitle: t.crmDashboards.loadFailed,
            emptyTitle: searchQuery.trim()
              ? t.crmDashboards.emptyFiltered
              : t.crmDashboards.empty,
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

        <DashboardFormDrawer
          key={isCreateOpen ? "open" : "closed"}
          open={isCreateOpen}
          onOpenChange={(open) => {
            if (!open) setCreateError(undefined);
            setIsCreateOpen(open);
          }}
          templates={catalog?.templates ?? []}
          templatesUnavailable={catalog === null}
          isSubmitting={isSubmitting}
          error={createError}
          onSubmit={(input) => {
            void create(input).then((result) => {
              if (result.ok) {
                setIsCreateOpen(false);
                setCreateError(undefined);
                report(result, t.crmDashboards.created);
                if (result.createdId) {
                  router.push(`${TENANT_ROUTES.crmDashboards}/${result.createdId}`);
                }
                return;
              }
              setCreateError(result.error ? describeFailure(result.error) : undefined);
              if (result.error) toast.outcomeFromApi(result.error);
            });
          }}
        />

        <ConfirmActionModal
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          title={t.crmDashboards.deleteTitle}
          description={formatTemplate(t.crmDashboards.deleteDescription, {
            name: pendingDelete?.name ?? "",
          })}
          confirmLabel={t.common.delete}
          cancelLabel={t.common.cancel}
          loading={pendingId !== null}
          onConfirm={() => {
            const target = pendingDelete;
            if (!target) return;
            void remove(target.id).then((result) => {
              if (report(result, t.crmDashboards.deleted)) setPendingDelete(null);
            });
          }}
        />
      </div>
    </PermissionGate>
  );
}
