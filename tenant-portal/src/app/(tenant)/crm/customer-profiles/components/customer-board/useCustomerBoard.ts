"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useCollapsedColumns } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { crmActivityState, type CrmActivityState } from "../../../shared/crm-activity-tone";
import { CUSTOMER_PROFILE_BOARD_STATUSES } from "../../hooks/useCustomerProfileBoard";
import type { CustomerProfileItem, CustomerProfileStatus } from "../../hooks/useCustomerProfiles";
import type { CustomerExecutiveBoardViewProps } from "./customer-board-types";

export function useCustomerBoard(props: CustomerExecutiveBoardViewProps) {
  const { t, lang } = useI18n();
  const statusLabels: Record<string, string | undefined> = t.statusValues;
  const [draggingItem, setDraggingItem] = useState<CustomerProfileItem | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<CustomerProfileStatus | null>(null);
  // Persisted per route like the lead board, so a collapsed status survives a reload.
  const { isCollapsed: isStatusCollapsed, toggle: toggleStoredCollapse } = useCollapsedColumns();
  const [peekStatus, setPeekStatus] = useState<CustomerProfileStatus | null>(null);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [columnActivityFilter, setColumnActivityFilter] = useState<
    Partial<Record<CustomerProfileStatus, CrmActivityState | null>>
  >({});
  const [quickAddStatus, setQuickAddStatus] = useState<CustomerProfileStatus | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  const itemsByStatus = useMemo(() => {
    const map = new Map<CustomerProfileStatus, CustomerProfileItem[]>();
    for (const status of CUSTOMER_PROFILE_BOARD_STATUSES) map.set(status, []);
    for (const item of props.items) map.get(item.status)?.push(item);
    return map;
  }, [props.items]);

  useEffect(() => () => {
    if (peekTimerRef.current !== null) clearTimeout(peekTimerRef.current);
  }, []);

  function cancelPeek() {
    if (peekTimerRef.current !== null) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = null;
  }

  function peekColumn(status: CustomerProfileStatus) {
    if (!draggingItem || peekTimerRef.current !== null) return;
    peekTimerRef.current = setTimeout(() => {
      setPeekStatus(status);
      peekTimerRef.current = null;
    }, 400);
  }

  function endDrag() {
    cancelPeek();
    setDraggingItem(null);
    setDragOverStatus(null);
    setPeekStatus(null);
  }

  function startDrag(item: CustomerProfileItem, event: DragEvent<HTMLDivElement>) {
    if (!props.canUpdate(item)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
    setDraggingItem(item);
  }

  function moveDraggedItem(status: CustomerProfileStatus) {
    if (draggingItem && draggingItem.status !== status && props.canUpdate(draggingItem)) {
      props.onCardMove({ itemId: draggingItem.id, fromColumnId: draggingItem.status,
        toColumnId: status, toIndex: 0 });
    }
    endDrag();
  }

  function dragOver(status: CustomerProfileStatus, event: DragEvent) {
    if (!draggingItem || draggingItem.status === status) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
    if (isStatusCollapsed(status)) peekColumn(status);
  }

  function drop(status: CustomerProfileStatus, event: DragEvent) {
    event.preventDefault();
    moveDraggedItem(status);
  }

  function dragLeave(status: CustomerProfileStatus, event: DragEvent) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    cancelPeek();
    if (dragOverStatus === status) setDragOverStatus(null);
  }

  function toggleCollapse(status: CustomerProfileStatus) {
    cancelPeek();
    setPeekStatus(null);
    toggleStoredCollapse(status);
  }

  function toggleActivityFilter(status: CustomerProfileStatus, state: CrmActivityState) {
    setColumnActivityFilter((current) => ({
      ...current, [status]: current[status] === state ? null : state,
    }));
  }

  function clearActivityFilter(status: CustomerProfileStatus) {
    setColumnActivityFilter((current) => ({ ...current, [status]: null }));
  }

  function statusTitle(status: CustomerProfileStatus) {
    return statusLabels[`CustomerStatus.${status}`] ?? status;
  }

  function columnItems(status: CustomerProfileStatus) {
    const allItems = itemsByStatus.get(status) ?? [];
    const activeState = columnActivityFilter[status] ?? null;
    const visibleItems = activeState
      ? allItems.filter((item) => crmActivityState(item.nextActivity) === activeState)
      : allItems;
    return { allItems, visibleItems, activeState };
  }

  return {
    ...props, t, lang, statusTitle, columnItems, draggingItem, dragOverStatus, quickAddStatus,
    expandedCustomerId, setExpandedCustomerId, setQuickAddStatus, startDrag, endDrag,
    dragOver, dragLeave, drop, moveDraggedItem, peekColumn, cancelPeek, toggleCollapse,
    toggleActivityFilter, clearActivityFilter,
    isCollapsed: (status: CustomerProfileStatus) => isStatusCollapsed(status) &&
      !(draggingItem && peekStatus === status),
    draggingFromLabel: draggingItem ? statusTitle(draggingItem.status) : "",
    draggingToLabel: dragOverStatus ? statusTitle(dragOverStatus) : "",
  };
}
