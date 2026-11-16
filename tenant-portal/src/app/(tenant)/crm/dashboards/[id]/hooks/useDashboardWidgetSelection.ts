"use client";
import { useState } from "react";
import type { WidgetDefinition } from "../../widget-contract";
export function useDashboardWidgetSelection(widgets: WidgetDefinition[], placedIds: ReadonlySet<string>, blocked: boolean, unavailable: boolean, atCapacity: boolean, onSubmit: (id: string) => void) {
  const [widgetId, setWidgetId] = useState(""); const options = widgets.filter((widget) => !placedIds.has(widget.id));
  const allowed = !blocked && !unavailable && !atCapacity && options.some((widget) => widget.id === widgetId);
  return { widgetId, setWidgetId, options, allowed, submit: () => { if (allowed) onSubmit(widgetId); } };
}
