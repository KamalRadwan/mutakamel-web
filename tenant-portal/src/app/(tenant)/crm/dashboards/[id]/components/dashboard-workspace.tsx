"use client";

import { useState } from "react";
import { LayoutGrid, Pencil, Plus, RefreshCw, Share2 } from "lucide-react";
import {
  Button,
  ConflictDialog,
  DegradedBanner,
  DetailHeader,
  EmptyState,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
  hasPermission,
  useToast,
} from "@/design-system";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { NormalizedApiError } from "@/lib/api/errors";
import { failedWidgetIds } from "../../dashboard-run-contract";
import { useAvailableWidgets } from "../hooks/useAvailableWidgets";
import { useDashboardDetail, type DashboardMutationResult } from "../hooks/useDashboardDetail";
import { useDashboardLayout } from "../hooks/useDashboardLayout";
import { useDashboardShares } from "../hooks/useDashboardShares";
import { useDashboardSwitcher } from "../hooks/useDashboardSwitcher";
import { useWidgetDrilldown } from "../hooks/useWidgetDrilldown";
import type { DashboardTemplateKey } from "../../dashboard-contract";
import { AddWidgetDrawer } from "./AddWidgetDrawer";
import { DashboardEditDrawer } from "./DashboardEditDrawer";
import { DashboardFilterBar } from "./DashboardFilterBar";
import { DashboardLayoutEditor } from "./DashboardLayoutEditor";
import { DrilldownSheet } from "./DrilldownSheet";
import { ShareDrawer } from "./ShareDrawer";
import { WidgetTile } from "./WidgetTile";

