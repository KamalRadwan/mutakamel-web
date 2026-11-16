import { generateUUIDv7 } from "@/lib/uuid";
import type { EditorDocument } from "./template-editor-model";
import type { DesignerInteractionBridge, DesignerNativeGeometry, Frame, GestureKind, GraphCommand, InteractionSnapshot, Point, ViewportMapping } from "./designer-interaction-contract";
import { absoluteFrame, assertGeometryEditable, frameValues, pageBounds, pageSelection, prepareGeometryCommand, selectedGeometryRoots, translatePageFrames, validatedGeometryDocument } from "./designer-geometry-commands";
import { designerScreenToLocal } from "./designer-viewport-mapping";
import { fitRejectedTransform, moveWithSnap, normalizeRotation, resizeSelection, rotateSelection } from "./designer-geometry-transforms";
import { arrangeSelection, changeSelectionLayer, setSelectionFlags } from "./designer-arrangement";
import { copyDesignerSelection, pasteDesignerSelection, removeDesignerSelection, type DesignerClipboard } from "./designer-clipboard";

interface Source { document: EditorDocument; key: string; generation: number; ids: string[] }
interface Gesture extends Source { token: number; action: GestureKind; start: Point; pageKey: string; snap: boolean; invalid: boolean }
interface Rejected extends Source { command: GraphCommand }
const identity = [1, 0, 0, 1, 0, 0] as const;

