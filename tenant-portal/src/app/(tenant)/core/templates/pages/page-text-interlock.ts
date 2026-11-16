import type { createRichTextHostInterlock } from "../[id]/rich-text/rich-text-host-interlock";
import type { PageController } from "./page-controller";
import type { PageSnapshot } from "./page-contract";

/** Exact T14 R2 port. T01 owns the instance and lease; this adapter never acquires or releases it. */
export type PageTextInterlock = Pick<ReturnType<typeof createRichTextHostInterlock>, "getSnapshot" | "subscribe" | "runExternal">;

export function guardPageCallback<Args extends unknown[]>(interlock: PageTextInterlock, operation: (...args: Args) => void): (...args: Args) => void {
  return (...args) => { interlock.runExternal(() => operation(...args)); };
}

/** No document/history mirror. Guard every event against the live lease, including old callbacks. */
export function createTextInterlockedPageController(base: PageController, interlock: PageTextInterlock): PageController {
  let previous: PageSnapshot | null = null, cached: PageSnapshot | null = null;
  const run = <T,>(operation: () => T, refused: T): T => {
    const result = interlock.runExternal(operation);
    return result.executed ? result.value : refused;
  };
  return {
    ...base,
    getSnapshot() {
      const state = base.getSnapshot();
      if (!interlock.getSnapshot().active) { previous = null; cached = null; return state; }
      if (previous !== state || !cached) {
        previous = state;
        // Busy is also an event refusal: existing dialog hooks must not treat false as a no-op and close.
        cached = Object.freeze({ ...state, editable: false, blocked: "busy", error: "busy" });
      }
      return cached;
    },
    subscribe(listener) {
      const offBase = base.subscribe(listener), offText = interlock.subscribe(listener);
      return () => { offBase(); offText(); };
    },
    navigate: key => run(() => base.navigate(key), false),
    setPageSetup: (...args) => run(() => base.setPageSetup(...args), false),
    setZones: (...args) => run(() => base.setZones(...args), false),
    addPage: (...args) => run(() => base.addPage(...args), false),
    duplicatePage: (...args) => run(() => base.duplicatePage(...args), false),
    reorderPage: (...args) => run(() => base.reorderPage(...args), false),
    requestRemoval: (...args) => run(() => base.requestRemoval(...args), null),
    confirmRemoval: (...args) => run(() => base.confirmRemoval(...args), false),
    moveSelection: (...args) => run(() => base.moveSelection(...args), false),
    setFlowFlags: (...args) => run(() => base.setFlowFlags(...args), false),
    insertPageBreak: (...args) => run(() => base.insertPageBreak(...args), false),
  };
}
