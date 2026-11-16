"use client";

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronUp, GripVertical, Minus, Plus } from "lucide-react";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn, mirrorInRtl } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { PlacementAdjustment, PlacementBox } from "../../dashboard-layout";
import type { DashboardPlacement } from "../../dashboard-contract";

interface DashboardLayoutEditorProps {
  disabled?: boolean;
  draft: PlacementBox[];
  placements: DashboardPlacement[];
  hiddenCount: number;
  onMove: (id: string, offset: -1 | 1) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  selected?: PlacementBox;
  onSelect: (id: string) => void;
  onAdjust: (id: string, adjustment: PlacementAdjustment) => void;
  canAdjust: (id: string, adjustment: PlacementAdjustment) => boolean;
}

const adjustments = [
  { key: "start", property: "x", step: -1, icon: ArrowLeft, mirrors: true },
  { key: "end", property: "x", step: 1, icon: ArrowRight, mirrors: true },
  { key: "up", property: "y", step: -1, icon: ArrowUp },
  { key: "down", property: "y", step: 1, icon: ArrowDown },
  { key: "narrower", property: "width", step: -1, icon: Minus },
  { key: "wider", property: "width", step: 1, icon: Plus },
  { key: "shorter", property: "height", step: -1, icon: Minus },
  { key: "taller", property: "height", step: 1, icon: Plus },
] as const;

export function DashboardLayoutEditor({
  draft,
  placements,
  hiddenCount,
  onMove,
  onReorder,
  selected,
  onSelect,
  onAdjust,
  canAdjust,
  disabled = false,
}: DashboardLayoutEditorProps) {
  const { t, lang } = useI18n();
  const geometry = t.crmDashboards.geometry;
  const byId = new Map(placements.map((placement) => [placement.id, placement]));

  function handleDragEnd(result: DropResult): void {
    if (disabled || !result.destination) return;
    onReorder(result.source.index, result.destination.index);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      {selected && <section className="grid gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid w-full max-w-xs gap-1">
            <Label htmlFor="dashboard-layout-target">{geometry.widget}</Label>
            <Select value={selected.id} onValueChange={onSelect} disabled={disabled}>
              <SelectTrigger id="dashboard-layout-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                {draft.map((box) => <SelectItem key={box.id} value={box.id}>{byId.get(box.id)?.widget.name ?? t.crmDashboards.review.unavailable}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p role="status" className="text-sm text-muted-foreground">{formatTemplate(geometry.summary, {
            column: formatNumber(selected.x + 1, lang), row: formatNumber(selected.y + 1, lang),
            width: formatNumber(selected.width, lang), height: formatNumber(selected.height, lang),
          })}</p>
        </div>
        <div role="group" aria-label={geometry.actions} className="flex flex-wrap gap-2">
          {adjustments.map(({ key, property, step, icon: Icon, ...direction }) => <Button key={key} variant="outline"
            disabled={disabled || !canAdjust(selected.id, { property, step })}
            onClick={() => onAdjust(selected.id, { property, step })}>
            <Icon className={cn("size-4", "mirrors" in direction && mirrorInRtl)} aria-hidden="true" />{geometry[key]}
          </Button>)}
        </div>
        <p className="text-xs text-muted-foreground">{geometry.hint}</p>
      </section>}
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
                  <Draggable key={box.id} draggableId={box.id} index={index} isDragDisabled={disabled}>
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
                          {placement?.widget.name ?? t.crmDashboards.review.unavailable}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={disabled || index === 0}
                          aria-label={`${t.crmDashboards.moveEarlier} · ${placement?.widget.name ?? t.crmDashboards.review.unavailable}`}
                          onClick={() => onMove(box.id, -1)}
                        >
                          <ChevronUp className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={disabled || index === draft.length - 1}
                          aria-label={`${t.crmDashboards.moveLater} · ${placement?.widget.name ?? t.crmDashboards.review.unavailable}`}
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
