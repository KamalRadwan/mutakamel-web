import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { createDesignerInteractionController } from "../../designer-interaction-controller";
import type { DesignerInteractionExit } from "../../designer-interaction-exit";
import type { DesignerInteractionBridge, DesignerNativeGeometry } from "../../designer-interaction-contract";
import { inspectorArrangementAffordances } from "../inspector/inspector-affordances";

const arrows = new Map<string, readonly [number, number]>([
  ["ArrowLeft", [-1, 0]], ["ArrowRight", [1, 0]], ["ArrowUp", [0, -1]], ["ArrowDown", [0, 1]],
]);

export function useDesignerInteractions(bridge: DesignerInteractionBridge, native: DesignerNativeGeometry, exit: DesignerInteractionExit) {
  const [instance] = useState(() => ({ native, controller: createDesignerInteractionController(bridge, native) }));
  const { controller } = instance;
  useLayoutEffect(() => { if (instance.native !== native) controller.dispose(); else controller.setBridge(bridge); });
  useEffect(() => () => controller.dispose(), [controller]);
  useLayoutEffect(() => exit.register("model", { read: () => controller.getSnapshot().active ? "active" : "inactive", cancel: () => controller.cancel() }), [exit, controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const providerCurrent = instance.native === native;
  const nudgeEligible = providerCurrent && inspectorArrangementAffordances(bridge.read().document, state.selectedIds).eligible;
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || !providerCurrent) return;
    // Each control, including portalled dialogs, owns its own keyboard events.
    if (event.target !== event.currentTarget) return;

    if (event.key === "Escape") {
      const handled = exit.hasActive()
        ? exit.cancelAllCurrent(exit.ticket)
        : bridge.selection().length > 0 && controller.select([]);
      if (handled) event.preventDefault();
      return;
    }

    const arrow = arrows.get(event.key);
    if (!arrow || exit.hasActive() || !bridge.canEdit()) return;
    const current = bridge.read();
    if (current.gestureActive || !inspectorArrangementAffordances(current.document, bridge.selection()).eligible) return;

    event.preventDefault();
    const [x, y] = arrow;
    const step = event.shiftKey ? 10 : 1;
    controller.nudge({ x: x * step, y: y * step });
  };
  return { state, controller, keyboard, providerCurrent, nudgeEligible };
}
