import type { PageConfig } from "../../pages/page-contract";
import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { useTemplateDesignEditor } from "./useTemplateDesignEditor";
import { useFixedQuotationDrag } from "./useFixedQuotationDrag";

const panOffsets = new Map<string, readonly [number, number]>([
  ["ArrowUp", [0, -24]], ["ArrowDown", [0, 24]], ["ArrowLeft", [-24, 0]], ["ArrowRight", [24, 0]],
]);

type ViewportEditor = Pick<ReturnType<typeof useTemplateDesignEditor>,
  "interactionExit" | "interactionBridge" | "viewport" | "setViewport" | "document" | "commandStore">;

export function useDesignerViewport(editor: ViewportEditor, activePage?: PageConfig | null, fixedDragEnabled = false) {
  const frame = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; x: number; y: number; panX: number; panY: number; target: HTMLDivElement } | null>(null);
  const latest = useRef(editor);
  useLayoutEffect(() => { latest.current = editor; });
  const exit = editor.interactionExit;
  const view = editor.viewport;
  const { pointerDown: armFixedDrag, clickCapture, cancel: cancelFixedDrag, isActive: fixedDragActive, rejected: dragRejected } =
    useFixedQuotationDrag(frame, fixedDragEnabled, editor.interactionBridge, editor.commandStore, exit);
  const { lang } = useI18n();
  const percent = new Intl.NumberFormat({ ar: "ar-EG-u-nu-latn", en: "en-US" }[lang], { style: "percent", maximumFractionDigits: 0 });
  const pan = (x: number, y: number) => editor.setViewport({ panX: view.panX + x, panY: view.panY + y });
  const fit = (page: boolean) => {
    const bounds = frame.current?.getBoundingClientRect(), paper = activePage ?? editor.document?.page;
    if (!bounds || bounds.width <= 0 || bounds.height <= 0 || !paper) return;
    const width = paper.widthMm * 96 / 25.4, height = paper.heightMm * 96 / 25.4;
    const zoom = Math.min((bounds.width - 32) / width, page ? (bounds.height - 32) / height : 2);
    editor.setViewport({ zoom: Math.max(0.25, Math.min(2, zoom)), panX: 0, panY: 0 });
  };
  const finishPointer = useCallback((cancel: boolean) => {
    const active = pointer.current; if (!active) return;
    pointer.current = null;
    if (cancel) latest.current.setViewport({ panX: active.panX, panY: active.panY });
    if (active.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
  }, []);
  useLayoutEffect(() => {
    const off = exit.register("pan", {
      read: () => pointer.current || fixedDragActive() || latest.current.commandStore.getViewport().hand ? "active" : "inactive",
      cancel: () => { cancelFixedDrag(); finishPointer(true); latest.current.setViewport({ hand: false }); },
    });
    return () => { off(); finishPointer(false); };
  }, [exit, finishPointer, fixedDragActive, cancelFixedDrag]);
  const stop = (event: PointerEvent<HTMLDivElement>, cancel: boolean) => {
    if (pointer.current?.id === event.pointerId) finishPointer(cancel);
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      // React portals bubble here even when focus has moved outside the canvas.
      if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
      if (exit.hasActive()) {
        if (exit.cancelAllCurrent(exit.ticket)) event.preventDefault();
        return;
      }

      const bridge = editor.interactionBridge;
      if (bridge.context().canRead && bridge.selection().length && bridge.select([])) {
        // Drop any rejected geometry proposal tied to the cleared selection.
        exit.cancelAllCurrent(exit.ticket);
        event.preventDefault();
      }
      return;
    }
    if (!view.hand || event.target !== event.currentTarget) return;
    const offset = panOffsets.get(event.key);
    if (offset) { event.preventDefault(); pan(...offset); }
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!view.hand) { armFixedDrag(event); return; }
    if (event.button !== 0 || pointer.current) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: view.panX, panY: view.panY, target: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = pointer.current;
    if (view.hand && active?.id === event.pointerId) editor.setViewport({ panX: active.panX + event.clientX - active.x, panY: active.panY + event.clientY - active.y });
  };
  return { frame, view, percent, fit, keys, pointerDown, pointerMove, clickCapture, dragRejected,
    pointerUp: (event: PointerEvent<HTMLDivElement>) => stop(event, false), pointerCancel: (event: PointerEvent<HTMLDivElement>) => stop(event, true) };
}
