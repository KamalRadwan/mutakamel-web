"use client";

import { useEffect, useRef, useState } from "react";
import type { DropResult, DragStart, DragUpdate } from "@hello-pangea/dnd";
import { useCollapsedColumns } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useAccessMode } from "@/hooks/useAccessMode";
import { canCreateActivities } from "@/components/activities/activity-presentation";
import { useI18n } from "@/i18n/I18nContext";
import { useCrmAcquisitionSources } from "../../../shared/hooks/useCrmAcquisitionSources";
import type { LeadActivityState } from "../../lead-card-contract";
import type { LeadItem, LeadStage } from "../../lead-list-contract";
import type { QuickCreateLeadDraft } from "../../lead-create-contract";
import type { LeadExecutiveBoardViewProps } from "./lead-board-types";

export function useLeadBoard({
  stages,
  items,
  totals,
  branchId,
  canCreate: capabilityCanCreate,
  canUpdate: capabilityCanUpdate,
  canDelete: capabilityCanDelete,
  isMovePending,
  isLoading,
  error,
  onRetry,
  onOpenLead,
  onOpenQuickModal,
  onOpenActivities,
  onDeleteLead,
  onMoveStage,
  onCardChange,
  onOpenCreateModal,
  onQuickCreateLead,
  hasMoreStage,
  isLoadingMoreStage,
  onLoadMoreStage,
}: LeadExecutiveBoardViewProps) {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const { canMutate } = useAccessMode();
  const canCreate = canMutate && capabilityCanCreate;
  const canUpdate = (lead: LeadItem) => canMutate && capabilityCanUpdate(lead);
  const canDelete = (lead: LeadItem) => canMutate && capabilityCanDelete(lead);
  const canOpenActivities = canMutate && canCreateActivities(user);
  const { items: sources } = useCrmAcquisitionSources();

  const { isCollapsed: isColumnCollapsed, toggle: toggleCollapse } = useCollapsedColumns();
  const [columnActivityFilter, setColumnActivityFilter] = useState<
    Record<string, LeadActivityState | null>
  >({});
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [quickAddStageId, setQuickAddStageId] = useState<string | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragDestinationStageId, setDragDestinationStageId] = useState<string | null>(null);
  const hoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current);
    };
  }, []);

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const nonTerminalStages = stages.filter((s) => s.flag !== "CONVERTED");

  function toggleColumnActivityFilter(stageId: string, state: LeadActivityState) {
    setColumnActivityFilter((prev) => ({
      ...prev,
      [stageId]: prev[stageId] === state ? null : state,
    }));
  }

  function handleDragStart(start: DragStart) {
    setDraggingLeadId(start.draggableId);
    setDragDestinationStageId(start.source.droppableId);
  }

  function handleDragUpdate(update: DragUpdate) {
    setDragDestinationStageId(update.destination?.droppableId ?? null);
  }

  function handleDragEnd(result: DropResult) {
    cancelPeek();
    const draggedId = draggingLeadId;
    setDraggingLeadId(null);
    setDragDestinationStageId(null);
    if (!canMutate || !result.destination) return;
    const toStageId = result.destination.droppableId;
    const fromStageId = result.source.droppableId;
    if (toStageId === fromStageId) return;

    const targetStage = stageById.get(toStageId);
    const lead = items.find((item) => item.id === (draggedId ?? result.draggableId));
    if (!targetStage || !lead || isMovePending || !canUpdate(lead)) return;

    // Conversion needs the dedicated flow rather than a raw stage mutation.
    if (targetStage.flag === "CONVERTED") {
      onOpenLead(lead);
      return;
    }

    onMoveStage(lead.id, toStageId, lead);
  }

  const draggingLead = draggingLeadId ? items.find((item) => item.id === draggingLeadId) ?? null : null;
  const draggingFromStage = draggingLead ? stageById.get(draggingLead.stageId) : undefined;
  const draggingToStage = dragDestinationStageId ? stageById.get(dragDestinationStageId) : undefined;

  function cancelPeek() {
    if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current);
    hoverExpandTimerRef.current = null;
  }
  function peekStage(stageId: string) {
    if (!draggingLeadId) return;
    cancelPeek();
    hoverExpandTimerRef.current = setTimeout(() => {
      if (isColumnCollapsed(stageId)) toggleCollapse(stageId);
    }, 400);
  }
  function clearColumnActivityFilter(stageId: string) {
    setColumnActivityFilter((current) => ({ ...current, [stageId]: null }));
  }
  function openQuickAddFullModal(stageId: string, draft: QuickCreateLeadDraft) {
    setQuickAddStageId(null);
    onOpenCreateModal(stageId, draft);
  }
  async function submitQuickAdd(...args: Parameters<LeadExecutiveBoardViewProps["onQuickCreateLead"]>) {
    const ok = await onQuickCreateLead(...args);
    if (ok) setQuickAddStageId(null);
    return ok;
  }
  function dropOnStage(stage: LeadStage) {
    if (!draggingLead || isMovePending || !canUpdate(draggingLead)) return;
    cancelPeek();
    setDraggingLeadId(null);
    setDragDestinationStageId(null);
    if (stage.flag === "CONVERTED") onOpenLead(draggingLead);
    else onMoveStage(draggingLead.id, stage.id, draggingLead);
  }
  return {
    stages, items, totals, branchId, canCreate, canUpdate, canDelete,
    isMovePending, isLoading, error, onRetry, onOpenLead, onOpenQuickModal,
    onOpenActivities, onDeleteLead, onMoveStage, onCardChange,
    hasMoreStage, isLoadingMoreStage,
    onLoadMoreStage, t, lang, sources, canOpenActivities, nonTerminalStages,
    isColumnCollapsed, toggleCollapse, columnActivityFilter, clearColumnActivityFilter,
    editingLeadId, setEditingLeadId, quickAddStageId, setQuickAddStageId,
    draggingLeadId, dragDestinationStageId,
    draggingLead, draggingFromStage, draggingToStage,
    toggleColumnActivityFilter, handleDragStart, handleDragUpdate, handleDragEnd,
    peekStage, cancelPeek, openQuickAddFullModal, submitQuickAdd, dropOnStage,
  };
}
