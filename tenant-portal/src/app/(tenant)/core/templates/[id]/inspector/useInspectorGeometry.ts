"use client";
import { useState, type FormEvent } from "react";
import type { EditorNode } from "../../template-editor-model";
import type { InspectorArrangement, InspectorBridge } from "./inspector-contract";
import { inspectorArrangementAffordances } from "./inspector-affordances";

export function useInspectorGeometry(node: EditorNode, bridge: InspectorBridge, arrangement: InspectorArrangement, disabled: boolean) {
  const initial = { x: Number(node.layout.x), y: Number(node.layout.y), width: Number(node.layout.width), height: Number(node.layout.height), rotationDeg: Number(node.layout.rotationDeg) };
  const [frame, setFrame] = useState(initial), [failed, setFailed] = useState(false);
  const [context] = useState(() => ({ key: bridge.context().key, generation: bridge.read().generation, layout: JSON.stringify(node.layout) }));
  return { frame, failed, change: (key: keyof typeof frame) => (value: number) => setFrame(old => ({ ...old, [key]: value })),
    submit: (event: FormEvent) => {
      event.preventDefault();
      const state = bridge.read(), selected = bridge.selection();
      if (disabled || !inspectorArrangementAffordances(state.document, selected).eligible || !bridge.canEdit() || state.gestureActive || context.key !== bridge.context().key || context.generation !== state.generation || selected.length !== 1 || selected[0] !== node.id || JSON.stringify(state.document?.nodes[node.id]?.layout) !== context.layout) { setFailed(true); return; }
      setFailed(!arrangement.resizeNumeric(frame));
    },
  };
}
