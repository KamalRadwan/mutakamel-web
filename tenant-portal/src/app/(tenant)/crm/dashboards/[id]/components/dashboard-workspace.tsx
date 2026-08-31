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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
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
import { AddWidgetDrawer } from "./AddWidgetDrawer";
import { DashboardEditDrawer } from "./DashboardEditDrawer";
import { DashboardFilterBar } from "./DashboardFilterBar";
import { DashboardLayoutEditor } from "./DashboardLayoutEditor";
import { DrilldownSheet } from "./DrilldownSheet";
import { ShareDrawer } from "./ShareDrawer";
import { WidgetTile } from "./WidgetTile";

export function DashboardWorkspace({ dashboardId }: { dashboardId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { user } = useTenantAuth();
  const detailState = useDashboardDetail(dashboardId);
  const { detail, run, selection, availableCurrencies, isLoading, isRunning } = detailState;

  const layout = useDashboardLayout(dashboardId, detail, detailState.reload);
  const isOwner = detail?.accessLevel === "OWNER";
  const shares = useDashboardShares(dashboardId, isOwner);
  const widgetPicker = useAvailableWidgets(layout.canEdit);
  const drilldown = useWidgetDrilldown(dashboardId);
  const switcher = useDashboardSwitcher();

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
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (detailState.detailError?.status === 403) {
    // 403 is not an empty state — and the route grant is not the record grant:
    // a dashboard is reachable only through ownership or a share.
    return <PermissionGate require="crm.dashboards.read" scoped>{null}</PermissionGate>;
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

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={detail.name}
        subtitle={detail.description ?? undefined}
        backHref={TENANT_ROUTES.crmDashboards}
        backLabel={t.crmDashboards.backToList}
        secondaryActions={
          <>
            {switcher.items.length > 1 ? (
              <Select
                value={dashboardId}
                onValueChange={(next) => {
                  if (next !== dashboardId) {
                    router.push(`${TENANT_ROUTES.crmDashboards}/${next}`);
                  }
                }}
              >
                <SelectTrigger size="sm" aria-label={t.crmDashboards.switchDashboard} className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {switcher.items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button
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
              <Button variant="outline" onClick={() => setIsEditOpen(true)}>
                <Pencil className="size-4" aria-hidden="true" />
                {t.crmDashboards.edit}
              </Button>
            ) : null}
            {layout.canEdit ? (
              <Button variant="outline" onClick={() => setIsAddOpen(true)}>
                <Plus className="size-4" aria-hidden="true" />
                {t.crmDashboards.addWidget}
              </Button>
            ) : null}
            {layout.canEdit ? (
              <Button
                variant="outline"
                aria-pressed={layout.isEditing}
                onClick={() => layout.setIsEditing(!layout.isEditing)}
              >
                <LayoutGrid className="size-4" aria-hidden="true" />
                {layout.isEditing ? t.crmDashboards.layoutDone : t.crmDashboards.editLayout}
              </Button>
            ) : null}
            {isOwner ? (
              <Button variant="outline" onClick={() => setIsShareOpen(true)}>
                <Share2 className="size-4" aria-hidden="true" />
                {t.crmDashboards.share}
              </Button>
            ) : null}
          </>
        }
      />

      <DashboardFilterBar
        selection={selection}
        onChange={(next) => void detailState.rerun(next)}
        branchIds={user?.accessibleBranches ?? []}
        currencyCodes={availableCurrencies}
        disabled={isRunning}
      />

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
            <Button variant="ghost" onClick={() => layout.setIsEditing(false)}>
              {t.common.cancel}
            </Button>
            <Button
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {detail.placements.map((placement) => (
            <WidgetTile
              key={placement.id}
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
          ))}
        </div>
      )}

      <AddWidgetDrawer
        key={isAddOpen ? "add-open" : "add-closed"}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        widgets={widgetPicker.widgets}
        widgetsUnavailable={widgetPicker.error !== null}
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
        open={isEditOpen}
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
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        shares={shares.shares}
        targets={shares.targets}
        isLoading={shares.isLoading}
        isSubmitting={shares.isSubmitting}
        onSearchTargets={(query) => void shares.searchTargets(query)}
        onShare={(input) => {
          void shares.share(input).then((result) => {
            if (result.ok) toast.success(t.crmDashboards.shared);
            else if (result.error && !toast.outcomeFromApi(result.error)) {
              toast.errorFromApi(describe(result.error), result.error);
            }
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
        onLoadMore={() => drilldown.loadMore(selection)}
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
