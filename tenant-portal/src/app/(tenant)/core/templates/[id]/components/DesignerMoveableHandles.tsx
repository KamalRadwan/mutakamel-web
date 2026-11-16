"use client";
import Moveable from "react-moveable";
import { createPortal } from "react-dom";
import type { DesignerHandleLayerProps } from "./DesignerInteractionPanel";
import type { DesignerMoveableSurface } from "../../designer-moveable-surface";
import { useDesignerMoveable } from "../hooks/useDesignerMoveable";

export function DesignerMoveableHandles(props: DesignerHandleLayerProps & { surface: DesignerMoveableSurface }) {
  const { bindMoveable, targets, drag, resize, rotate, update, finish } = useDesignerMoveable(props, props.surface);
  if (!targets.length) return null;
  return createPortal(<Moveable ref={bindMoveable} target={targets}
    container={props.surface.overlayRoot} rootContainer={props.surface.rootContainer} cspNonce={props.surface.cspNonce}
    draggable resizable rotatable origin={false} snappable={false} throttleDrag={0} throttleResize={0}
    onDragStart={drag} onDrag={update} onDragEnd={finish}
    onResizeStart={resize} onResize={update} onResizeEnd={finish}
    onRotateStart={rotate} onRotate={update} onRotateEnd={finish}
    onDragGroupStart={drag} onDragGroup={update} onDragGroupEnd={finish}
    onResizeGroupStart={resize} onResizeGroup={update} onResizeGroupEnd={finish}
    onRotateGroupStart={rotate} onRotateGroup={update} onRotateGroupEnd={finish}
  />, props.surface.overlayRoot);
}
