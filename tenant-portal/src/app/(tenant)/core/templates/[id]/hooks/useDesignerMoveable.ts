import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type Moveable from "react-moveable";
import type { OnEvent, OnResizeStart } from "react-moveable";
import type { DesignerHandleLayerProps } from "../components/DesignerInteractionPanel";
import type { DesignerMoveableSurface } from "../../designer-moveable-surface";
import type { GestureKind } from "../../designer-interaction-contract";

export function useDesignerMoveable(props: DesignerHandleLayerProps, surface: DesignerMoveableSurface) {
  const moveable = useRef<Moveable>(null);
  const latest = useRef(props);
  const active = useRef<{ token: number; cancel: DesignerHandleLayerProps["onCancel"] } | null>(null);
  const captured = useRef<{ target: Element; id: number } | null>(null);
  const sessions = useRef(new WeakMap<object, { token: number; cancel: DesignerHandleLayerProps["onCancel"] }>());
  const bindMoveable = useCallback((instance: Moveable | null) => { moveable.current = instance; }, []);
  const subscribe = useCallback((listener: () => void) => surface.subscribeLayout(listener), [surface]);
  const getLayoutVersion = useCallback(() => surface.getLayoutVersion(), [surface]);
  const layoutVersion = useSyncExternalStore(subscribe, getLayoutVersion, getLayoutVersion);
  useLayoutEffect(() => { latest.current = props; });
  const cancel = useCallback(() => {
    const operation = active.current;
    active.current = null;
    if (operation) operation.cancel(operation.token);
    const pointer = captured.current; captured.current = null;
    if (pointer?.target.hasPointerCapture(pointer.id)) pointer.target.releasePointerCapture(pointer.id);
    moveable.current?.stopDrag();
    moveable.current?.updateRect();
  }, []);
  useLayoutEffect(() => props.interactionExit.register("pointer", {
    read: () => {
      if (!surface.isCurrent()) return "unavailable";
      const pointer = captured.current;
      if (active.current || (pointer && pointer.target.hasPointerCapture(pointer.id))) return "active";
      const instance = moveable.current;
      // The actual hook owns this ref and has no outstanding operation/capture.
      return instance && instance.isDragging() ? "active" : "inactive";
    }, cancel,
  }), [props.interactionExit, surface, cancel]);
  useLayoutEffect(() => {
    if (props.disabled || !surface.isCurrent()) cancel();
    else moveable.current?.updateRect();
  }, [props.disabled, surface, layoutVersion, cancel]);
  useEffect(() => {
    const document = surface.overlayRoot.ownerDocument, window = document.defaultView;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && active.current) { event.preventDefault(); event.stopPropagation(); latest.current.interactionExit.cancelAllCurrent(latest.current.interactionExit.ticket); } };
    const interrupted = () => { if (active.current) cancel(); };
    document.addEventListener("keydown", escape, true);
    document.addEventListener("pointercancel", interrupted, true);
    document.addEventListener("touchcancel", interrupted, true);
    window?.addEventListener("blur", interrupted);
    return () => {
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("pointercancel", interrupted, true);
      document.removeEventListener("touchcancel", interrupted, true);
      window?.removeEventListener("blur", interrupted);
      cancel();
    };
  }, [surface, cancel]);
  const modifiers = (event: OnEvent) => {
    const input: unknown = event.inputEvent;
    return input && typeof input === "object" ? input : {};
  };
  const begin = (event: OnEvent, kind: GestureKind) => {
    if (active.current) return;
    const view = surface.mapping(), current = latest.current, input = modifiers(event);
    if (current.disabled || !surface.isCurrent() || !view) { event.stopDrag(); return; }
    const token = current.onBegin(kind, { x: event.clientX, y: event.clientY }, view, !("altKey" in input && input.altKey === true));
    if (token === null) { event.stopDrag(); return; }
    const data: unknown = event.datas;
    if (!data || typeof data !== "object") { current.onCancel(token); event.stopDrag(); return; }
    if (input instanceof PointerEvent && input.target instanceof Element) captured.current = { target: input.target, id: input.pointerId };
    const operation = { token, cancel: current.onCancel };
    active.current = operation;
    sessions.current.set(data, operation);
  };
  const resize = (event: OnResizeStart) => {
    const [x, y] = event.direction, input = modifiers(event);
    if (![-1, 0, 1].includes(x) || ![-1, 0, 1].includes(y) || (!x && !y)) { event.stopDrag(); return; }
    begin(event, { kind: "resize", handle: [x as -1 | 0 | 1, y as -1 | 0 | 1], aspect: "shiftKey" in input && input.shiftKey === true });
  };
  const update = (event: OnEvent) => {
    const data: unknown = event.datas;
    const operation = data && typeof data === "object" ? sessions.current.get(data) : undefined;
    if (!operation || operation !== active.current) return;
    const view = surface.mapping();
    if (latest.current.disabled || !surface.isCurrent() || !view) { cancel(); return; }
    latest.current.onUpdate(operation.token, { x: event.clientX, y: event.clientY }, view);
    // The canonical renderer owns target geometry. Library CSS transform strings
    // never become document state, including after a rejected overflow proposal.
    event.currentTarget.updateRect();
  };
  const finish = (event: OnEvent) => {
    const data: unknown = event.datas;
    const operation = data && typeof data === "object" ? sessions.current.get(data) : undefined;
    if (!operation || operation !== active.current) return;
    if (latest.current.disabled || !surface.isCurrent()) { cancel(); return; }
    active.current = null;
    latest.current.onCommit(operation.token);
    const pointer = captured.current; captured.current = null;
    if (pointer?.target.hasPointerCapture(pointer.id)) pointer.target.releasePointerCapture(pointer.id);
    event.currentTarget.updateRect();
  };
  const targets = props.nodeIds.map(nodeId => surface.targetFor(nodeId));
  const usable = !props.disabled && surface.isCurrent() && targets.length > 0 && targets.every(target => target?.isConnected && target.ownerDocument === surface.overlayRoot.ownerDocument);
  return { bindMoveable, targets: usable ? targets.filter((target): target is HTMLElement => !!target) : [],
    drag: (event: OnEvent) => begin(event, { kind: "move" }),
    rotate: (event: OnEvent) => begin(event, { kind: "rotate" }), resize, update, finish };
}
