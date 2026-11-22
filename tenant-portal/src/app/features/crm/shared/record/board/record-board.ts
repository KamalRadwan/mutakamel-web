import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChevronsLeft, tablerChevronsRight, tablerInbox, tablerPlus } from '@ng-icons/tabler-icons';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { Button } from '../../../../../shared/ui/button/button';
import { rectInPage } from '../../../../../shared/ui/overlay/zoom';
import { BoardLabels, BoardLane, BoardLaneTone, BoardMoveEvent } from './record-board.model';
import { DraggedRecord, RecordDrag, RecordDrop, isDraggedRecord } from './record-drag';

interface OptimisticMove {
  id: string;
  from: string;
  to: string;
}

function readCollapsed(storageKey: string | null): ReadonlySet<string> {
  if (!storageKey) return new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((item): item is string => typeof item === 'string')) return new Set();
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function writeCollapsed(storageKey: string | null, ids: ReadonlySet<string>): void {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify([...ids]));
  } catch {
    // ignore storage errors
  }
}

@Component({
  selector: 'app-record-board',
  imports: [NgTemplateOutlet, NgIcon, TranslocoPipe, Button, RecordDrag, RecordDrop],
  providers: [
    provideTranslocoScope({ scope: 'record-list', alias: 'recordList' }),
    provideIcons({ tablerPlus, tablerChevronsLeft, tablerChevronsRight, tablerInbox }),
  ],
  templateUrl: './record-board.html',
  host: { class: 'flex shrink-0 flex-col' },
})
export class RecordBoard<T = unknown> {
  private readonly boardRoot = viewChild.required<ElementRef<HTMLElement>>('boardRoot');
  protected readonly columnMinHeight = signal(0);
  private readonly activeDrag = signal<{ id: string; from: string } | null>(null);
  private destroyed = false;

  readonly lanes = input.required<readonly BoardLane<T>[]>();
  readonly itemTemplate = input.required<TemplateRef<{ $implicit: T; lane?: BoardLane<T> }>>();
  readonly trackBy = input<(item: T) => string>();
  readonly idOf = input.required<(item: T) => string>();
  readonly laneHeaderEnd = input<TemplateRef<{ $implicit: BoardLane<T> }> | null>(null);
  readonly canDrag = input<((item: T) => boolean) | null>(null);
  readonly loading = input(false);
  readonly collapseStorageKey = input<string | null>(null);
  readonly labels = input<BoardLabels>({});

  readonly loadMore = output<string>();
  readonly create = output<string>();
  readonly move = output<BoardMoveEvent>();

  private readonly optimistic = linkedSignal<readonly BoardLane<T>[], ReadonlyMap<string, OptimisticMove>>({
    source: () => this.lanes(),
    computation: (lanes, previous) => {
      const prev = previous?.value;
      if (!prev || prev.size === 0) return new Map();
      const idOf = this.idOf();
      const next = new Map<string, OptimisticMove>();
      for (const [id, mv] of prev) {
        const fromLane = lanes.find((lane) => lane.id === mv.from);
        const toLane = lanes.find((lane) => lane.id === mv.to);
        if (fromLane && toLane && fromLane.items.some((item) => idOf(item) === id)) {
          next.set(id, mv);
        }
      }
      return next;
    },
  });

  protected readonly displayLanes = computed<readonly BoardLane<T>[]>(() => {
    const lanes = this.lanes();
    const moves = this.optimistic();
    if (moves.size === 0) return lanes;

    const idOf = this.idOf();
    const removedByLane = new Map<string, Set<string>>();
    const addedByLane = new Map<string, T[]>();

    for (const mv of moves.values()) {
      const fromLane = lanes.find((lane) => lane.id === mv.from);
      const item = fromLane?.items.find((entry) => idOf(entry) === mv.id);
      if (!item) continue;

      let removed = removedByLane.get(mv.from);
      if (!removed) {
        removed = new Set<string>();
        removedByLane.set(mv.from, removed);
      }
      removed.add(mv.id);

      let added = addedByLane.get(mv.to);
      if (!added) {
        added = [];
        addedByLane.set(mv.to, added);
      }
      added.unshift(item);
    }

    if (removedByLane.size === 0 && addedByLane.size === 0) return lanes;

    return lanes.map((lane) => {
      const removed = removedByLane.get(lane.id);
      const added = addedByLane.get(lane.id);
      if (!removed && !added) return lane;
      const remaining = removed ? lane.items.filter((item) => !removed.has(idOf(item))) : lane.items;
      const items = added ? [...added, ...remaining] : remaining;
      const total = Math.max(0, lane.total - (removed?.size ?? 0) + (added?.length ?? 0));
      return { ...lane, items, total };
    });
  });

