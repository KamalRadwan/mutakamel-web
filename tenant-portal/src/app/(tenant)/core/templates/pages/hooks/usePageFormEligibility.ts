"use client";
import { useSyncExternalStore } from "react";
import type { EditorDocument } from "../../template-editor-model";
import type { PageController } from "../page-controller";

/** Consume the actual owner façade's admission; do not reconstruct canEdit, roles or provider freshness here. */
export function usePageFormEligibility(controller: PageController, base: EditorDocument) {
  const current = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const canMutate = () => {
    const snapshot = controller.getSnapshot();
    return snapshot.editable && snapshot.document === base;
  };
  const guard = <Args extends unknown[],>(operation: (...args: Args) => void) => (...args: Args): void => {
    if (canMutate()) operation(...args);
  };
  const finishApply = (changed: boolean, unchanged: () => boolean, close: () => void) => {
    const snapshot = controller.getSnapshot();
    if (!snapshot.editable || !snapshot.document) return;
    if (changed || (snapshot.document === base && !snapshot.error && unchanged())) close();
  };
  return { editable: current.editable && current.document === base, canMutate, guard, finishApply,
    failure: current.blocked ?? (current.document !== base ? "stale" as const : current.error) };
}
