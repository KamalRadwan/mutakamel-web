"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import {
  Badge,
  Button,
  ConflictDialog,
  DegradedBanner,
  DetailSection,
  DetailHeader,
  ErrorState,
  NotFoundState,
  Skeleton,
  useToast,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { NormalizedApiError } from "@/lib/api/errors";
import { parseWidgetResult, type WidgetResult } from "../../../dashboards/dashboard-run-contract";
import { WIDGET_PREVIEW_PATH, buildCreateWidgetRequest } from "../../../dashboards/widget-contract";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { parseCatalogResponse, type DashboardCatalog } from "../../../dashboards/dashboard-catalog-contract";
import { DASHBOARDS_CATALOG_PATH } from "../../../dashboards/dashboard-contract";
import { WidgetFormDrawer } from "../../components/WidgetFormDrawer";
import { buildWidgetUpdate, widgetSpecLimitations, widgetToForm } from "../../widget-form";
import { useWidgetDetail } from "../hooks/useWidgetDetail";
import { useWidgetShareGrants } from "../hooks/useWidgetShareGrants";
import { WidgetNotEditableNotice } from "./WidgetNotEditableNotice";
import { WidgetSharesSection } from "./WidgetSharesSection";

export function WidgetDetailWorkspace({ widgetId }: { widgetId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { widget, isLoading, isSaving, error, update, reload } = useWidgetDetail(widgetId);
  const isOwner = widget?.accessLevel === "OWNER";
  const canShare = isOwner && hasPermission(user?.permissions ?? [], "crm.widgets.share");
  const shares = useWidgetShareGrants(widgetId, canShare);

  const [catalog, setCatalog] = useState<DashboardCatalog | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [preview, setPreview] = useState<WidgetResult | null>(null);
  const [previewError, setPreviewError] = useState<NormalizedApiError | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const canEdit =
    (widget?.accessLevel === "OWNER" || widget?.accessLevel === "EDIT") &&
    hasPermission(user?.permissions ?? [], "crm.widgets.update");
  const canPreview = hasPermission(user?.permissions ?? [], "crm.dashboards.read", true);

  useEffect(() => {
    let cancelled = false;
    void axiosClient
      .get<unknown>(DASHBOARDS_CATALOG_PATH, { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 })
      .then((response) => {
        if (!cancelled) setCatalog(parseCatalogResponse(response.data));
      })
      .catch(() => {
        // The editor degrades to "catalogue unavailable" rather than failing
        // the screen — the widget itself is already loaded.
        if (!cancelled) setCatalog(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function describe(caught: NormalizedApiError | null): string {
    return t.crmDashboards.errors[caught?.code ?? ""] ?? t.crmDashboards.actionFailed;
  }

  if (isLoading && !widget) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error?.status === 403) {
    // NOT `PermissionGate`. This screen only renders at all because
    // `page.tsx`'s gate on `crm.widgets.read` already passed, so a second
    // client-side check here is always satisfied and renders its children —
    // which were `null`, making a server 403 a blank page. The whole point of
    // a 403 from the server is that the permission string said yes and branch
    // or owner scope said no (S6, defect D11), so the state has to be rendered
    // unconditionally rather than re-derived from permissions.
    return (
      <ErrorState title={t.permissionGate.title} description={t.permissionGate.description} />
    );
  }

  if (!widget) {
    return (
      <NotFoundState
        title={t.crmWidgets.notFoundTitle}
        description={t.crmWidgets.notFoundDescription}
        backLabel={t.crmWidgets.backToList}
        backHref={TENANT_ROUTES.crmWidgets}
      />
    );
  }

  const usage = widget.usage;
  // D23. The form defines one metric with no filters and no semantic engine.
  // A widget carrying more than that cannot be represented in it, and opening
  // it anyway is what silently collapsed stored specs — so the editor is not
  // offered at all, and the reason is stated rather than left to be discovered.
  const specLimitations = widgetSpecLimitations(widget.querySpec);
  const canOpenEditor = canEdit && specLimitations.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={widget.name}
        subtitle={t.crmDashboards.visualizations[widget.visualizationType] ?? widget.visualizationType}
        status={<Badge tone="neutral">{t.crmDashboards.accessLevels[widget.accessLevel]}</Badge>}
        backHref={TENANT_ROUTES.crmWidgets}
        backLabel={t.crmWidgets.backToList}
        secondaryActions={
          canOpenEditor ? (
            <Button
              variant="outline"
              onClick={() => {
                setPreview(null);
                setPreviewError(null);
                setIsEditOpen(true);
              }}
            >
              <Pencil className="size-4" aria-hidden="true" />
              {t.crmWidgets.edit}
            </Button>
          ) : undefined
        }
      />

      {canEdit && specLimitations.length > 0 ? (
        <WidgetNotEditableNotice limitations={specLimitations} />
      ) : null}

      <DetailSection
        title={t.crmWidgets.definition}
        fields={[
          { label: t.crmWidgets.metric, value: widget.querySpec.series.map((s) => s.metricKey).join(", ") },
          { label: t.crmWidgets.dimension, value: widget.querySpec.dimension?.key ?? "none" },
          { label: t.crmWidgets.comparison, value: widget.querySpec.comparison?.type ?? "NONE" },
          { label: t.crmWidgets.revision, value: String(widget.revision) },
        ]}
      />

      {usage ? (
        <section className="flex flex-col gap-2 rounded-sm border border-border bg-card p-3">
          <h2 className="text-sm font-medium text-foreground">{t.crmWidgets.usageTitle}</h2>
          <p className="text-xs text-muted-foreground">
            {formatTemplate(t.crmWidgets.usageSummary, {
              placements: usage.placementCount,
              dashboards: usage.dashboardCount,
            })}
          </p>
          {/* Owner-only, and honest about what the viewer cannot see: the
              server counts every placement but only returns the ones on
              dashboards this viewer can reach. */}
          {usage.hiddenPlacementCount > 0 ? (
            <DegradedBanner
              message={formatTemplate(t.crmWidgets.hiddenPlacements, {
                count: usage.hiddenPlacementCount,
              })}
            />
          ) : null}
          {usage.placements.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {usage.placements.map((placement) => (
                <li key={placement.placementId} className="text-xs text-foreground">
                  {placement.dashboardName}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {canShare ? (
        <WidgetSharesSection
          shares={shares.shares}
          targets={shares.targets}
          isLoading={shares.isLoading}
          isSubmitting={shares.isSubmitting}
          onSearchTargets={(query) => void shares.searchTargets(query)}
          onShare={(input) => {
            void shares.share({ ...input, expiresAt: "" }).then((failure) => {
              if (!failure) toast.success(t.crmDashboards.shared);
              else if (!toast.outcomeFromApi(failure)) {
                toast.errorFromApi(describe(failure), failure);
              }
            });
          }}
          onRevoke={(shareId) => {
            void shares.revoke(shareId).then((failure) => {
              if (!failure) toast.success(t.crmDashboards.shareRevoked);
              else if (!toast.outcomeFromApi(failure)) {
                toast.errorFromApi(describe(failure), failure);
              }
            });
          }}
        />
      ) : null}

      <WidgetFormDrawer
        key={isEditOpen ? `edit-${widget.revision}` : "closed"}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title={t.crmWidgets.editTitle}
        submitLabel={t.common.save}
        initial={widgetToForm(widget)}
        catalog={catalog}
        isSubmitting={isSaving}
        canPreview={canPreview}
        preview={preview}
        previewError={previewError}
        isPreviewing={isPreviewing}
        onPreview={(input) => {
          setIsPreviewing(true);
          setPreviewError(null);
          void axiosClient
            .post<unknown>(WIDGET_PREVIEW_PATH, buildCreateWidgetRequest(input), {
              cache: "no-store",
              maxResponseBytes: 2 * 1024 * 1024,
              skipAutoIdempotency: true,
            })
            .then((response) => setPreview(parseWidgetResult(response.data)))
            .catch((caught) => {
              setPreview(null);
              setPreviewError(normalizeApiError(caught));
            })
            .finally(() => setIsPreviewing(false));
        }}
        onSubmit={(_input, form) => {
          // Not `_input`: that always carries a rebuilt querySpec, which the
          // server would store wholesale. `buildWidgetUpdate` sends the spec
          // only when the user actually changed the query — D23.
          void update(buildWidgetUpdate(form, widget)).then((result) => {
            if (result.ok) {
              setIsEditOpen(false);
              toast.success(t.crmWidgets.saved);
              if (result.adjustments.length > 0) {
                toast.warning(
                  t.crmWidgets.layoutAdjustedTitle,
                  formatTemplate(t.crmWidgets.layoutAdjusted, {
                    count: result.adjustments.length,
                  }),
                );
              }
              return;
            }
            if (result.conflict) {
              setConflict(true);
              return;
            }
            if (result.error && !toast.outcomeFromApi(result.error)) {
              toast.errorFromApi(describe(result.error), result.error);
            }
          });
        }}
      />

      <ConflictDialog
        open={conflict}
        onOpenChange={setConflict}
        title={t.crmWidgets.conflictTitle}
        description={t.crmWidgets.conflictDescription}
        onReload={() => {
          setConflict(false);
          setIsEditOpen(false);
          void reload();
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
