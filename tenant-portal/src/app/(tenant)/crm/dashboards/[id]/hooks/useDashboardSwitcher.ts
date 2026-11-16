"use client";
import { useDashboards } from "../../hooks/useDashboards";
import type { DashboardTemplateKey } from "../../dashboard-contract";
export function useDashboardSwitcher(canCreate: boolean) {
  const list = useDashboards(true);
  const provisioned = new Set(list.items.filter((item) => item.accessLevel === "OWNER").map((item) => item.sourceTemplateKey));
  return { items: list.items, catalog: list.catalog, error: list.queryError ?? list.catalogError, reload: list.reload, isLoading: list.isLoading, hasMore: list.hasMore, loadMore: list.loadMore,
    unprovisionedTemplates: canCreate && list.canUseTemplates && !list.queryError && !list.catalogFailed && list.hasLoaded && !list.hasMore ? (list.catalog?.templates ?? []).filter((template) => !provisioned.has(template.key)) : [],
    ensureTemplateDashboard: async (key: DashboardTemplateKey) => { if (!canCreate) return null; const result = await list.ensureTemplate(key); return result.ignored ? undefined : result.ok ? result.createdId : null; } };
}

