import { computed, signal } from '@angular/core';
import { BulkJobSelection } from '../../../../../shared/bulk-jobs/bulk-jobs.model';

export const DEFAULT_SELECTION_LIMIT = 10_000;

export interface AllSelectionState<TId extends string = string> {
  body: unknown;
  total: number;
  excluded: Set<TId>;
  sort?: unknown;
}

export class RecordSelection<TId extends string = string> {
  protected readonly limit: number;
  private readonly selectedIds = signal(new Set<TId>());
  protected readonly allState = signal<AllSelectionState<TId> | null>(null);
  private lastBodyKey: string | null = null;

  constructor(limit = DEFAULT_SELECTION_LIMIT) {
    this.limit = limit;
  }

  readonly mode = computed<'ids' | 'all'>(() => (this.allState() ? 'all' : 'ids'));
  readonly allTotal = computed(() => this.allState()?.total ?? 0);
  readonly count = computed(() => {
    const all = this.allState();
    if (all) return Math.max(0, all.total - all.excluded.size);
    return this.selectedIds().size;
  });
  readonly ids = computed<readonly TId[]>(() => Array.from(this.selectedIds()));

  isSelected(id: TId): boolean {
    const all = this.allState();
    if (all) return !all.excluded.has(id);
    return this.selectedIds().has(id);
  }

  toggleId(id: TId): void {
    const all = this.allState();
    if (all) {
      const next = new Set(all.excluded);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      this.allState.set({ ...all, excluded: next });
      return;
    }

    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  setIds(ids: readonly TId[], selected: boolean): void {
    const all = this.allState();
    if (all) {
      const next = new Set(all.excluded);
      for (const id of ids) {
        if (selected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      this.allState.set({ ...all, excluded: next });
      return;
    }

    this.selectedIds.update((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (selected) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }

  pageState(rowIds: readonly TId[]): 'none' | 'some' | 'all' {
    if (rowIds.length === 0) return 'none';
    let selected = 0;
    for (const id of rowIds) {
      if (this.isSelected(id)) selected++;
    }
    if (selected === 0) return 'none';
    if (selected === rowIds.length) return 'all';
    return 'some';
  }

  selectAllMatching(body: unknown, total: number, sort?: unknown): void {
    if (total <= 0 || total > this.limit) return;
    this.lastBodyKey = JSON.stringify(body);
    this.selectedIds.set(new Set());
    this.allState.set({
      body: structuredClone(body),
      total,
      excluded: new Set(),
      ...(sort !== undefined ? { sort: structuredClone(sort) } : {}),
    });
  }

  onBodyChange(body: unknown): void {
    const nextKey = JSON.stringify(body);
    if (this.lastBodyKey === nextKey) return;
    this.lastBodyKey = nextKey;
    this.allState.set(null);
  }

  hiddenCount(visibleIds: ReadonlySet<TId> | null): number {
    if (!visibleIds) return 0;
    const all = this.allState();
    if (all) return 0;
    let hidden = 0;
    for (const id of this.selectedIds()) {
      if (!visibleIds.has(id)) hidden++;
    }
    return hidden;
  }

  clear(): void {
    this.allState.set(null);
    this.selectedIds.set(new Set());
  }

  replaceIds(ids: readonly TId[]): void {
    this.allState.set(null);
    this.selectedIds.set(new Set(ids));
  }

  snapshot(): BulkJobSelection {
    const all = this.allState();
    if (all) {
      return {
        kind: 'QUERY',
        query: {
          search: structuredClone(all.body),
          ...(all.sort !== undefined ? { sort: structuredClone(all.sort) } : {}),
        },
        excludedIds: Array.from(all.excluded),
      };
    }
    return {
      kind: 'IDS',
      ids: Array.from(this.selectedIds()),
    };
  }
}
