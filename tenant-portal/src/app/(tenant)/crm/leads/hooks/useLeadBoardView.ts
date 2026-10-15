"use client";

import { useEffect, useRef, useState } from "react";
import type { DragStart, DropResult } from "@hello-pangea/dnd";
import { useCollapsedColumns } from "@/design-system";
import type { LeadItem, LeadStage } from "./useLeads";

// A converted lead is finished: the backend rejects the move, so the stage is
// neither a drag source nor a drop target — see docs/api/crm-leads.md.
export const LEAD_TERMINAL_STAGE_FLAG = "CONVERTED";

// Long enough that sweeping a card across a collapsed column on the way to
// another does not open it, short enough to feel like a response to hovering.
const PEEK_DELAY_MS = 400;

interface LeadBoardViewOptions {
  stages: readonly LeadStage[];
  items: readonly LeadItem[];
  onMoveStage: (leadId: string, toStageId: string, lead?: LeadItem) => void;
}

/** The board's own view state: collapsed columns, filters, the open card, the drag. */
export function useLeadBoardView({ stages, items, onMoveStage }: LeadBoardViewOptions) {
  // Remembered per screen across visits, the same store every board shares.
  const collapsed = useCollapsedColumns();
  const [activityFilter, setActivityFilter] = useState<Record<string, string | null>>({});
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [quickAddStageId, setQuickAddStageId] = useState<string | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  // Read once per mount rather than per render: stage ages are counted in
  // hours and days, and every card measuring against the same instant keeps
  // two leads that entered together from showing different ages.
  const [now] = useState(() => Date.now());
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
  }, []);

  function cancelPeek() {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = null;
  }

  function handleDragEnd(result: DropResult) {
    setDraggingLeadId(null);
    cancelPeek();
    const toStageId = result.destination?.droppableId;
    if (!toStageId || toStageId === result.source.droppableId) return;
    const target = stages.find(({ id }) => id === toStageId);
    const lead = items.find(({ id }) => id === result.draggableId);
    if (!target || !lead || target.flag === LEAD_TERMINAL_STAGE_FLAG) return;
    onMoveStage(lead.id, toStageId, lead);
  }

  return {
    now,
    draggingLeadId,
    expandedLeadId,
    quickAddStageId,
    isCollapsed: collapsed.isCollapsed,
    toggleCollapsed: collapsed.toggle,
    activityFilterOf: (stageId: string) => activityFilter[stageId] ?? null,
    setActivityFilter: (stageId: string, state: string | null) =>
      setActivityFilter((current) => ({ ...current, [stageId]: state })),
    toggleExpanded: (leadId: string) =>
      setExpandedLeadId((current) => (current === leadId ? null : leadId)),
    openQuickAdd: setQuickAddStageId,
    closeQuickAdd: () => setQuickAddStageId(null),
    handleDragStart: (start: DragStart) => setDraggingLeadId(start.draggableId),
    handleDragEnd,
    // Opens a collapsed column the dragged card lingers over, so it can be
    // dropped there without letting go first.
    peekCollapsed: (stageId: string) => {
      if (!draggingLeadId) return;
      cancelPeek();
      peekTimer.current = setTimeout(() => {
        if (collapsed.isCollapsed(stageId)) collapsed.toggle(stageId);
      }, PEEK_DELAY_MS);
    },
    cancelPeek,
  };
}

export type LeadBoardViewState = ReturnType<typeof useLeadBoardView>;
