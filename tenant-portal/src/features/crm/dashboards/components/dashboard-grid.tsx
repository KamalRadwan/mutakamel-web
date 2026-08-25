"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Responsive as ResponsiveGrid, type Layout } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { useDashboardStore } from "../models/useDashboardStore";
import { DashboardWidgetRenderer } from "./dashboard-widget-renderer";
import { DASHBOARD_COLUMN_COUNT } from "../models/dashboard-model";
import type { DashboardRunResult, CrmDashboardWidget } from "../models/dashboard-types";
import type { DashboardPointSelection } from "./renderers/dashboard-echarts-options";

interface DashboardGridProps {
  runResult?: DashboardRunResult;
  loading?: boolean;
  onPointSelect?: (widget: CrmDashboardWidget, selection: DashboardPointSelection) => void;
}

export function DashboardGrid({ runResult, loading, onPointSelect }: DashboardGridProps) {
  const { editMode, draftPlacements, updatePlacement } = useDashboardStore();

  const layout = useMemo(() => {
    return draftPlacements.map((p) => ({
      i: p.widgetId,
      x: p.x,
      y: p.y,
      w: p.width,
      h: p.height,
      minW: 2,
      minH: 2,
    }));
  }, [draftPlacements]);

  const handleLayoutChange = (currentLayout: Layout) => {
    if (!editMode || !Array.isArray(currentLayout)) return;
    currentLayout.forEach((item) => {
      updatePlacement(item.i, item.x, item.y, item.w, item.h);
    });
  };

  const [containerWidth, setContainerWidth] = useState<number>(1200);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[500px] p-2 sm:p-4 bg-slate-100/60 dark:bg-slate-950/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
      <ResponsiveGrid
        width={containerWidth}
        className={`layout ${editMode ? "dashboard-edit-mode" : ""}`}
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: DASHBOARD_COLUMN_COUNT, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={65}
        margin={[16, 16]}
        onLayoutChange={handleLayoutChange}
        isDraggable={editMode}
        isResizable={editMode}
        useCSSTransforms={true}
        compactType="vertical"
      >
        {draftPlacements.map((placement) => {
          const widget = placement.widget;
          const result = runResult?.widgets?.[widget.id];

          return (
            <div
              key={placement.widgetId}
              className={`w-full h-full relative ${
                editMode ? "cursor-move ring-2 ring-blue-500/40 rounded-xl" : ""
              }`}
            >
              {editMode && (
                <div className="absolute inset-x-0 top-0 h-4 bg-blue-500/10 dark:bg-blue-400/10 z-20 flex items-center justify-center cursor-move rounded-t-xl">
                  <div className="w-10 h-1 bg-blue-500 dark:bg-blue-400 rounded-full" />
                </div>
              )}

              <DashboardWidgetRenderer
                widget={widget}
                result={result}
                loading={loading}
                onPointSelect={(sel) => onPointSelect?.(widget, sel)}
              />
            </div>
          );
        })}
      </ResponsiveGrid>
    </div>
  );
}
