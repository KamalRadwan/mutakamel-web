"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { EditorDocument } from "../../template-editor-model";
import type { InspectorArrangement, InspectorBridge } from "./inspector-contract";
import { inspectorArrangementAffordances } from "./inspector-affordances";

export function inspectorSelectionFlag(document: EditorDocument, ids: readonly string[], key: "locked" | "hidden"): boolean | "indeterminate" {
  const values = ids.map(id => document.nodes[id]?.[key]).filter((value): value is boolean => typeof value === "boolean");
  return values.length && values.some(value => value !== values[0]) ? "indeterminate" : values[0] ?? false;
}
export function useInspectorLayers(document: EditorDocument, bridge: InspectorBridge, arrangement?: InspectorArrangement, pendingProperties = false) {
  const [failed, setFailed] = useState(false);
  const { lang } = useI18n();
  const nodes: { id: string; depth: number }[] = [], seen = new Set<string>();
  const walk = (ids: string[], depth: number) => ids.forEach(id => {
    if (seen.has(id) || !document.nodes[id]) return;
    seen.add(id); nodes.push({ id, depth }); walk(document.nodes[id].childIds, depth + 1);
  });
  walk(document.rootNodeIds, 0);
  // Fixed-page-only roots and hidden nodes remain discoverable.
  Object.keys(document.nodes).forEach(id => { if (!seen.has(id)) walk([id], 0); });
  const action = (run: () => boolean, capability?: "forward" | "backward" | "group" | "ungroup") => () => {
    if (pendingProperties || !bridge.canEdit() || bridge.read().gestureActive || (capability && !inspectorArrangementAffordances(bridge.read().document, bridge.selection())[capability])) { setFailed(true); return; }
    setFailed(!run());
  };
  return { nodes, failed, number: new Intl.NumberFormat({ ar: "ar-EG-u-nu-latn", en: "en-US" }[lang]), select: (id: string) => () => { setFailed(pendingProperties || !bridge.context().canRead || !bridge.select([id])); },
    forward: action(() => arrangement?.layer(1) ?? false, "forward"), backward: action(() => arrangement?.layer(-1) ?? false, "backward"),
    group: action(() => arrangement?.group() ?? false, "group"), ungroup: action(() => arrangement?.ungroup() ?? false, "ungroup"),
    lock: (checked: boolean | "indeterminate") => action(() => arrangement?.flags({ locked: checked === true }) ?? false)(),
    hide: (checked: boolean | "indeterminate") => action(() => arrangement?.flags({ hidden: checked === true }) ?? false)(),
  };
}
