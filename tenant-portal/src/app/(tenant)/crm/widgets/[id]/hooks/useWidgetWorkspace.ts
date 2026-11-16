"use client";
import { useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission, useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { parseQuerySpec } from "../../../dashboards/widget-response";
import type { WidgetDraftState } from "../../widget-draft-contract";
import { buildWidgetDraft, restoreWidgetEditorDraft } from "../../widget-draft-form";
import { useWidgetPreview } from "../../hooks/useWidgetPreview";
import { useWidgetGovernance } from "../../hooks/useWidgetGovernance";
import { validateWidgetForm, widgetSpecLimitations, widgetToForm, type StoredWidget, type WidgetAuthoringInput, type WidgetFormState, type WidgetSpecLimitation } from "../../widget-form";
import { useWidgetDetail } from "./useWidgetDetail";
import { useWidgetHistory } from "./useWidgetHistory";
import { useWidgetVersionComparison } from "./useWidgetVersionComparison";
import { useWidgetShareGrants } from "./useWidgetShareGrants";
export function useWidgetWorkspace(widgetId: string) {
  const detail = useWidgetDetail(widgetId);
  const governance = useWidgetGovernance(`detail:${widgetId}`, detail.reload);
  const { user } = useTenantAuth();
  const { t, lang } = useI18n();
  const toast = useToast();
  const [editor, setEditor] = useState<{ scope: string; base: WidgetDraftState; initial: WidgetFormState; definition?: StoredWidget } | null>(null);
  const [failure, setFailure] = useState<{ scope: string; message: string } | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const permissions = user?.permissions ?? [];
  const widget = detail.widget;
  const canUpdate = hasPermission(permissions, "crm.widgets.update");
  const canEdit = !!detail.draftState && widget?.status !== "ARCHIVED" && !detail.readOnly && canUpdate;
  const canShare = widget?.accessLevel === "OWNER" && !detail.readOnly && hasPermission(permissions, "crm.widgets.share");
  const shares = useWidgetShareGrants(widgetId, canShare);
  const stored = detail.draftState?.draft;
  const lifecycle = detail.lifecycle;
  const reviewImpact = lifecycle.review?.impact;
  const history = useWidgetHistory(widgetId, reviewImpact ? {
    key: JSON.stringify([detail.scope, reviewImpact.body.impactId]), revision: reviewImpact.body.expectedWidgetRevision,
    activeVersion: reviewImpact.nextVersionNumber > 1 ? reviewImpact.nextVersionNumber - 1 : null,
  } : undefined);
  const versions = useWidgetVersionComparison(widgetId, widget?.versionNumber != null && widget.accessLevel !== "VIEW"
    ? { revision: widget.revision, version: widget.versionNumber } : null, canUpdate && !detail.readOnly && !detail.error,
  detail.refreshAfterWrite);
  const lifecycleFailure = lifecycle.failure;
  const errorCode = lifecycleFailure?.error.code ?? "";
  const lifecycleErrors = t.crmWidgets.lifecycle.errors;
  const translatedError = Object.hasOwn(lifecycleErrors, errorCode)
    ? lifecycleErrors[errorCode as keyof typeof lifecycleErrors]
    : Object.hasOwn(t.crmDashboards.errors, errorCode) ? t.crmDashboards.errors[errorCode] : undefined;
  const lifecycleError = lifecycleFailure ? (
    lifecycle.review?.unconfirmed ? t.crmWidgets.lifecycle.unconfirmed
      : lifecycleFailure.error.status === 403 ? t.crmWidgets.review.writeDenied
        : translatedError ?? t.crmDashboards.actionFailed
  ) : undefined;
  let definition: StoredWidget | null = null;
  let initial: WidgetFormState | null = null;
  let limitations: WidgetSpecLimitation[] = [];
  if (stored?.unsupportedVisualization) {
    limitations = ["UNKNOWN_FIELDS"];
  } else if (stored) {
    try {
      initial = restoreWidgetEditorDraft(stored);
      if (!initial) definition = { ...stored, querySpec: parseQuerySpec({ series: [], ...stored.querySpec }, true) };
    } catch { limitations = ["UNKNOWN_FIELDS"]; }
  } else if (widget?.versionNumber != null) {
    definition = { name: widget.name, visualizationType: widget.visualizationType, querySpec: widget.querySpec, displaySpec: widget.displaySpec };
  } else if (widget && detail.draftState) {
    definition = { name: widget.name, visualizationType: null, querySpec: { series: [] }, displaySpec: {} };
  }
  if (definition) {
    limitations = widgetSpecLimitations(definition.querySpec, definition.displaySpec);
    initial = widgetToForm(definition);
  }
  const publishReady = !!stored && !!definition && !!initial && limitations.length === 0 && !validateWidgetForm(initial, detail.catalog);
  const canPreview = hasPermission(permissions, "crm.dashboards.read", true);
  const impact = lifecycle.review?.impact;
  const reviewInput: WidgetAuthoringInput | null = publishReady && definition?.visualizationType && impact
    && stored?.draftId === impact.body.expectedDraftId && stored.revision === impact.body.expectedDraftRevision
    && detail.draftState?.widgetRevision === impact.body.expectedWidgetRevision
    && detail.draftState.governanceRevision === impact.body.expectedGovernanceRevision
    ? { ...definition, visualizationType: definition.visualizationType } : null;
  const reviewPreview = useWidgetPreview(impact?.body.impactId ?? "", canPreview && !!reviewInput);
  const active = canEdit && editor?.scope === detail.scope ? editor : null;
  const save = async (form: WidgetFormState) => {
    if (!active || !canEdit || detail.blocked) return;
    const result = await detail.update(buildWidgetDraft(form, detail.catalog, active.definition), active.base);
    if (result.stale) return;
    if (result.ok) {
      setEditor(null); setFailure(null); toast.success(t.crmWidgets.lifecycle.savedDraft);
      if (result.refreshed === false) toast.info(t.crmWidgets.review.savedRefreshFailed);
    } else if (result.conflict) setConflict(detail.scope);
    else if (result.error) setFailure({ scope: detail.scope, message: result.uncertain ? t.crmWidgets.review.uncertain : result.error.status === 403 ? t.crmWidgets.review.writeDenied : t.crmDashboards.errors[result.error.code ?? ""] ?? t.crmDashboards.actionFailed });
  };
  return { detail, widget, canEdit, canShare, shares, limitations, active, lifecycle, lifecycleError, history, versions, publishReady, reviewInput, reviewPreview, governance,
    publish: async () => {
      const result = await lifecycle.confirm();
      if (result) {
        toast.success(formatTemplate(t.crmWidgets.lifecycle.published, { version: formatNumber(result.versionNumber, lang) }));
        if (!result.refreshed) toast.info(t.crmWidgets.review.savedRefreshFailed);
      }
    },
    discard: async () => {
      const result = await lifecycle.discard();
      if (result) {
        toast.success(t.crmWidgets.lifecycle.discarded);
        if (!result.refreshed) toast.info(t.crmWidgets.review.savedRefreshFailed);
      }
    },
    canPreview,
    formError: failure?.scope === detail.scope ? failure.message : undefined, conflict: conflict === detail.scope,
    openEditor: () => {
      if (detail.draftState && initial && canEdit && !detail.blocked && !limitations.length && detail.catalog) {
        setFailure(null);
        setEditor({ scope: detail.scope, base: detail.draftState, initial, definition: definition ?? undefined });
      }
    },
    closeEditor: () => { if (!detail.isPending()) setEditor(null); }, save,
    cancelConflict: () => setConflict(null),
    reloadConflict: async () => { if (await detail.reload()) { setConflict(null); setEditor(null); setFailure(null); } },
  };
}
