"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceState } from "@/design-system";
import type { ActivityTargetSelection } from "@/components/activities/activity-contract";
import { leadPrimaryPhonePatch } from "../lead-phone-patch";
import { leadSearchValuesOf, leadSearchWithField } from "../lead-search-contract";
import { DEFAULT_LEADS_SORT, type LeadItem, useLeads } from "./useLeads";
import { useLeadBoard } from "./useLeadBoard";
import { useLeadDocumentCounts } from "./useLeadDocumentCounts";
import { useLeadKpis } from "./useLeadKpis";
import { useLeadsWorkspaceBulk } from "./useLeadsWorkspaceBulk";
import { useLeadsWorkspaceCreate } from "./useLeadsWorkspaceCreate";

/** Everything the Leads list screen holds besides its markup. */
export function useLeadsWorkspace() {
  const leads = useLeads();
  const router = useRouter();
  const {
    items,
    stages,
    branchId,
    search,
    setSearch,
    appliedSearch,
    sort,
    dataRevision,
    activeView,
    setActiveView,
    loadError,
    updateLeadInline,
  } = leads;

  // Keep identity only: booking an activity reloads the lead's current data.
  const [activityLead, setActivityLead] = useState<ActivityTargetSelection | null>(null);
  const openActivities = useCallback(
    (lead: LeadItem) => setActivityLead({ app: "CRM", type: "LEAD", id: lead.id, label: lead.leadName }),
    [],
  );
  const openLead = useCallback((lead: LeadItem) => router.push(`/crm/leads/${lead.id}`), [router]);

  const workspace = useWorkspaceState("leads", {
    defaultView: "board",
    defaultSort: DEFAULT_LEADS_SORT,
    onPageChange: leads.setPage,
    onSortChange: leads.setSort,
  });
  const { view } = workspace;

  useEffect(() => {
    const next = view === "table" ? "list" : view;
    if (activeView !== next) setActiveView(next);
  }, [activeView, setActiveView, view]);

  const board = useLeadBoard({
    enabled: view === "board",
    branchId,
    stages,
    search: appliedSearch,
    sort,
    revision: dataRevision,
  });
  const documentCounts = useLeadDocumentCounts(items, branchId, view === "card");
  const kpis = useLeadKpis({ branchId, search: appliedSearch, revision: dataRevision, enabled: Boolean(branchId) });

  const bulk = useLeadsWorkspaceBulk({
    items,
    stages,
    selection: workspace.selection,
    canUpdateLead: leads.canUpdateLead,
    canDeleteLead: leads.canDeleteLead,
    bulkMoveStage: leads.bulkMoveStage,
    bulkUpdateLeads: leads.bulkUpdateLeads,
    bulkDeleteLeads: leads.bulkDeleteLeads,
  });
  const create = useLeadsWorkspaceCreate({
    openCreate: leads.openCreate,
    setIsCreateOpen: leads.setIsCreateOpen,
    handleCreate: leads.handleCreate,
  });

  // Both filters are Basic search fields, so they are server filters: the
  // list, the board and the KPI figures re-query together.
  const basicMode = search.mode === "basic";
  const stageFilter = basicMode ? leadSearchValuesOf(search, "stage") : [];
  const stageFlagFilter = basicMode ? leadSearchValuesOf(search, "stageFlag")[0] : undefined;
  const filterStage = (stageId: string | undefined) =>
    setSearch(leadSearchWithField(search, "stage", stageId ?? ""));
  const filterStageFlag = (flag: string | undefined) =>
    setSearch(leadSearchWithField(search, "stageFlag", flag ?? ""));

  const saveInlinePhone = (lead: LeadItem, nextPhone: string) => {
    const patch = leadPrimaryPhonePatch(lead, nextPhone);
    if (Object.keys(patch).length > 0) void updateLeadInline(lead.id, patch, lead);
  };

  return {
    ...leads,
    workspace,
    view,
    board,
    boardErrorMessage: board.error?.message ?? loadError?.message ?? null,
    documentCounts,
    kpis,
    bulk,
    create,
    activityLead,
    closeActivities: () => setActivityLead(null),
    openActivities,
    openLead,
    stageFilter,
    filterStage,
    stageFlagFilter,
    filterStageFlag,
    saveInlinePhone,
  };
}
