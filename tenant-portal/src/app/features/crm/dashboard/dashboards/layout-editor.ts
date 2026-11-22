import { computed, signal, type Signal } from '@angular/core';
import type { GridItem } from '../../../../shared/widgets/dashboard/dashboard-grid/dashboard-grid';

export interface LayoutPayloadItem {
  placementId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: 0;
  isHidden: false;
}

const MAX_UNDO = 50;

function cloneItem(item: GridItem): GridItem {
  const copy: GridItem = {
    id: item.id,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
  };
  if (item.maxW !== undefined) copy.maxW = item.maxW;
  if (item.maxH !== undefined) copy.maxH = item.maxH;
  return copy;
}

function cloneItems(items: readonly GridItem[]): GridItem[] {
  return items.map(cloneItem);
}

function itemsEqual(a: readonly GridItem[], b: readonly GridItem[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map<string, GridItem>();
  for (const item of a) {
    byId.set(item.id, item);
  }
  if (byId.size !== a.length) return false;
  for (const item of b) {
    const match = byId.get(item.id);
    if (!match) return false;
    if (
      Math.round(match.x) !== Math.round(item.x) ||
      Math.round(match.y) !== Math.round(item.y) ||
      Math.round(match.w) !== Math.round(item.w) ||
      Math.round(match.h) !== Math.round(item.h)
    ) {
      return false;
    }
  }
  return true;
}

/** Pure signal-backed state container for dashboard layout editing and bounded undo history. */
export class LayoutEditor {
  private readonly baseline = signal<GridItem[]>([]);
  private readonly _items = signal<GridItem[]>([]);
  private readonly history = signal<GridItem[][]>([]);

  readonly items: Signal<GridItem[]> = this._items.asReadonly();
  readonly dirty: Signal<boolean> = computed(() => !itemsEqual(this._items(), this.baseline()));
  readonly canUndo: Signal<boolean> = computed(() => this.history().length > 0);

  constructor(items: GridItem[] = []) {
    const initial = cloneItems(items);
    this.baseline.set(initial);
    this._items.set(cloneItems(initial));
  }

  apply(items: GridItem[]): void {
    const next = cloneItems(items);
    const current = this._items();
    if (itemsEqual(current, next)) return;

    this.history.update((stack) => {
      const trimmed = stack.length >= MAX_UNDO ? stack.slice(-(MAX_UNDO - 1)) : stack;
      return [...trimmed, cloneItems(current)];
    });
    this._items.set(next);
  }

  undo(): void {
    const stack = this.history();
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1];
    this.history.set(stack.slice(0, -1));
    this._items.set(cloneItems(prev));
  }

  reset(items: GridItem[]): void {
    const next = cloneItems(items);
    this.baseline.set(next);
    this._items.set(cloneItems(next));
    this.history.set([]);
  }

  remove(id: string): void {
    const next = this._items().filter((item) => item.id !== id);
    this.apply(next);
  }

  add(item: GridItem): void {
    const current = this._items();
    const exists = current.some((entry) => entry.id === item.id);
    const next = exists
      ? current.map((entry) => (entry.id === item.id ? item : entry))
      : [...current, item];
    this.apply(next);
  }

  payload(): LayoutPayloadItem[] {
    return this._items().map((item) => ({
      placementId: item.id,
      x: Math.round(item.x),
      y: Math.round(item.y),
      w: Math.round(item.w),
      h: Math.round(item.h),
      zIndex: 0,
      isHidden: false,
    }));
  }
}