  protected readonly collapsed = linkedSignal<string | null, ReadonlySet<string>>({
    source: () => this.collapseStorageKey(),
    computation: (key) => readCollapsed(key),
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    let measureTimer: ReturnType<typeof setTimeout> | null = null;
    let measureRaf = 0;

    // Re-measure after the lanes render: their horizontal scrollbar changes the space left for the columns.
    effect(() => {
      this.displayLanes();
      if (measureTimer !== null) clearTimeout(measureTimer);
      if (measureRaf) cancelAnimationFrame(measureRaf);
      measureTimer = setTimeout(() => {
        measureTimer = null;
        if (this.destroyed) return;
        measureRaf = requestAnimationFrame(() => {
          measureRaf = 0;
          if (!this.destroyed) this.measureColumns();
        });
      });
    });
    afterNextRender(() => {
      if (this.destroyed) return;
      const board = this.boardRoot().nativeElement;
      const main = board.closest('main');
      const observer = new ResizeObserver(() => {
        if (!this.destroyed) this.measureColumns();
      });
      const targets = new Set<Element>([board]);
      if (main) targets.add(main);
      if (board.parentElement) {
        targets.add(board.parentElement);
        if (board.parentElement.parentElement) {
          targets.add(board.parentElement.parentElement);
        }
      }
      for (const target of targets) {
        observer.observe(target);
      }
      this.measureColumns();

      const stopMonitor = monitorForElements({
        canMonitor: ({ source }) => isDraggedRecord(source.data),
        onDragStart: ({ source }) => {
          if (isDraggedRecord(source.data)) {
            this.activeDrag.set({ id: source.data.recordId, from: source.data.fromLaneId });
          }
        },
        onDrop: () => this.activeDrag.set(null),
      });

      destroyRef.onDestroy(() => {
        observer.disconnect();
        stopMonitor();
      });
    });

    destroyRef.onDestroy(() => {
      this.destroyed = true;
      if (measureTimer !== null) clearTimeout(measureTimer);
      if (measureRaf) cancelAnimationFrame(measureRaf);
    });
  }

  /** Optimistically moves a card between lanes until the parent updates `lanes` or calls `revert`. */
  applyMove(id: string, from: string, to: string): void {
    if (from === to) return;
    const current = this.optimistic();
    const existing = current.get(id);
    if (existing) {
      if (existing.to === to) return;
      if (existing.from === to) {
        this.revert(id);
        return;
      }
      if (!this.lanes().some((lane) => lane.id === to)) return;
      const next = new Map(current);
      next.set(id, { id, from: existing.from, to });
      this.optimistic.set(next);
      return;
    }

    const lanes = this.lanes();
    const idOf = this.idOf();
    const fromLane = lanes.find((lane) => lane.id === from);
    const toLane = lanes.find((lane) => lane.id === to);
    if (!fromLane || !toLane || !fromLane.items.some((item) => idOf(item) === id)) return;
    const next = new Map(current);
    next.set(id, { id, from, to });
    this.optimistic.set(next);
  }

  /** Reverts an optimistic move for a card back to its source lane. */
  revert(id: string): void {
    const current = this.optimistic();
    if (!current.has(id)) return;
    const next = new Map(current);
    next.delete(id);
    this.optimistic.set(next);
  }

  protected toggle(laneId: string): void {
    const next = new Set(this.collapsed());
    if (next.has(laneId)) next.delete(laneId);
    else next.add(laneId);
    this.collapsed.set(next);
    writeCollapsed(this.collapseStorageKey(), next);
  }

  /**
   * An 'allow' drop moves the card at once (optimistic). A 'confirm' drop leaves the card in its lane: the host
   * opens its dialog and moves the card itself (applyMove or new `lanes`) only when the user confirms.
   */
  protected onDropped(lane: BoardLane<T>, dragged: DraggedRecord): void {
    if (lane.dropRule === 'deny' || dragged.fromLaneId === lane.id) return;
    if (lane.dropRule === 'confirm') {
      this.move.emit({ id: dragged.recordId, from: dragged.fromLaneId, to: lane.id, needsConfirm: true });
      return;
    }
    this.applyMove(dragged.recordId, dragged.fromLaneId, lane.id);
    this.move.emit({ id: dragged.recordId, from: dragged.fromLaneId, to: lane.id });
  }

  protected itemTrack(item: T): string {
    return (this.trackBy() ?? this.idOf())(item);
  }

  protected canDragItem(item: T): boolean {
    const check = this.canDrag();
    return check ? check(item) : true;
  }

  protected countBadgeClass(tone?: BoardLaneTone): string {
    if (tone === 'danger') return 'bg-danger-soft text-on-danger-soft';
    if (tone === 'success') return 'bg-success-soft text-on-success-soft';
    return 'bg-neutral-soft text-on-neutral-soft';
  }

  protected laneClass(lane: BoardLane<T>, isCollapsed: boolean, isOver: boolean): string {
    const drag = this.activeDrag();
    const deniedDuringDrag = lane.dropRule === 'deny' && drag !== null && drag.from !== lane.id;
    const base = isCollapsed
      ? `w-kanban-collapsed shrink-0 items-center gap-8 py-8 ${isOver ? 'bg-brand-soft' : 'bg-neutral-soft'}`
      : 'min-w-kanban-col-min flex-1 bg-neutral-soft';
    return deniedDuringDrag ? `${base} cursor-not-allowed opacity-drag-source` : base;
  }

  private measureColumns(): void {
    if (this.destroyed) return;
    const board = this.boardRoot().nativeElement;
    const main = board.closest('main');
    if (!main) return;
    const offsetInMain = rectInPage(board).top - rectInPage(main).top + main.scrollTop;
    const scrollbar = board.offsetHeight - board.clientHeight; // the board's horizontal scrollbar
    // main's bottom padding is the web phone reserve when the phone dock is shown (review F7), so the
    // folded phone bar never covers the board's horizontal scrollbar.
    const mainPadBottom = parseFloat(getComputedStyle(main).paddingBottom) || 0;
    const bottomGap = 8 + 12 + scrollbar + mainPadBottom; // board pb-8 + page padding 12 + phone reserve
    const min = Math.max(0, Math.floor(main.clientHeight - offsetInMain - bottomGap));
    this.columnMinHeight.set(min);
    // The horizontal scrollbar can appear only after the new height is applied: check once more next frame.
    requestAnimationFrame(() => {
      if (!this.destroyed && board.offsetHeight - board.clientHeight !== scrollbar) this.measureColumns();
    });
  }
}
