import { useCallback, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { DesignerCommandStore, DesignerViewport } from "../../designer-command-store";
import type { DesignerInteractionBridge, Point } from "../../designer-interaction-contract";
import type { DesignerInteractionExit } from "../../designer-interaction-exit";
import type { EditorDocument } from "../../template-editor-model";
import { fixedQuotationPositionCandidate, readFixedQuotationDragTarget } from "./useFixedQuotationPosition";

type DragTarget = NonNullable<ReturnType<typeof readFixedQuotationDragTarget>>;
type DragClick = { id: number; type: string; nodeId: string };
type Drag = {
  id: number;
  pointerType: string;
  origin: Point;
  frame: HTMLDivElement;
  view: DesignerViewport;
  scrollLeft: number;
  scrollTop: number;
  key: string;
  generation: number;
  source: DragTarget;
  bridge: DesignerInteractionBridge;
  selection: readonly string[];
  writing: boolean;
  document: EditorDocument;
  token: number | null;
};

const dragThresholdPx = 4;
const mmPerCssPx = 25.4 / 96;

export function useFixedQuotationDrag(frame: RefObject<HTMLDivElement | null>, enabled: boolean, bridge: DesignerInteractionBridge,
  store: DesignerCommandStore, exit: DesignerInteractionExit) {
  const active = useRef<Drag | null>(null);
  const dragClick = useRef<DragClick | null>(null);
  const latest = useRef(bridge);
  const [rejection, setRejection] = useState<{ document: EditorDocument; selection: readonly string[] } | null>(null);
  useLayoutEffect(() => { latest.current = bridge; });

  const finish = useCallback((commit: boolean) => {
    const drag = active.current;
    if (!drag) return;
    active.current = null;
    if (drag.token !== null) {
      // Chromium may dispatch click to the leaf after releasing capture on pointerup.
      dragClick.current = { id: drag.id, type: drag.pointerType, nodeId: drag.source.nodeId };
      if (commit) latest.current.commit(drag.token);
      else drag.bridge.cancel(drag.token);
    }
    if (drag.frame.hasPointerCapture?.(drag.id)) drag.frame.releasePointerCapture(drag.id);
  }, []);
  const cancel = useCallback(() => finish(false), [finish]);
  const isActive = useCallback(() => active.current !== null, []);

  useLayoutEffect(() => {
    const canvas = frame.current, window = canvas?.ownerDocument.defaultView;
    if (!enabled || !canvas || !window) return;
    const viewCurrent = (drag: Drag) => {
      const view = store.getViewport();
      return !view.hand && view.zoom === drag.view.zoom && view.panX === drag.view.panX && view.panY === drag.view.panY &&
        canvas.scrollLeft === drag.scrollLeft && canvas.scrollTop === drag.scrollTop &&
        view.selectedIds === drag.selection;
    };
    const current = (drag: Drag) => {
      const bridge = latest.current, owner = bridge.context(), state = bridge.read();
      return active.current === drag && owner.canRead && owner.key === drag.key && bridge.canEdit() && state.generation === drag.generation &&
        state.document === drag.document && state.gestureActive === (drag.token !== null) && viewCurrent(drag);
    };
    const delta = (drag: Drag, event: PointerEvent) => ({ x: event.clientX - drag.origin.x, y: event.clientY - drag.origin.y });
    const apply = (drag: Drag, movement: Point) => {
      const scale = mmPerCssPx / drag.view.zoom;
      const candidate = fixedQuotationPositionCandidate(drag.source, { x: movement.x * scale, y: movement.y * scale });
      if (!candidate || drag.token === null) return false;
      const { nodeId } = drag.source;
      const before = drag.document.nodes[nodeId].layout, after = candidate.nodes[nodeId].layout;
      if (before.kind !== "ABSOLUTE" || after.kind !== "ABSOLUTE") return false;
      if (before.x === after.x && before.y === after.y) return true;
      const bridge = latest.current;
      drag.writing = true;
      try { if (!bridge.update(drag.token, candidate)) return false; }
      finally { drag.writing = false; }
      const updated = bridge.read().document;
      if (active.current !== drag || !updated) return false;
      drag.document = updated;
      return true;
    };
    const move = (event: PointerEvent) => {
      const drag = active.current;
      if (!drag || drag.id !== event.pointerId) return;
      if (!current(drag) || !(event.buttons & 1)) { cancel(); return; }
      const movement = delta(drag, event);
      if (drag.token === null) {
        if (Math.hypot(movement.x, movement.y) < dragThresholdPx) return;
        const bridge = latest.current;
        let token: number | null;
        drag.writing = true;
        try { token = bridge.begin(); }
        finally { drag.writing = false; }
        if (active.current !== drag) {
          if (token !== null) bridge.cancel(token);
          return;
        }
        drag.token = token;
        if (token === null || !current(drag)) { cancel(); return; }
        try { canvas.setPointerCapture?.(drag.id); }
        catch { cancel(); return; }
        setRejection(null);
      }
      event.preventDefault();
      apply(drag, movement);
    };
    const up = (event: PointerEvent) => {
      const drag = active.current;
      if (!drag || drag.id !== event.pointerId) return;
      if (drag.token === null || !current(drag)) { cancel(); return; }
      const accepted = apply(drag, delta(drag, event));
      finish(accepted && current(drag));
      if (!accepted) setRejection({ document: drag.source.document, selection: drag.selection });
    };
    const pointerCancel = (event: PointerEvent) => {
      if (active.current?.id === event.pointerId) cancel();
    };
    const newPointer = (event: PointerEvent) => {
      if (dragClick.current?.id === event.pointerId) dragClick.current = null;
    };
    const lostCapture = (event: PointerEvent) => {
      if (event.target === canvas) pointerCancel(event);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && active.current) {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    };
    const cancelMovedView = () => {
      if (active.current && !viewCurrent(active.current)) cancel();
    };
    const scroll = (event: Event) => {
      if (active.current && (event.target === canvas.ownerDocument ||
        (event.target instanceof Element && event.target.contains(canvas)))) cancel();
    };
    const unsubscribeView = store.subscribeViewport(cancelMovedView);
    const unsubscribeDocument = store.subscribe(() => {
      const drag = active.current;
      if (drag && !drag.writing && !current(drag)) cancel();
    });
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("pointerdown", newPointer, true);
    window.addEventListener("pointermove", move, { capture: true, passive: false });
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", pointerCancel, true);
    window.addEventListener("lostpointercapture", lostCapture, true);
    window.addEventListener("keydown", escape, true);
    window.addEventListener("blur", cancel);
    return () => {
      unsubscribeView();
      unsubscribeDocument();
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("pointerdown", newPointer, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", pointerCancel, true);
      window.removeEventListener("lostpointercapture", lostCapture, true);
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("blur", cancel);
      cancel();
    };
  }, [enabled, exit, frame, store, cancel, finish]);

  useLayoutEffect(() => {
    const drag = active.current;
    if (!drag) return;
    const owner = bridge.context(), state = bridge.read();
    if (!owner.canRead || !bridge.canEdit() || owner.key !== drag.key || state.generation !== drag.generation) cancel();
  });

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || active.current || !event.isPrimary || event.button !== 0 ||
      (event.pointerType !== "mouse" && event.pointerType !== "pen") ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !(event.target instanceof Element)) return;
    const canvas = event.currentTarget;
    const button = event.target.closest<HTMLButtonElement>("button[data-fixed-node-id]");
    const nodeId = button?.dataset.fixedNodeId;
    if (!nodeId || !canvas.contains(button) || button.disabled) return;
    const view = store.getViewport(), owner = bridge.context(), state = bridge.read();
    if (view.hand || view.selectedIds.length !== 1 || view.selectedId !== nodeId ||
      !owner.canRead || !bridge.canEdit() || state.gestureActive) return;
    const source = readFixedQuotationDragTarget(state.document, nodeId);
    if (!source) return;
    active.current = { id: event.pointerId, pointerType: event.pointerType,
      origin: { x: event.clientX, y: event.clientY }, frame: canvas, view,
      scrollLeft: canvas.scrollLeft, scrollTop: canvas.scrollTop, key: owner.key, generation: state.generation,
      source, bridge, selection: view.selectedIds, writing: false, document: source.document, token: null };
  };

  const clickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    const handled = dragClick.current, pointer = event.nativeEvent;
    if (!handled || event.detail === 0 || !("pointerId" in pointer) || pointer.pointerId !== handled.id ||
      !("pointerType" in pointer) || pointer.pointerType !== handled.type) return;
    if (!(event.target instanceof Element) ||
      event.target.closest("button[data-fixed-node-id]")?.getAttribute("data-fixed-node-id") !== handled.nodeId) return;
    dragClick.current = null;
    event.preventDefault();
    event.stopPropagation();
  };

  return { pointerDown, clickCapture, cancel, isActive, rejected: rejection !== null &&
    rejection.document === bridge.read().document && rejection.selection === bridge.selection() };
}
