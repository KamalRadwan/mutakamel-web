import { Injectable, computed, signal } from '@angular/core';
import type { BulkJobSelection } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import {
  ITEM_BULK_SELECTION_LIMIT,
  type ItemBulkFilter,
  type SelectedItemRow,
} from './item-bulk.model';

interface AllSelectionState {
  filter: ItemBulkFilter;
  total: number;
  excluded: Set<string>;
}

function stableFilterKey(filter: ItemBulkFilter): string {
  const entries = Object.entries(filter)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

@Injectable()
export class ItemSelection {
  private readonly idsMap = signal(new Map<string, SelectedItemRow>());
  private readonly allState = signal<AllSelectionState | null>(null);
  private lastFilterKey: string | null = null;

  readonly mode = computed<'ids' | 'all'>(() => (this.allState() ? 'all' : 'ids'));
  readonly allTotal = computed(() => this.allState()?.total ?? 0);
  readonly count = computed(() => {
    const all = this.allState();
    if (all) return Math.max(0, all.total - all.excluded.size);
    return this.idsMap().size;
  });

  isSelected(id: string): boolean {
    const all = this.allState();
    if (all) return !all.excluded.has(id);
    return this.idsMap().has(id);
  }

  toggle(row: SelectedItemRow): void {
    const all = this.allState();
    if (all) {
      const next = new Set(all.excluded);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      this.allState.set({ ...all, excluded: next });
      return;
    }

    this.idsMap.update((current) => {
      const next = new Map(current);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.set(row.id, row);
      }
      return next;
    });
  }

  setRows(rows: readonly SelectedItemRow[], selected: boolean): void {
    const all = this.allState();
    if (all) {
      const next = new Set(all.excluded);
      for (const row of rows) {
        if (selected) {
          next.delete(row.id);
        } else {
          next.add(row.id);
        }
      }
      this.allState.set({ ...all, excluded: next });
      return;
    }

    this.idsMap.update((current) => {
      const next = new Map(current);
      for (const row of rows) {
        if (selected) {
          next.set(row.id, row);
        } else {
          next.delete(row.id);
        }
      }
      return next;
    });
  }

  pageState(ids: readonly string[]): 'none' | 'some' | 'all' {
    if (ids.length === 0) return 'none';
    let selected = 0;
    for (const id of ids) {
      if (this.isSelected(id)) selected++;
    }
    if (selected === 0) return 'none';
    if (selected === ids.length) return 'all';
    return 'some';
  }

  selectAllMatching(filter: ItemBulkFilter, total: number): void {
    if (total <= 0 || total > ITEM_BULK_SELECTION_LIMIT) return;
    this.lastFilterKey = stableFilterKey(filter);
    this.idsMap.set(new Map());
    this.allState.set({
      filter: structuredClone(filter),
      total,
      excluded: new Set(),
    });
  }

  onFilterChange(filter: ItemBulkFilter): void {
    const nextKey = stableFilterKey(filter);
    if (this.lastFilterKey === nextKey) return;
    this.lastFilterKey = nextKey;
    this.allState.set(null);
  }

  hiddenCount(visibleIds: ReadonlySet<string> | null): number {
    if (!visibleIds || this.allState()) return 0;
    let hidden = 0;
    for (const id of this.idsMap().keys()) {
      if (!visibleIds.has(id)) hidden++;
    }
    return hidden;
  }

  clear(): void {
    this.allState.set(null);
    this.idsMap.set(new Map());
  }

  replaceWith(rows: readonly SelectedItemRow[]): void {
    this.allState.set(null);
    const next = new Map<string, SelectedItemRow>();
    for (const row of rows) {
      next.set(row.id, row);
    }
    this.idsMap.set(next);
  }

  selectedIds(): string[] {
    return Array.from(this.idsMap().keys());
  }

  snapshot(): BulkJobSelection {
    const all = this.allState();
    if (all) {
      return {
        kind: 'QUERY',
        query: structuredClone(all.filter),
        excludedIds: Array.from(all.excluded),
      };
    }
    return {
      kind: 'IDS',
      ids: Array.from(this.idsMap().keys()),
    };
  }
}
