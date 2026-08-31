"use client";

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { PlacementBox } from "../../dashboard-layout";
import type { DashboardPlacement } from "../../dashboard-contract";

interface DashboardLayoutEditorProps {
  draft: PlacementBox[];
  placements: DashboardPlacement[];
  hiddenCount: number;
  onMove: (id: string, offset: -1 | 1) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

/**
 * Reordering the placement list.
 *
 * Drag is **never the only path**: every row also carries earlier/later
 * buttons, which is the same WCAG requirement the board's Move-to menu exists
 * for (MASTER-PLAN 2.7 / audit B3). The saved geometry is repacked from this
 * order — see `dashboard-layout.ts`.
 */
export function DashboardLayoutEditor({
  draft,
  placements,
  hiddenCount,
  onMove,
  onReorder,
}: DashboardLayoutEditorProps) {
  const { t } = useI18n();
  const byId = new Map(placements.map((placement) => [placement.id, placement]));

  function handleDragEnd(result: DropResult): void {
    if (!result.destination) return;
    onReorder(result.source.index, result.destination.index);
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-border bg-card p-2.5">
      <p className="text-xs text-muted-foreground">{t.crmDashboards.layoutHint}</p>
      {hiddenCount > 0 ? (
        <p role="note" className="text-xs text-muted-foreground">
          {t.crmDashboards.layoutHiddenNote}
        </p>
      ) : null}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard-layout">
          {(provided) => (
            <ul ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1">
              {draft.map((box, index) => {
                const placement = byId.get(box.id);
                return (
                  <Draggable key={box.id} draggableId={box.id} index={index}>
                    {(draggable) => (
                      <li
                        ref={draggable.innerRef}
                        {...draggable.draggableProps}
                        className="flex items-center gap-2 rounded-sm border border-border bg-background p-2"
                      >
                        <span
                          {...draggable.dragHandleProps}
                          aria-label={t.crmDashboards.dragHandle}
                          className="text-muted-foreground"
                        >
                          <GripVertical className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                          {placement?.widget.name ?? box.id}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={index === 0}
                          aria-label={`${t.crmDashboards.moveEarlier}: ${placement?.widget.name ?? box.id}`}
                          onClick={() => onMove(box.id, -1)}
                        >
                          <ChevronUp className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={index === draft.length - 1}
                          aria-label={`${t.crmDashboards.moveLater}: ${placement?.widget.name ?? box.id}`}
                          onClick={() => onMove(box.id, 1)}
                        >
                          <ChevronDown className="size-4" aria-hidden="true" />
                        </Button>
                      </li>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
