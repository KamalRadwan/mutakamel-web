import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  ViewEncapsulation,
  afterNextRender,
  afterRenderEffect,
  computed,
  contentChild,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { GridStack, type GridItemHTMLElement, type GridStackOptions, type GridStackWidget } from 'gridstack';
import { LanguageState } from '../../../../core/i18n/language';

export interface GridItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW: number;
  minH: number;
  maxW?: number;
  maxH?: number;
  /** Accessible name of the item; supplied by the caller, usually the widget title. */
  label?: string;
}

const GRID_COLUMNS = 48;
const GRID_CELL_HEIGHT = 8;
const GRID_MARGIN = 4;

let nextGridHintId = 0;

function toWidgetOptions(item: GridItem): GridStackWidget {
  return {
    id: item.id,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
    maxW: item.maxW,
    maxH: item.maxH,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

@Component({
  selector: 'app-dashboard-grid',
  imports: [NgTemplateOutlet],
  templateUrl: './dashboard-grid.html',
  styleUrl: './dashboard-grid.css',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'block min-w-0' },
})
export class DashboardGrid {
  private readonly destroyRef = inject(DestroyRef);
  private readonly language = inject(LanguageState).current;
  private readonly hostRef = viewChild.required<ElementRef<HTMLElement>>('host');

  readonly items = input.required<GridItem[]>();
  readonly editing = input(false);
  readonly selectedId = input<string | null>(null);
  readonly keyboardHint = input('');
  /** Grid units one arrow key moves (columns) or one Shift+arrow resizes (rows); Trade uses whole cells. */
  readonly step = input<{ cols: number; rows: number }>({ cols: 1, rows: 1 });

  readonly layoutChange = output<GridItem[]>();
  readonly selectedChange = output<string | null>();

  protected readonly tpl = contentChild<TemplateRef<{ $implicit: GridItem }>>(TemplateRef);
  protected readonly keyboardHintId = `dashboard-grid-kbd-${++nextGridHintId}`;
  private readonly dir = computed<'rtl' | 'ltr'>(() => (this.language() === 'ar' ? 'rtl' : 'ltr'));

  private grid: GridStack | null = null;
  private initializedDir: 'rtl' | 'ltr' | null = null;
  private syncing = false;
  private initialSynced = false;
  private lastEditing = false;

  constructor() {
    afterNextRender(() => {
      this.initGrid(this.dir());
    });

    afterRenderEffect(() => {
      const dir = this.dir();
      const editing = this.editing();
      const items = this.items();
      if (!this.grid) return;

      if (dir !== this.initializedDir) {
        this.reinitGrid(dir);
        return;
      }

      this.syncEditing(editing);
      this.syncItems(items, editing);
    });

    this.destroyRef.onDestroy(() => this.destroyGrid());
  }

  protected onItemSelect(id: string) {
    if (!this.editing()) return;
    if (this.selectedId() !== id) {
      this.selectedChange.emit(id);
    }
  }

  protected onEscape() {
    if (!this.editing()) return;
    if (this.selectedId() !== null) {
      this.selectedChange.emit(null);
    }
  }

  protected onItemKeydown(event: KeyboardEvent, id: string) {
    if (!this.editing() || !this.grid) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target as HTMLElement | null;
    const itemContent = event.currentTarget as HTMLElement | null;
    if (!target || !itemContent) return;
    if (target !== itemContent && !target.closest('.gs-drag-handle')) return;

    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'ArrowUp' &&
      event.key !== 'ArrowDown'
    ) {
      return;
    }

    const itemEl = itemContent.closest('.grid-stack-item') as GridItemHTMLElement | null;
    const node = itemEl?.gridstackNode;
    const spec = this.items().find((item) => item.id === id);
    if (!itemEl || !node || !spec) return;

    const isRtl = this.dir() === 'rtl';
    let dx = 0;
    let dy = 0;
    const { cols, rows } = this.step();
    if (event.key === 'ArrowLeft') dx = isRtl ? cols : -cols;
    else if (event.key === 'ArrowRight') dx = isRtl ? -cols : cols;
    else if (event.key === 'ArrowUp') dy = -rows;
    else if (event.key === 'ArrowDown') dy = rows;

    event.preventDefault();
    this.onItemSelect(id);

    const curX = node.x ?? spec.x;
    const curY = node.y ?? spec.y;
    const curW = node.w ?? spec.w;
    const curH = node.h ?? spec.h;
    const minW = Math.max(1, spec.minW);
    const minH = Math.max(1, spec.minH);
    const maxW = Math.min(spec.maxW ?? GRID_COLUMNS, GRID_COLUMNS - curX);
    const maxH = spec.maxH ?? Number.MAX_SAFE_INTEGER;

    const activeEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (event.shiftKey) {
      const nextW = clamp(curW + dx, minW, Math.max(minW, maxW));
      const nextH = clamp(curH + dy, minH, Math.max(minH, maxH));
      if (nextW === curW && nextH === curH) return;
      this.grid.update(itemEl, { w: nextW, h: nextH });
    } else {
      const nextX = clamp(curX + dx, 0, Math.max(0, GRID_COLUMNS - curW));
      const nextY = Math.max(0, curY + dy);
      if (nextX === curX && nextY === curY) return;
      this.grid.update(itemEl, { x: nextX, y: nextY });
    }

    if (activeEl && document.activeElement !== activeEl && itemEl.contains(activeEl)) {
      activeEl.focus({ preventScroll: true });
    }
  }

  private initGrid(dir: 'rtl' | 'ltr') {
    if (this.grid) return;
    const hostEl = this.hostRef().nativeElement;
    const isRtl = dir === 'rtl';
    const editing = this.editing();

    hostEl.classList.toggle('grid-stack-rtl', isRtl);

    const options: GridStackOptions = {
      column: GRID_COLUMNS,
      cellHeight: GRID_CELL_HEIGHT,
      margin: GRID_MARGIN,
      mode: 'top',
      auto: false,
      staticGrid: !editing,
      rtl: isRtl,
      animate: !this.prefersReducedMotion(),
      alwaysShowResizeHandle: true,
      draggable: { handle: '.gs-drag-handle' },
      resizable: { handles: 'n,ne,e,se,s,sw,w,nw', autoHide: false },
    };

    const grid = GridStack.init(options, hostEl);
    if (!grid) return;

    this.grid = grid;
    this.initializedDir = dir;
    this.lastEditing = editing;

    grid.on('change', () => this.onGridChange());
    this.syncItems(this.items(), editing);
  }

  private reinitGrid(dir: 'rtl' | 'ltr') {
    this.destroyGrid();
    this.clearGridPositionStyles();
    this.initGrid(dir);
  }

  private destroyGrid() {
    if (!this.grid) return;
    this.grid.offAll();
    this.grid.destroy(false);
    this.grid = null;
    this.initializedDir = null;
    this.initialSynced = false;
  }

  private clearGridPositionStyles() {
    const hostEl = this.hostRef().nativeElement;
    hostEl.classList.remove('grid-stack-rtl', 'grid-stack-static', 'grid-stack-animate');
    hostEl.style.removeProperty('height');
    hostEl.style.removeProperty('min-height');
    const children = hostEl.querySelectorAll<HTMLElement>(':scope > .grid-stack-item');
    for (const el of children) {
      el.classList.remove('ui-draggable-disabled', 'ui-resizable-disabled');
      el.style.removeProperty('left');
      el.style.removeProperty('right');
      el.style.removeProperty('top');
      el.style.removeProperty('width');
      el.style.removeProperty('height');
      el.style.removeProperty('position');
    }
  }

  private syncEditing(editing: boolean) {
    if (!this.grid || editing === this.lastEditing) return;
    this.lastEditing = editing;
    this.grid.setStatic(!editing);
    if (editing) {
      for (const el of this.grid.getGridItems()) {
        this.grid.refreshDragHandles(el);
      }
    }
  }

  private syncItems(items: GridItem[], editing: boolean) {
    const grid = this.grid;
    if (!grid) return;
    const isFirstSync = !this.initialSynced;
    this.initialSynced = true;

    const itemMap = new Map<string, GridItem>();
    for (const item of items) {
      itemMap.set(item.id, item);
    }

    const domById = new Map<string, GridItemHTMLElement>();
    const hostChildren = Array.from(this.hostRef().nativeElement.children);
    for (const child of hostChildren) {
      if (!(child instanceof HTMLElement)) continue;
      if (!child.classList.contains('grid-stack-item') || child.classList.contains('grid-stack-placeholder')) {
        continue;
      }
      const id = child.getAttribute('gs-id') ?? (child as GridItemHTMLElement).gridstackNode?.id;
      if (id) domById.set(id, child as GridItemHTMLElement);
    }

    const removedNodes = grid.engine.nodes.filter((node) => !node.id || !itemMap.has(node.id));
    const addedEls: { item: GridItem; el: GridItemHTMLElement }[] = [];
    const updatedEls: { item: GridItem; el: GridItemHTMLElement }[] = [];

    for (const item of items) {
      const el = domById.get(item.id);
      if (!el) continue;
      const node = el.gridstackNode;
      if (!node) {
        addedEls.push({ item, el });
      } else if (
        (node.x ?? 0) !== item.x ||
        (node.y ?? 0) !== item.y ||
        (node.w ?? 1) !== item.w ||
        (node.h ?? 1) !== item.h ||
        node.minW !== item.minW ||
        node.minH !== item.minH ||
        node.maxW !== item.maxW ||
        node.maxH !== item.maxH
      ) {
        updatedEls.push({ item, el });
      }
    }

    if (!removedNodes.length && !addedEls.length && !updatedEls.length) return;

    addedEls.sort((a, b) => a.item.y - b.item.y || a.item.x - b.item.x);
    updatedEls.sort((a, b) => a.item.y - b.item.y || a.item.x - b.item.x);

    this.syncing = true;
    try {
      grid.batchUpdate(true);
      for (const node of removedNodes) {
        if (node.el) grid.removeWidget(node.el, false, false);
      }
      for (const { item, el } of addedEls) {
        grid.makeWidget(el, toWidgetOptions(item));
      }
      for (const { item, el } of updatedEls) {
        grid.update(el, toWidgetOptions(item));
      }
      grid.batchUpdate(false);
    } finally {
      this.syncing = false;
    }

    // Gridstack may push other widgets after an add, remove or update; the first sync only mirrors the input.
    if (!isFirstSync) this.onGridChange();

    if (editing && addedEls.length) {
      for (const { el } of addedEls) {
        grid.refreshDragHandles(el);
      }
    }
  }

  private onGridChange() {
    if (this.syncing || !this.grid) return;

    const nodesById = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const node of this.grid.engine.nodes) {
      if (!node.id) continue;
      nodesById.set(node.id, {
        x: node.x ?? 0,
        y: node.y ?? 0,
        w: node.w ?? 1,
        h: node.h ?? 1,
      });
    }

    const current = this.items();
    let changed = false;
    const next = current.map((item) => {
      const pos = nodesById.get(item.id);
      if (!pos) return item;
      if (pos.x === item.x && pos.y === item.y && pos.w === item.w && pos.h === item.h) {
        return item;
      }
      changed = true;
      return { ...item, x: pos.x, y: pos.y, w: pos.w, h: pos.h };
    });

    if (changed) {
      this.layoutChange.emit(next);
    }
  }

  private prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
