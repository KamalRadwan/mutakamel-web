"use client";
import { GripHorizontal, MoveDiagonal2 } from "lucide-react";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Card, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { DashboardDetail } from "../../dashboard-contract";
import type { DashboardCatalog } from "../../dashboard-catalog-contract";
import type { DashboardFilterSelection, DashboardRunResult } from "../../dashboard-run-contract";
import type { WidgetDefinition } from "../../widget-contract";
import type { PlacementBox, PlacementGeometry } from "../../dashboard-layout";
import { WidgetTile } from "./WidgetTile";
import { currentDrillCurrency } from "../../widget-drill-admission";
const position = (box: { x: number; y: number; width: number; height: number }): CSSProperties => ({
  "--placement-column": `${box.x + 1} / span ${box.width}`,
  "--placement-row": `${box.y + 1} / span ${box.height}`,
} as CSSProperties);
interface CanvasLayoutControls {
  select: (id: string) => void;
  canPosition: (id: string, geometry: PlacementGeometry) => boolean;
  position: (id: string, geometry: PlacementGeometry) => void;
}
interface LayoutGesture {
  mode: "move" | "resize";
  original: PlacementBox;
  pointerId: number;
  startX: number;
  startY: number;
  columnPitch: number;
  rowPitch: number;
  direction: 1 | -1;
}

function useCanvasLayoutGesture(layoutControls: CanvasLayoutControls | undefined) {
  const grid = useRef<HTMLDivElement>(null);
  const gesture = useRef<LayoutGesture | null>(null);
  const [ghost, setGhost] = useState<PlacementGeometry | null>(null);

  function start(event: PointerEvent<HTMLSpanElement>, original: PlacementBox, mode: LayoutGesture["mode"]) {
    const element = grid.current;
    if (!element || !layoutControls || !event.isPrimary || event.button !== 0) return;
    const style = getComputedStyle(element);
    const columns = style.gridTemplateColumns.split(" ");
    const rowPitch = Number.parseFloat(style.gridAutoRows) + Number.parseFloat(style.rowGap);
    const columnPitch = Number.parseFloat(columns[0]) + Number.parseFloat(style.columnGap);
    if (columns.length !== 12 || !Number.isFinite(rowPitch) || rowPitch <= 0 || !Number.isFinite(columnPitch) || columnPitch <= 0) return;
    const rect = element.getBoundingClientRect();
    gesture.current = { mode, original, pointerId: event.pointerId, startX: event.clientX - rect.left,
      startY: event.clientY - rect.top, columnPitch, rowPitch, direction: style.direction === "rtl" ? -1 : 1 };
    event.currentTarget.setPointerCapture(event.pointerId);
    setGhost(null);
    layoutControls.select(original.id);
  }
  function candidate(event: PointerEvent<HTMLSpanElement>) {
    const active = gesture.current;
    const rect = grid.current?.getBoundingClientRect();
    if (!active || active.pointerId !== event.pointerId || !rect || !layoutControls) return null;
    const { id, x, y, width, height } = active.original;
    const dx = Math.round(active.direction * (event.clientX - rect.left - active.startX) / active.columnPitch);
    const dy = Math.round((event.clientY - rect.top - active.startY) / active.rowPitch);
    const geometry = active.mode === "move" ? { x: x + dx, y: y + dy, width, height }
      : { x, y, width: width + dx, height: height + dy };
    return layoutControls.canPosition(id, geometry) ? { id, geometry } : null;
  }
  function cancel(event: PointerEvent<HTMLSpanElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    setGhost(null);
  }
  function finish(event: PointerEvent<HTMLSpanElement>) {
    const next = candidate(event);
    if (next) layoutControls?.position(next.id, next.geometry);
    cancel(event);
  }
  function preview(event: PointerEvent<HTMLSpanElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    const next = candidate(event)?.geometry ?? null;
    setGhost((current) => current?.x === next?.x && current?.y === next?.y
      && current?.width === next?.width && current?.height === next?.height ? current : next);
  }
  return { grid, ghost, start, preview, finish, cancel };
}

