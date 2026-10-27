import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useCollapsedColumns } from "@/design-system";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { CrmActivityState } from "../../../../shared/crm-activity-tone";
import type { OpportunityCardRecord } from "../../../hooks/pipeline-types";
import type { OpportunityExecutiveBoardViewProps } from "../opportunity-board-types";

export function useOpportunityBoard(props: OpportunityExecutiveBoardViewProps) {
  const { lang } = useI18n();
  const { canMutate } = useAccessMode();
  const [draggingItem, setDraggingItem] = useState<OpportunityCardRecord | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  // Persisted per route like the lead board, so a collapsed stage survives a reload.
  const { isCollapsed: isStageCollapsed, toggle: toggleStoredCollapse } = useCollapsedColumns();
  const [peekStageId, setPeekStageId] = useState<string | null>(null);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [columnActivityFilter, setColumnActivityFilter] = useState<Record<string, CrmActivityState | null>>({});
  const [quickAddStageId, setQuickAddStageId] = useState<string | null>(null);
  const [expandedOpportunityId, setExpandedOpportunityId] = useState<string | null>(null);
  const stages = useMemo(() => props.pipeline?.stages ?? [], [props.pipeline]);
  const laneByStageId = useMemo(
    () => new Map((props.board?.stages ?? []).map((lane) => [lane.stage.id, lane])),
    [props.board],
  );
  const moveTargets = useMemo(
    () => stages.map((stage) => ({ id: stage.id, label: localizedName(stage, lang) })),
    [stages, lang],
  );

  useEffect(() => () => {
    if (peekTimerRef.current !== null) clearTimeout(peekTimerRef.current);
  }, []);

  function clearPeekTimer() {
    if (peekTimerRef.current !== null) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
  }

  function clearDragState() {
    clearPeekTimer();
    setDraggingItem(null);
    setDragOverStageId(null);
    setPeekStageId(null);
  }

  function canUpdate(item: OpportunityCardRecord) { return canMutate && props.canUpdate(item); }
  function canDelete(item: OpportunityCardRecord) { return canMutate && props.canDelete(item); }

  function toggleCollapse(stageId: string) {
    clearPeekTimer();
    setPeekStageId(null);
    toggleStoredCollapse(stageId);
  }

  function startPeek(stageId: string) {
    if (peekTimerRef.current !== null) return;
    setPeekStageId((current) => current === stageId ? current : null);
    peekTimerRef.current = setTimeout(() => {
      setPeekStageId(stageId);
      peekTimerRef.current = null;
    }, 380);
  }

  function stopPeek() {
    clearPeekTimer();
    setPeekStageId(null);
  }

  function onDragOver(event: DragEvent, stageId: string, collapsed: boolean) {
    if (!draggingItem || !canUpdate(draggingItem) || props.isMutating || draggingItem.stageId === stageId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStageId(stageId);
    if (collapsed) startPeek(stageId);
  }

  function onDragLeave(event: DragEvent, stageId: string) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      clearPeekTimer();
      setDragOverStageId((current) => current === stageId ? null : current);
      setPeekStageId((current) => current === stageId ? null : current);
    }
  }

  function onDrop(event: DragEvent, stageId: string) {
    event.preventDefault();
    if (draggingItem && canUpdate(draggingItem) && !props.isMutating && draggingItem.stageId !== stageId) {
      // Parent moveCard owns terminal and reopen confirmations; a drop never writes directly.
      props.onMoveCard(draggingItem.id, draggingItem.stageId, stageId);
    }
    clearDragState();
  }

  return {
    stages, laneByStageId, moveTargets, draggingItem, dragOverStageId,
    quickAddStageId, expandedOpportunityId, columnActivityFilter,
    canCreate: canMutate && props.canCreate, canUpdate, canDelete,
    isCollapsed: (stageId: string) => isStageCollapsed(stageId) && peekStageId !== stageId,
    toggleCollapse, startPeek, stopPeek, onDragOver, onDragLeave, onDrop,
    clearDragState, startDrag: setDraggingItem,
    toggleExpand: (id: string) => setExpandedOpportunityId((current) => current === id ? null : id),
    toggleActivityFilter: (stageId: string, state: CrmActivityState) => setColumnActivityFilter((current) => ({
      ...current, [stageId]: current[stageId] === state ? null : state,
    })),
    clearActivityFilter: (stageId: string) => setColumnActivityFilter((current) => ({ ...current, [stageId]: null })),
    toggleQuickAdd: (id: string) => setQuickAddStageId((current) => current === id ? null : id),
    closeQuickAdd: () => setQuickAddStageId(null),
    created: () => { setQuickAddStageId(null); props.onRefreshBoard?.(); },
    openFullCreate: props.onOpenFullCreate,
  };
}

export type OpportunityBoardState = ReturnType<typeof useOpportunityBoard>;