export function DashboardWorkspace({
  dashboardId,
  hideHeader = false,
  onSelectDashboard,
}: {
  dashboardId: string;
  hideHeader?: boolean;
  onSelectDashboard?: (nextDashboardId: string) => void;
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { user } = useTenantAuth();
  const detailState = useDashboardDetail(dashboardId);
  const { detail, run, selection, availableCurrencies, isLoading, isRunning } = detailState;

  const layout = useDashboardLayout(dashboardId, detail, detailState.reload);
  const isOwner = detail?.accessLevel === "OWNER";
  const canShare = isOwner && hasPermission(user?.permissions ?? [], "crm.dashboards.share");
  const shares = useDashboardShares(dashboardId, canShare);
  const widgetPicker = useAvailableWidgets(layout.canEdit);
  const drilldown = useWidgetDrilldown(dashboardId);
  const canCreate = hasPermission(user?.permissions ?? [], "crm.dashboards.create");
  const switcher = useDashboardSwitcher(canCreate);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [conflict, setConflict] = useState(false);

  function describe(error: NormalizedApiError | null): string {
    return t.crmDashboards.errors[error?.code ?? ""] ?? t.crmDashboards.actionFailed;
  }

  function report(result: DashboardMutationResult, successTitle: string): boolean {
    if (result.ok) {
      toast.success(successTitle);
      return true;
    }
    if (result.conflict) {
      setConflict(true);
      return false;
    }
    if (result.error && !toast.outcomeFromApi(result.error)) {
      toast.errorFromApi(describe(result.error), result.error);
    }
    return false;
  }

  if (isLoading && detail === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (detailState.detailError?.status === 403) {
    // 403 is not an empty state — and the route grant is not the record grant:
    // a dashboard is reachable only through ownership or a share.
    return <PermissionGate require="crm.dashboards.read" scoped denied>{null}</PermissionGate>;
  }

  if (detailState.detailError?.status === 404 || (detail === null && detailState.detailError)) {
    return (
      <NotFoundState
        title={t.crmDashboards.notFoundTitle}
        description={t.crmDashboards.notFoundDescription}
        backLabel={t.crmDashboards.backToList}
        backHref={TENANT_ROUTES.crmDashboards}
      />
    );
  }

  if (!detail) return null;

  const failed = failedWidgetIds(run);
  const widgetCount = detail.placements.length;
  const hiddenCount = detail.unavailablePlacements.length;

  const hasCurrentInSwitcher = switcher.items.some((item) => item.id === dashboardId);
  const switcherOptions = hasCurrentInSwitcher
    ? switcher.items
    : [{ id: dashboardId, name: detail.name }, ...switcher.items];

  const navigateToDashboard = (targetId: string) => {
    if (targetId === dashboardId) return;
    if (onSelectDashboard) {
      onSelectDashboard(targetId);
    } else {
      router.push(`${TENANT_ROUTES.crmDashboards}/${targetId}`);
    }
  };

  const allSwitcherOptions = [
    ...switcherOptions.map((item) => ({ value: item.id, label: item.name })),
    ...(canCreate ? switcher.unprovisionedTemplates.map((template) => ({
      value: `template:${template.key}`,
      label: { en: template.nameEn, ar: template.nameAr }[lang],
    })) : []),
  ];

  const handleSwitcherChange = (next: string) => {
    if (next.startsWith("template:")) {
      if (!canCreate) return;
      const templateKey = next.slice("template:".length) as DashboardTemplateKey;
      void switcher.ensureTemplateDashboard(templateKey).then((provisionedId) => {
        if (provisionedId) {
          navigateToDashboard(provisionedId);
        } else {
          toast.error(t.crmDashboards.actionFailed);
        }
      });
      return;
    }
    navigateToDashboard(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={detail.name}
        subtitle={detail.description ?? undefined}
        backHref={TENANT_ROUTES.crmDashboards}
        backLabel={t.crmDashboards.backToList}
        className={hideHeader ? "sr-only" : undefined}
        secondaryActions={
          <>
            <Button size="sm"
              variant="outline"
              onClick={() => void detailState.reload()}
              disabled={isRunning}
            >
              <RefreshCw
                className={isRunning ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.crmDashboards.rerun}
            </Button>
            {layout.canEdit ? (
              <Button size="sm" variant="outline" onClick={() => setIsEditOpen(true)}>
                <Pencil className="size-4" aria-hidden="true" />
                {t.crmDashboards.edit}
              </Button>
            ) : null}
            {layout.canEdit ? (
              <Button size="sm" variant="outline" onClick={() => setIsAddOpen(true)}>
                <Plus className="size-4" aria-hidden="true" />
                {t.crmDashboards.addWidget}
              </Button>
            ) : null}
            {layout.canEdit ? (
              <Button size="sm"
                variant="outline"
                aria-pressed={layout.isEditing}
                onClick={() => layout.setIsEditing(!layout.isEditing)}
              >
                <LayoutGrid className="size-4" aria-hidden="true" />
                {layout.isEditing ? t.crmDashboards.layoutDone : t.crmDashboards.editLayout}
              </Button>
            ) : null}
            {canShare ? (
              <Button size="sm" variant="outline" onClick={() => setIsShareOpen(true)}>
                <Share2 className="size-4" aria-hidden="true" />
                {t.crmDashboards.share}
              </Button>
            ) : null}
          </>
        }
      />

      {layout.editPermissionMissing ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t.crmDashboards.editPermissionRequired}
        </p>
      ) : null}
      {isOwner && !canShare ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t.crmDashboards.sharePermissionRequired}
        </p>
      ) : null}

      {switcher.error ? (
        <ErrorState
          title={t.crmDashboards.switcherLoadFailed}
          description={describe(switcher.error)}
          onRetry={() => void switcher.reload()}
          retryLabel={t.common.retry}
        />
      ) : null}

      <DashboardFilterBar
        selection={selection}
        onChange={(next) => void detailState.rerun(next)}
        branchIds={user?.accessibleBranches ?? []}
        currencyCodes={availableCurrencies}
        disabled={isRunning}
        dashboardSwitcher={{
          value: dashboardId,
          options: allSwitcherOptions,
          onChange: handleSwitcherChange,
        }}
      />
      {switcher.hasMore ? (
        <Button variant="outline" disabled={switcher.isLoading} loading={switcher.isLoading} onClick={() => void switcher.loadMore()}>
          {t.crmDashboards.loadMoreDashboards}
        </Button>
      ) : null}

      {/* Partial failure, named per widget — 3 of 9, not "the dashboard
          failed". Each failed tile also says which one it was. */}
      {failed.length > 0 ? (
        <DegradedBanner
          message={formatTemplate(t.crmDashboards.widgetsFailed, {
            failed: failed.length,
            total: Object.keys(run?.widgets ?? {}).length,
          })}
        />
      ) : null}

      {hiddenCount > 0 ? (
        <DegradedBanner
          message={formatTemplate(t.crmDashboards.hiddenPlacements, { count: hiddenCount })}
        />
      ) : null}

      {detailState.runError ? (
        <ErrorState
          title={t.crmDashboards.runFailed}
          description={describe(detailState.runError)}
          onRetry={() => void detailState.rerun(selection)}
          retryLabel={t.common.retry}
        />
      ) : null}

      {layout.isEditing ? (
        <div className="flex flex-col gap-2">
          <DashboardLayoutEditor
            draft={layout.draft}
            placements={detail.placements}
            hiddenCount={hiddenCount}
            onMove={layout.move}
            onReorder={layout.reorder}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => layout.setIsEditing(false)}>
              {t.common.cancel}
            </Button>
            <Button size="sm"
              disabled={!layout.isDirty || layout.isSaving}
              loading={layout.isSaving}
              onClick={() => {
                void layout.save().then((result) => report(result, t.crmDashboards.layoutSaved));
              }}
            >
              {t.crmDashboards.saveLayout}
            </Button>
          </div>
        </div>
      ) : null}

      {widgetCount === 0 ? (
        <EmptyState
          title={t.crmDashboards.noWidgets}
          description={
            layout.canEdit ? t.crmDashboards.noWidgetsHint : t.crmDashboards.noWidgetsReadOnly
          }
          action={
            layout.canEdit
              ? { label: t.crmDashboards.addWidget, onClick: () => setIsAddOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {detail.placements.map((placement) => {
            const colSpan =
              placement.width <= 3
                ? "sm:col-span-1 lg:col-span-3"
                : placement.width === 4
                  ? "sm:col-span-2 lg:col-span-4"
                  : placement.width === 5
                    ? "sm:col-span-2 lg:col-span-5"
                    : placement.width === 6
                      ? "sm:col-span-2 lg:col-span-6"
                      : placement.width === 7
                        ? "sm:col-span-2 lg:col-span-7"
                        : placement.width === 8
                          ? "sm:col-span-2 lg:col-span-8"
                          : placement.width === 9
                            ? "sm:col-span-2 lg:col-span-9"
                            : "sm:col-span-2 lg:col-span-12";
            return (
              <div key={placement.id} className={colSpan}>
                <WidgetTile
                  widget={placement.widget}
                  result={run?.widgets[placement.widgetId]}
                  placementId={placement.id}
                  isRemoving={layout.pendingPlacementId === placement.id}
                  onDrilldown={(widget, pointKey, label) =>
                    drilldown.open(widget, pointKey, label, selection)
                  }
                  onRemove={
                    layout.isEditing
                      ? (placementId) => {
                          void layout
                            .removePlacement(placementId)
                            .then((result) => report(result, t.crmDashboards.widgetRemoved));
                        }
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      <AddWidgetDrawer
        key={isAddOpen ? "add-open" : "add-closed"}
        open={isAddOpen && layout.canEdit}
        onOpenChange={setIsAddOpen}
        widgets={widgetPicker.widgets}
        widgetsUnavailable={widgetPicker.error !== null}
        hasMore={widgetPicker.hasMore}
        isLoadingMore={widgetPicker.isLoading}
        onLoadMore={() => void widgetPicker.loadMore()}
        placedWidgetIds={new Set(detail.placements.map((placement) => placement.widgetId))}
        atCapacity={widgetCount + hiddenCount >= 20}
        isSubmitting={layout.isSaving}
        onSubmit={(widgetId) => {
          void layout.addWidget(widgetId).then((result) => {
            if (report(result, t.crmDashboards.widgetAdded)) setIsAddOpen(false);
          });
        }}
      />

      <DashboardEditDrawer
        key={isEditOpen ? `edit-${detail.revision}` : "edit-closed"}
        open={isEditOpen && layout.canEdit}
        onOpenChange={setIsEditOpen}
        initialName={detail.name}
        initialDescription={detail.description ?? ""}
        isSubmitting={detailState.isSaving}
        onSubmit={(name, description) => {
          void detailState.rename(name, description).then((result) => {
            if (report(result, t.crmDashboards.saved)) setIsEditOpen(false);
          });
        }}
      />

      <ShareDrawer
        open={isShareOpen && canShare}
        onOpenChange={setIsShareOpen}
        shares={shares.shares}
        sharesError={shares.error}
        targets={shares.targets}
        targetSearchError={shares.targetSearchError}
        isLoading={shares.isLoading}
        isSubmitting={shares.isSubmitting}
        onSearchTargets={(query) => void shares.searchTargets(query)}
        onRetryShares={() => void shares.reload()}
        onRetryTargetSearch={shares.retrySearchTargets}
        onShare={(input) => {
          return shares.share(input).then((result) => {
            if (result.ok) toast.success(t.crmDashboards.shared);
            else if (result.error && !toast.outcomeFromApi(result.error)) {
              toast.errorFromApi(describe(result.error), result.error);
            }
            return result.ok;
          });
        }}
        onRevoke={(shareId) => {
          void shares.revoke(shareId).then((result) => {
            if (result.ok) toast.success(t.crmDashboards.shareRevoked);
            else if (result.error && !toast.outcomeFromApi(result.error)) {
              toast.errorFromApi(describe(result.error), result.error);
            }
          });
        }}
      />

      <DrilldownSheet
        target={drilldown.target}
        records={drilldown.records}
        hasMore={drilldown.hasMore}
        isLoading={drilldown.isLoading}
        error={drilldown.error}
        onLoadMore={() => drilldown.loadMore()}
        onClose={drilldown.close}
      />

      {/* A 409 here is a **revision** conflict, not a domain one: both
          `PATCH /:id` and `PUT /:id/layout` carry `revision` in the body and
          answer `CRM_DASHBOARD_REVISION_CONFLICT` / `CRM_DASHBOARD_LAYOUT_STALE`.
          There is no overwrite path — the server requires the current
          revision — so the dialog offers reload and cancel only. */}
      <ConflictDialog
        open={conflict}
        onOpenChange={setConflict}
        title={t.crmDashboards.conflictTitle}
        description={t.crmDashboards.conflictDescription}
        onReload={() => {
          setConflict(false);
          void detailState.reload();
        }}
        onCancel={() => setConflict(false)}
        labels={{
          yourChanges: t.crmDashboards.conflictYours,
          theirChanges: t.crmDashboards.conflictTheirs,
          reload: t.crmDashboards.conflictReload,
          overwrite: t.crmDashboards.conflictOverwrite,
          cancel: t.common.cancel,
        }}
      />
    </div>
  );
}
