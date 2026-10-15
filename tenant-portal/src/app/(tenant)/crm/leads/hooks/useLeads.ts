"use client";

import { useCallback, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { crmCapabilityAllowsOwner } from "../../shared/crm-capabilities";
import type { LeadItem } from "../lead-list-contract";
import { useLeadCardWrites } from "./useLeadCardWrites";
import { useLeadList, type LeadsView } from "./useLeadList";
import { useLeadMutations } from "./useLeadMutations";
import { useLeadStagesAndCapabilities } from "./useLeadStagesAndCapabilities";

export type { LeadItem, LeadStage } from "../lead-list-contract";
export { parseLeadsResponse } from "../lead-list-contract";
export { DEFAULT_LEADS_SORT, type LeadsView } from "./useLeadList";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * The Leads screen: list, stage catalogue and capabilities, and every write
 * the screen offers. Each concern lives in its own hook; this one wires them
 * to the branch on screen and to one write-feedback message.
 */
export function useLeads() {
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  // The page synchronizes the view before the debounced read fires; "card"
  // keeps the hook usable on its own.
  const [activeView, setActiveView] = useState<LeadsView>("card");
  const [error, setError] = useState<string | null>(null);
  // Bumped after every write so the board lanes and KPIs, which this hook
  // does not own, read again.
  const [dataRevision, setDataRevision] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<LeadItem | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const openCreate = useCallback(() => {
    setError(null);
    setIsCreateOpen(true);
  }, []);
  const support = useLeadStagesAndCapabilities(branchId);
  const list = useLeadList({ branchId, actorId: user?.id, activeView, onLoadStart: clearError });
  const { capabilities } = support;
  const { reload } = list;

  const reconcile = useCallback(
    async (page?: number) => {
      const reloaded = await reload(page);
      setDataRevision((current) => current + 1);
      return reloaded;
    },
    [reload],
  );
  const report = useCallback(
    (caught: unknown, fallback: string) => setError(errorMessage(caught, fallback)),
    [],
  );
  const writeContext = {
    branchId,
    items: list.items,
    stages: support.stages,
    capabilities,
    setError,
    report,
    reconcile,
  };
  const mutations = useLeadMutations({
    ...writeContext,
    currentPage: list.pageInfo.page,
    closeCreate: () => setIsCreateOpen(false),
    resetSearch: list.resetSearch,
    selectedForDelete,
    setSelectedForDelete,
  });
  const cardWrites = useLeadCardWrites({ ...writeContext, setItems: list.setItems });

  return {
    activeView,
    setActiveView,
    items: list.items,
    stages: support.stages,
    branchIds,
    branchId,
    selectBranch: (nextBranchId: string) => {
      selectBranch(nextBranchId);
      list.clear();
      list.resetSearch();
      setSelectedForDelete(null);
      setIsCreateOpen(false);
      setError(null);
    },
    canCreate: Boolean(capabilities?.create),
    canUpdateLead: (lead: LeadItem) => crmCapabilityAllowsOwner(capabilities?.update, lead.ownerUserId),
    canDeleteLead: (lead: LeadItem) => crmCapabilityAllowsOwner(capabilities?.delete, lead.ownerUserId),
    isLoading: list.isLoading || support.isLoading,
    isDeleting: mutations.isDeleting,
    isMovePending: mutations.isMovePending,
    error,
    loadError: list.loadError,
    degraded: support.degraded,
    search: list.search,
    appliedSearch: list.appliedSearch,
    setSearch: list.changeSearch,
    submitSearch: list.submitSearch,
    pageInfo: list.pageInfo,
    setPage: list.changePage,
    sort: list.sort,
    setSort: list.changeSort,
    isCreateOpen,
    setIsCreateOpen,
    openCreate,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate: mutations.handleCreate,
    handleDelete: mutations.handleDelete,
    moveLead: mutations.moveLead,
    bulkMoveStage: mutations.bulkMoveStage,
    bulkDeleteLeads: mutations.bulkDeleteLeads,
    updateLeadCard: cardWrites.updateLeadCard,
    updateLeadInline: cardWrites.updateLeadInline,
    bulkUpdateLeads: cardWrites.bulkUpdateLeads,
    /** The Retry action: the list and, with it, any supporting source that failed. */
    fetchLeads: () => Promise.all([reload(), support.reload()]).then(([reloaded]) => reloaded),
    dataRevision,
    refreshData: () => reconcile(),
  };
}
