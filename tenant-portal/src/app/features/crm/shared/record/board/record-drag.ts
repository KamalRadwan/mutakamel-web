import { Directive, DestroyRef, ElementRef, afterNextRender, inject, input, output, signal } from '@angular/core';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { preserveOffsetOnSource } from '@atlaskit/pragmatic-drag-and-drop/utils/preserve-offset-on-source';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview';

export interface DraggedRecord {
  recordId: string;
  fromLaneId: string;
  height: number;
}

export function isDraggedRecord(data: Record<string | symbol, unknown>): data is Record<string | symbol, unknown> & DraggedRecord {
  return typeof data['recordId'] === 'string' && typeof data['fromLaneId'] === 'string';
}

/** Makes a board card draggable. The preview is a tilted copy with the drag shadow; the source fades. */
@Directive({
  selector: '[recordDrag]',
  host: { '[class.opacity-drag-source]': 'dragging()' },
})
export class RecordDrag {
  readonly recordDrag = input.required<string>();
  readonly laneId = input.required<string>();
  readonly dragDisabled = input(false);

  protected readonly dragging = signal(false);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      let pressed: Element | null = null;
      const restore = () => {
        document.removeEventListener('pointerup', restore);
        document.removeEventListener('pointercancel', restore);
        element.draggable = true;
      };
      const onPointerDown = (event: PointerEvent) => {
        pressed = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
        if (!pressed?.closest('[data-no-drag]')) return;
        element.draggable = false;
        document.addEventListener('pointerup', restore, { once: true });
        document.addEventListener('pointercancel', restore, { once: true });
      };
      element.addEventListener('pointerdown', onPointerDown, true);

      const cleanup = draggable({
        element,
        canDrag: () => !this.dragDisabled() && !pressed?.closest('[data-no-drag]'),
        getInitialData: () => ({ recordId: this.recordDrag(), fromLaneId: this.laneId(), height: element.offsetHeight }),
        onGenerateDragPreview: ({ location, source, nativeSetDragImage }) => {
          const offset = preserveOffsetOnSource({ element: source.element, input: location.current.input });
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: (args) => {
              const { x, y } = offset(args);
              const frame = parseFloat(getComputedStyle(args.container.firstElementChild!).paddingTop);
              return { x: x + frame, y: y + frame };
            },
            render: ({ container }) => {
              const frame = document.createElement('div');
              frame.className = 'drag-preview-frame';
              const copy = element.cloneNode(true) as HTMLElement;
              copy.style.width = element.offsetWidth + 'px';
              copy.classList.add('drag-preview');
              frame.append(copy);
              container.append(frame);
            },
          });
        },
        onDragStart: () => this.dragging.set(true),
        onDrop: () => this.dragging.set(false),
      });
      destroyRef.onDestroy(() => {
        element.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('pointerup', restore);
        document.removeEventListener('pointercancel', restore);
        cleanup();
      });
    });
  }
}

/** A lane that accepts dropped cards. Exposes the hovered state and the dragged card height for the placeholder. */
@Directive({
  selector: '[recordDrop]',
  exportAs: 'recordDrop',
})
export class RecordDrop {
  readonly recordDrop = input.required<string>();
  readonly dropDenied = input(false);
  readonly dropped = output<DraggedRecord>();

  readonly over = signal<DraggedRecord | null>(null);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const cleanup = dropTargetForElements({
        element,
        canDrop: ({ source }) => isDraggedRecord(source.data) && !this.dropDenied(),
        getData: () => ({ laneId: this.recordDrop() }),
        onDragEnter: ({ source }) => this.enter(source.data),
        onDragLeave: () => this.over.set(null),
        onDrop: ({ source }) => {
          this.over.set(null);
          if (!this.dropDenied() && isDraggedRecord(source.data) && source.data.fromLaneId !== this.recordDrop()) {
            this.dropped.emit(source.data);
          }
        },
      });
      destroyRef.onDestroy(cleanup);
    });
  }

  private enter(data: Record<string | symbol, unknown>) {
    if (!this.dropDenied() && isDraggedRecord(data) && data.fromLaneId !== this.recordDrop()) {
      this.over.set(data);
    }
  }
}
