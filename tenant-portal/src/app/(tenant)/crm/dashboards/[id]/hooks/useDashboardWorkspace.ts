"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { hasPermission, useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { DashboardTemplateKey } from "../../dashboard-contract";
import { useAvailableWidgets } from "./useAvailableWidgets";
import { useDashboardDetail, type DashboardMutationResult } from "./useDashboardDetail";
import { useDashboardLayout } from "./useDashboardLayout";
import { usePlacementVersion } from "./usePlacementVersion";
import { useDashboardShares } from "./useDashboardShares";
import { useDashboardSwitcher } from "./useDashboardSwitcher";
import { useWidgetDrilldown } from "./useWidgetDrilldown";
import { useWidgetGovernance } from "../../../widgets/hooks/useWidgetGovernance";
export function useDashboardWorkspace(dashboardId: string, onSelectDashboard?: (id: string) => void) {
  const { t, lang } = useI18n(); const toast = useToast(); const router = useRouter();
  const { user } = useTenantAuth(); const { canMutate } = useAccessMode();
  const detailState = useDashboardDetail(dashboardId);
  const permission = (key: string) => Boolean(user?.isTenantOwner) || hasPermission(user?.permissions ?? [], key);
  const canCreate = canMutate && permission("crm.dashboards.create") && permission("crm.widgets.create");
  const switcher = useDashboardSwitcher(canCreate);
  const layout = useDashboardLayout(dashboardId, detailState.detail, detailState.reloadConfirmed, switcher.catalog);
  const isOwner = detailState.detail?.accessLevel === "OWNER";
  const canShare = isOwner && canMutate && permission("crm.dashboards.share");
  const shares = useDashboardShares(dashboardId, canShare);
  const widgetPicker = useAvailableWidgets(layout.canEdit);
  const drilldown = useWidgetDrilldown(dashboardId);
  const placementVersionEnabled = layout.canEdit && !layout.isEditing && !detailState.detailError;
  const placementVersion = usePlacementVersion(dashboardId, placementVersionEnabled, permission("crm.widgets.read"), () => {
    drilldown.close();
    return detailState.reloadConfirmed();
  });
  const governance = useWidgetGovernance(`dashboard:${dashboardId}`, async () => {
    drilldown.close();
    const [refreshed] = await Promise.all([detailState.reloadConfirmed(), widgetPicker.reload()]);
    return refreshed;
  });
  const [isShareOpen, setIsShareOpen] = useState(false); const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false); const [conflict, setConflict] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const guard = useUnsavedChangesGuard(Boolean(layout.isEditing && layout.isDirty));
  const describe = (error: NormalizedApiError | null) => t.crmDashboards.errors[error?.code ?? ""] ?? t.crmDashboards.actionFailed;
  function report(result: DashboardMutationResult, title: string) {
    if (result.ignored || (!result.ok && !result.error)) return false;
    if (result.ok) { if (result.refreshFailed) toast.warning(t.crmDashboards.review.refreshFailed); else toast.success(title); setActionError(undefined); return true; }
    setActionError(describe(result.error));
    if (result.conflict) setConflict(true);
    else if (result.error && !toast.outcomeFromApi(result.error)) toast.errorFromApi(describe(result.error), result.error);
    return false;
  }
  const commitNavigation = (id: string) => { if (id !== dashboardId) { if (onSelectDashboard) onSelectDashboard(id); else router.push(`${TENANT_ROUTES.crmDashboards}/${id}`); } };
  const navigate = (id: string) => { if (id !== dashboardId) guard.requestDiscard(() => { layout.setIsEditing(false); commitNavigation(id); }); };
  const switcherOptions = switcher.items.some((item) => item.id === dashboardId) ? switcher.items : [{ id: dashboardId, name: detailState.detail?.name ?? "" }, ...switcher.items];
  const allSwitcherOptions = [...switcherOptions.map((item) => ({ value: item.id, label: item.name })), ...(canCreate ? switcher.unprovisionedTemplates.map((template) => ({ value: `template:${template.key}`, label: { en: template.nameEn, ar: template.nameAr }[lang] })) : [])];
  const handleSwitcherChange = (value: string) => {
    if (!value.startsWith("template:")) { navigate(value); return; }
    if (canCreate) guard.requestDiscard(() => { layout.setIsEditing(false); void switcher.ensureTemplateDashboard(value.slice(9) as DashboardTemplateKey).then((id) => { if (id === undefined) return; if (id) commitNavigation(id); else toast.error(t.crmDashboards.actionFailed); }); });
  };
  return { t, user, detailState, layout, isOwner, canShare, sharePermissionMissing: isOwner && !permission("crm.dashboards.share"), shares, widgetPicker, drilldown, governance,
    placementVersion, placementVersionEnabled, switcher, allSwitcherOptions, handleSwitcherChange, guard,
    toggleLayout: () => { if (layout.isEditing) guard.requestDiscard(() => layout.setIsEditing(false)); else layout.setIsEditing(true); },
    cancelLayout: () => guard.requestDiscard(() => layout.setIsEditing(false)),
    reloadDashboard: () => guard.requestDiscard(() => { layout.setIsEditing(false); void detailState.reload(); }),
    openAdd: () => guard.requestDiscard(() => { layout.setIsEditing(false); setIsAddOpen(true); }),
    isShareOpen, setIsShareOpen, isAddOpen, setIsAddOpen, isEditOpen, setIsEditOpen, conflict, setConflict, actionError, describe,
    addWidget: (id: string) => void layout.addWidget(id).then((result) => { if (report(result, t.crmDashboards.widgetAdded)) setIsAddOpen(false); }),
    removePlacement: (id: string) => guard.requestDiscard(() => { layout.setIsEditing(false); void layout.removePlacement(id).then((result) => report(result, t.crmDashboards.widgetRemoved)); }),
    saveLayout: () => void layout.save().then((result) => report(result, t.crmDashboards.layoutSaved)),
    rename: (name: string, description: string) => void detailState.rename(name, description).then((result) => { if (report(result, t.crmDashboards.saved)) setIsEditOpen(false); }),
    share: (input: Parameters<typeof shares.share>[0]) => shares.share(input).then((result) => { if (result.ok) { if (result.refreshFailed) toast.warning(t.crmDashboards.review.refreshFailed); else toast.success(t.crmDashboards.shared); } else if (result.error && !toast.outcomeFromApi(result.error)) toast.errorFromApi(describe(result.error), result.error); return result.ok; }),
    revoke: (id: string) => void shares.revoke(id).then((result) => { if (result.ok) { if (result.refreshFailed) toast.warning(t.crmDashboards.review.refreshFailed); else toast.success(t.crmDashboards.shareRevoked); } else if (result.error && !toast.outcomeFromApi(result.error)) toast.errorFromApi(describe(result.error), result.error); }),
    reloadLatest: () => { void Promise.allSettled([detailState.reload(), shares.reload(), switcher.reload()]); },
    reloadDrilldown: () => { drilldown.close(); void detailState.reload(); },
    reloadConflict: () => { setConflict(false); layout.setIsEditing(false); void detailState.reload(); } };
}