/** App-owned orchestration only. Native preparation and complete validation precede every authored update. */
export function createDesignerInteractionController(initialBridge: DesignerInteractionBridge, native: DesignerNativeGeometry) {
  let bridge = initialBridge, gesture: Gesture | null = null, rejected: Rejected | null = null, clipboard: DesignerClipboard | null = null;
  let contextKey = "", generation = -1;
  let snapshot: InteractionSnapshot = Object.freeze({ selectedIds: [], guides: [], active: false, error: null, repairAvailable: false });
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<InteractionSnapshot>) => {
    const next = { ...snapshot, ...patch };
    if (next.active === snapshot.active && next.error === snapshot.error && next.repairAvailable === snapshot.repairAvailable
      && JSON.stringify(next.selectedIds) === JSON.stringify(snapshot.selectedIds) && JSON.stringify(next.guides) === JSON.stringify(snapshot.guides)) return;
    snapshot = Object.freeze({ ...next, selectedIds: Object.freeze([...next.selectedIds]), guides: Object.freeze(next.guides.map(guide => Object.freeze({ ...guide }))) });
    listeners.forEach(listener => listener());
  };
  const fail = (cause: unknown) => { publish({ error: cause instanceof Error ? cause.message : "Interaction refused", guides: [], repairAvailable: !!rejected }); return false; };
  const cancel = (token?: number) => { if (token !== undefined && gesture?.token !== token) return; if (gesture) bridge.cancel(gesture.token); gesture = null; rejected = null; publish({ active: false, guides: [], error: null, repairAvailable: false }); };
  const synchronize = () => {
    const authority = bridge.context(), state = bridge.read();
    if (!authority.canRead || authority.key !== contextKey || state.generation !== generation) {
      cancel(); clipboard = null; contextKey = authority.key; generation = state.generation; publish({ selectedIds: [] });
    } else if (gesture && !bridge.canEdit()) cancel();
    if (!authority.canRead && bridge.selection().length) bridge.select([]);
    const ids = authority.canRead && state.document ? bridge.selection() : [];
    if (!gesture && JSON.stringify(ids) !== JSON.stringify(snapshot.selectedIds)) publish({ selectedIds: Object.freeze([...ids]) });
    return authority.canRead && state.document ? state : null;
  };
  const source = (editable = true): Source => {
    const state = synchronize();
    if (!state?.document || (editable && !bridge.canEdit())) throw new Error("Current draft authority is unavailable");
    const document = validatedGeometryDocument(native, state.document), ids = selectedGeometryRoots(document, snapshot.selectedIds);
    if (editable) assertGeometryEditable(document, ids);
    return { document, ids, generation: state.generation, key: bridge.context().key };
  };
  const apply = (base: Source, command: GraphCommand, transaction?: Gesture) => {
    try {
      const state = synchronize();
      if (!state || !bridge.canEdit() || base.generation !== state.generation || base.key !== bridge.context().key) return false;
      const candidate = prepareGeometryCommand(native, base.document, command);
      const changed = transaction ? bridge.update(transaction.token, candidate) : bridge.execute(candidate);
      rejected = null; if (transaction) transaction.invalid = false; publish({ error: null, repairAvailable: false }); return changed;
    } catch (cause) {
      if (transaction) transaction.invalid = true;
      const code = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
      rejected = code === "TEMPLATE_FIXED_CANVAS_OVERFLOW" || code === "TEMPLATE_ABSOLUTE_ZONE_OVERFLOW" ? { ...base, command } : null;
      return fail(cause);
    }
  };
  const atomic = (operation: (base: Source) => GraphCommand) => {
    try { if (gesture) return false; const base = source(); return apply(base, operation(base)); } catch (cause) { return fail(cause); }
  };
  const finish = (token: number) => {
    synchronize(); if (!gesture || gesture.token !== token || gesture.invalid || rejected) return false;
    bridge.commit(gesture.token); gesture = null; publish({ active: false, guides: [], error: null, repairAvailable: false }); return true;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setBridge(next: DesignerInteractionBridge) { if (bridge.context().key !== next.context().key || bridge.read().generation !== next.read().generation) cancel(); bridge = next; synchronize(); },
    synchronize,
    dispose() { cancel(); clipboard = null; listeners.clear(); },
    select(ids: readonly string[]) {
      try {
        const state = synchronize(); if (!state?.document || gesture) return false;
        const selectedIds = ids.length ? selectedGeometryRoots(state.document, ids) : [];
        if (!bridge.select(selectedIds)) return false;
        rejected = null; publish({ selectedIds: Object.freeze(selectedIds), error: null, guides: [], repairAvailable: false }); return true;
      } catch (cause) { return fail(cause); }
    },
    begin(action: GestureKind, client: Point, view: ViewportMapping, snap = true) {
      try {
        if (gesture) return null; const base = source(), state = bridge.read(); if (state.gestureActive) return null;
        const { pageKey } = pageSelection(base.document, base.ids, native); if (view.pageKey !== pageKey) throw new Error("Pointer belongs to a different page");
        const start = designerScreenToLocal(native, view, identity, client), token = bridge.begin(); if (token === null) return null;
        gesture = { ...base, token, action, start, pageKey, snap, invalid: false }; rejected = null;
        publish({ active: true, guides: [], error: null, repairAvailable: false }); return token;
      } catch (cause) { fail(cause); return null; }
    },
    update(token: number, client: Point, view: ViewportMapping) {
      try {
        synchronize(); const active = gesture; if (!active || active.token !== token || !bridge.canEdit()) return false;
        if (view.pageKey !== active.pageKey) { cancel(); throw new Error("Use explicit Move to page for cross-page movement"); }
        const point = designerScreenToLocal(native, view, identity, client), delta = { x: point.x - active.start.x, y: point.y - active.start.y };
        rejected = null; active.invalid = true;
        let command: GraphCommand;
        if (active.action.kind === "move") {
          const moved = moveWithSnap(active.document, active.ids, native, delta, view.zoom, active.snap); command = moved.command;
          publish({ guides: Object.freeze(moved.guides) });
        } else if (active.action.kind === "resize") command = resizeSelection(active.document, active.ids, native, delta, active.action.handle, active.action.aspect);
        else {
          const box = pageBounds(active.document, active.ids, native), center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
          const angle = (Math.atan2(point.y - center.y, point.x - center.x) - Math.atan2(active.start.y - center.y, active.start.x - center.x)) * 180 / Math.PI;
          command = rotateSelection(active.document, active.ids, native, angle);
        }
        return apply(active, command, active);
      } catch (cause) { return fail(cause); }
    },
    commit: finish,
    commitCurrent: () => gesture ? finish(gesture.token) : false,
    cancel,
    repair() {
      try {
        const problem = rejected, state = synchronize();
        if (!problem || !state?.document || !bridge.canEdit() || problem.key !== bridge.context().key || problem.generation !== state.generation) return false;
        if (!gesture && JSON.stringify(state.document) !== JSON.stringify(problem.document)) throw new Error("Draft changed; repeat the proposed repair");
        return apply(problem, fitRejectedTransform(problem.document, native, problem.command), gesture ?? undefined);
      } catch (cause) { return fail(cause); }
    },
    nudge(delta: Point) { return atomic(base => translatePageFrames(base.document, base.ids, native, delta)); },
    resizeNumeric(patch: Partial<Frame>, aspect = false) {
      return atomic(base => {
        if (base.ids.length !== 1) throw new Error("Select one object for numeric dimensions");
        const old = absoluteFrame(base.document.nodes[base.ids[0]]), frame = { ...frameValues(old), ...patch };
        if (aspect && patch.width !== undefined) frame.height = old.height * frame.width / old.width;
        else if (aspect && patch.height !== undefined) frame.width = old.width * frame.height / old.height;
        return { kind: "TRANSFORM", changes: [{ nodeId: base.ids[0], frame }] };
      });
    },
    rotate(degrees: number) { return atomic(base => rotateSelection(base.document, base.ids, native, normalizeRotation(degrees))); },
    arrange(action: Parameters<typeof arrangeSelection>[3], direction: "LTR" | "RTL") { return atomic(base => arrangeSelection(base.document, base.ids, native, action, direction)); },
    layer(delta: -1 | 1) { return atomic(base => changeSelectionLayer(base.document, base.ids, native, delta)); },
    group() { const groupId = generateUUIDv7(); const changed = atomic(base => ({ kind: "GROUP", nodeIds: base.ids, groupId })); if (changed) { bridge.select([groupId]); publish({ selectedIds: [groupId] }); } return changed; },
    ungroup() { let children: readonly string[] = []; const changed = atomic(base => { if (base.ids.length !== 1) throw new Error("Select one group"); children = [...base.document.nodes[base.ids[0]].childIds]; return { kind: "UNGROUP", groupId: base.ids[0] }; }); if (changed) { bridge.select(children); publish({ selectedIds: children }); } return changed; },
    moveTo(destinationParentId: string) { return atomic(base => ({ kind: "MOVE", nodeIds: base.ids, destinationParentId, deltaMm: { x: 0, y: 0 } })); },
    flags(flags: { locked?: boolean; hidden?: boolean }) {
      try { if (gesture || !bridge.canEdit()) return false; const base = source(false); return bridge.execute(setSelectionFlags(base.document, base.ids, native, flags)); } catch (cause) { return fail(cause); }
    },
    copy() { try { const base = source(false); clipboard = copyDesignerSelection(base.document, base.ids, native, base.key); return true; } catch (cause) { return fail(cause); } },
    cut() {
      try { if (gesture) return false; const base = source(); const copied = copyDesignerSelection(base.document, base.ids, native, base.key); const candidate = removeDesignerSelection(base.document, base.ids, native); if (!bridge.execute(candidate)) return false; clipboard = copied; bridge.select([]); publish({ selectedIds: [] }); return true; } catch (cause) { return fail(cause); }
    },
    paste(destinationParentId: string, deltaMm: Point = { x: 0, y: 0 }) {
      try {
        const state = synchronize(); if (gesture || !state?.document || !clipboard || !bridge.canEdit()) return false;
        const result = pasteDesignerSelection(state.document, clipboard, destinationParentId, deltaMm, native, bridge.context().key);
        if (!bridge.execute(result.document)) return false; bridge.select(result.selectedIds); publish({ selectedIds: Object.freeze(result.selectedIds) }); return true;
      } catch (cause) { return fail(cause); }
    },
  };
}
export type DesignerInteractionController = ReturnType<typeof createDesignerInteractionController>;
