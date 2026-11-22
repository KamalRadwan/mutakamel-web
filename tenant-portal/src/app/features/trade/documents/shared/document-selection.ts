import { Injectable, Signal, signal } from '@angular/core';
import { BULK_JOB_LIMITS, type BulkJobSelection } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import type { ListQuery } from './document.model';

export const DOCUMENT_SELECTION_LIMIT = BULK_JOB_LIMITS.maxItems;

@Injectable()
export class DocumentSelection {
  readonly limit = DOCUMENT_SELECTION_LIMIT;

  private readonly _ids = signal<ReadonlySet<string>>(new Set());
  private readonly _mode = signal<'ids' | 'all'>('ids');
  private readonly _excluded = signal<ReadonlySet<string>>(new Set());

  readonly ids: Signal<ReadonlySet<string>> = this._ids.asReadonly();
  readonly mode: Signal<'ids' | 'all'> = this._mode.asReadonly();
  readonly excluded: Signal<ReadonlySet<string>> = this._excluded.asReadonly();

  count(total: number): number {
    if (this._mode() === 'all') {
      return Math.max(0, total - this._excluded().size);
    }
    return this._ids().size;
  }

  isSelected(id: string): boolean {
    if (this._mode() === 'all') {
      return !this._excluded().has(id);
    }
    return this._ids().has(id);
  }

  exceedsLimit(total: number): boolean {
    return this.count(total) > this.limit;
  }

  pageState(pageIds: readonly string[]): 'none' | 'some' | 'all' {
    if (pageIds.length === 0) return 'none';
    let selected = 0;
    for (const id of pageIds) {
      if (this.isSelected(id)) selected += 1;
    }
    if (selected === 0) return 'none';
    if (selected === pageIds.length) return 'all';
    return 'some';
  }

  toggle(id: string): void {
    if (this._mode() === 'all') {
      this._excluded.update((current) => {
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      return;
    }

    this._ids.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  togglePage(pageIds: readonly string[]): void {
    if (pageIds.length === 0) return;
    const deselect = pageIds.every((id) => this.isSelected(id));

    if (this._mode() === 'all') {
      this._excluded.update((current) => {
        const next = new Set(current);
        for (const id of pageIds) {
          if (deselect) {
            next.add(id);
          } else {
            next.delete(id);
          }
        }
        return next;
      });
      return;
    }

    this._ids.update((current) => {
      const next = new Set(current);
      for (const id of pageIds) {
        if (deselect) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }

  selectAll(): void {
    this._mode.set('all');
    this._ids.set(new Set());
    this._excluded.set(new Set());
  }

  clear(): void {
    this._mode.set('ids');
    this._ids.set(new Set());
    this._excluded.set(new Set());
  }

  clearIfAll(): void {
    if (this._mode() === 'all') {
      this.clear();
    }
  }

  /** QUERY carries the list filters without page and limit: the bulk query schema rejects unknown keys (400). */
  toSelection(query: ListQuery): BulkJobSelection {
    if (this._mode() === 'all') {
      const { page: _page, limit: _limit, ...filters } = query;
      return {
        kind: 'QUERY',
        query: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')),
        excludedIds: Array.from(this._excluded()),
      };
    }
    return {
      kind: 'IDS',
      ids: Array.from(this._ids()),
    };
  }
}