export function DashboardCanvas({ detail, run, catalog, selection, editing, draft, selectedId, layoutControls, pendingPlacementId, onRemove, onDrilldown, governance, onPlacementVersion }: {
  detail: DashboardDetail; run: DashboardRunResult | null; selection: DashboardFilterSelection; editing: boolean; pendingPlacementId: string | null;
  catalog?: DashboardCatalog | null;
  draft?: readonly PlacementBox[];
  selectedId?: string;
  layoutControls?: CanvasLayoutControls;
  governance?: { actorId: string; archive: (widgetId: string, anchor: HTMLButtonElement | null) => boolean };
  onPlacementVersion?: (placementId: string, widgetId: string, name: string, anchor: HTMLButtonElement | null) => boolean;
  onRemove: (id: string) => void; onDrilldown: (widget: WidgetDefinition, key: string, label: string, selection: DashboardFilterSelection) => void;
}) {
  const { t } = useI18n();
  const { grid, ghost, start, preview, finish, cancel } = useCanvasLayoutGesture(layoutControls);
  const byId = new Map(detail.placements.map((placement) => [placement.id, placement]));
  const placements = draft ? draft.flatMap((box) => {
    const placement = byId.get(box.id);
    return placement ? [{ ...placement, ...box }] : [];
  }) : detail.placements;
  return <div ref={grid} className={cn("grid grid-cols-1 gap-3 lg:grid-cols-12",
    editing ? "lg:auto-rows-[4rem]" : "lg:auto-rows-[minmax(4rem,auto)]")}>
    {placements.map((placement) => <div key={placement.id} style={position(placement)} className={cn(
      "min-w-0 lg:[grid-column:var(--placement-column)] lg:[grid-row:var(--placement-row)]",
      editing && "relative rounded-lg lg:bg-card",
      placement.id === selectedId && "rounded-lg ring-2 ring-ring",
    )}>
      <div className={editing ? "lg:max-h-full lg:overflow-auto" : "contents"}>
        <WidgetTile widget={placement.widget} result={run?.widgets[placement.widgetId]} catalog={catalog} effectiveCurrencyCode={currentDrillCurrency(detail.defaultFilters, placement.widget.querySpec.filters, selection.currencyCode)} placementId={placement.id} isRemoving={pendingPlacementId === placement.id}
          onArchive={governance && !editing && governance.actorId === placement.widget.ownerUserId ? (anchor) => governance.archive(placement.widgetId, anchor) : undefined}
          onVersion={onPlacementVersion && !editing ? (name, anchor) => onPlacementVersion(placement.id, placement.widgetId, name, anchor) : undefined}
          onDrilldown={(widget, key, label) => onDrilldown(widget, key, label, selection)} onRemove={editing ? onRemove : undefined} />
      </div>
      {layoutControls && (["move", "resize"] as const).map((mode) => {
        const Icon = mode === "move" ? GripHorizontal : MoveDiagonal2;
        return <span key={mode} title={t.crmDashboards.geometry[mode === "move" ? "dragMove" : "dragResize"]} aria-hidden="true"
          data-layout-gesture={mode}
          onPointerDown={(event) => start(event, placement, mode)}
          onPointerMove={preview}
          onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}
          className={cn("absolute z-(--z-sticky-cell) hidden size-8 touch-none select-none items-center justify-center rounded-md border border-border bg-card text-foreground shadow-xs lg:flex",
            mode === "move" ? "-top-2 start-2 cursor-grab active:cursor-grabbing"
              : "bottom-1 end-1 cursor-nwse-resize rtl:cursor-nesw-resize")}>
          <Icon className="size-4" />
        </span>;
      })}
    </div>)}
    {detail.unavailablePlacements.map((placement) => <Card key={placement.id} style={position(placement)} className="flex min-h-24 flex-col justify-center gap-2 border-dashed p-4 lg:[grid-column:var(--placement-column)] lg:[grid-row:var(--placement-row)]">
      <h3 className="text-sm font-medium">{t.crmDashboards.review.unavailable}</h3><p className="text-xs text-muted-foreground">{t.crmDashboards.layoutHiddenNote}</p>
    </Card>)}
    {layoutControls && ghost && <div aria-hidden="true" style={position(ghost)} data-layout-preview
      className="pointer-events-none z-(--z-sticky-header) hidden rounded-lg border-2 border-ring bg-accent/40 lg:block lg:[grid-column:var(--placement-column)] lg:[grid-row:var(--placement-row)]" />}
  </div>;
}

