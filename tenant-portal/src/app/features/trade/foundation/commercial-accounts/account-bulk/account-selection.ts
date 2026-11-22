import { Injectable, computed, signal } from '@angular/core';
import type { BulkJobSelection } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import type { CommercialAccountRole, CommercialAccountStatus } from '../../../shared/trade-foundation.model';
import { type AccountWithParty, partyDisplayName } from '../commercial-accounts.model';

export const ACCOUNT_SELECTION_LIMIT = 10_000;

export interface AccountListFilter {
  accountRole?: CommercialAccountRole;
  status?: CommercialAccountStatus;
  search?: string;
}

export interface SelectedAccountRow {
  id: string;
  partyId: string;
  displayName: string;
  accountRole: CommercialAccountRole;
  status: CommercialAccountStatus;
  updatedAt?: string;
}

export type AccountSelectionRow = SelectedAccountRow | AccountWithParty;

interface AllSelectionState {
  filter: AccountListFilter;
  total: number;
  excluded: Set<string>;
}

export function cleanAccountFilter(filter: AccountListFilter | null | undefined): AccountListFilter {
  if (!filter) return {};
  const cleaned: AccountListFilter = {};
  if (filter.accountRole === 'CUSTOMER' || filter.accountRole === 'SUPPLIER') {
    cleaned.accountRole = filter.accountRole;
  }
  if (filter.status === 'ACTIVE' || filter.status === 'BLOCKED') {
    cleaned.status = filter.status;
  }
  const search = typeof filter.search === 'string' ? filter.search.trim() : '';
  if (search) {
    cleaned.search = search;
  }
  return cleaned;
}

export function toSelectedAccountRow(row: AccountWithParty, lang: 'en' | 'ar' = 'en'): SelectedAccountRow {
  return {
    id: row.id,
    partyId: row.partyId,
    displayName: partyDisplayName(row.party, lang) || row.partyId,
    accountRole: row.accountRole,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

function normalizeRow(row: AccountSelectionRow): SelectedAccountRow {
  if ('party' in row) {
    return toSelectedAccountRow(row);
  }
  return { ...row };
}

@Injectable()
export class AccountSelection {
  private readonly idsMap = signal(new Map<string, SelectedAccountRow>());
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

  toggle(row: AccountSelectionRow): void {
    const normalized = normalizeRow(row);
    const all = this.allState();
    if (all) {
      const next = new Set(all.excluded);
      if (next.has(normalized.id)) {
        next.delete(normalized.id);
      } else {
        next.add(normalized.id);
      }
      this.allState.set({ ...all, excluded: next });
      return;
    }

    this.idsMap.update((current) => {
      const next = new Map(current);
      if (next.has(normalized.id)) {
        next.delete(normalized.id);
      } else {
        next.set(normalized.id, normalized);
      }
      return next;
    });
  }

  setRows(rows: readonly AccountSelectionRow[], selected: boolean): void {
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
          next.set(row.id, normalizeRow(row));
        } else {
          next.delete(row.id);
        }
      }
      return next;
    });
  }

  pageState(rowIds: readonly string[]): 'none' | 'some' | 'all' {
    if (rowIds.length === 0) return 'none';
    let selected = 0;
    for (const id of rowIds) {
      if (this.isSelected(id)) selected++;
    }
    if (selected === 0) return 'none';
    if (selected === rowIds.length) return 'all';
    return 'some';
  }

  selectAllMatching(filter: AccountListFilter, total: number): void {
    if (total <= 0 || total > ACCOUNT_SELECTION_LIMIT) return;
    const cleaned = cleanAccountFilter(filter);
    this.lastFilterKey = JSON.stringify(cleaned);
    this.idsMap.set(new Map());
    this.allState.set({
      filter: structuredClone(cleaned),
      total,
      excluded: new Set(),
    });
  }

  onFilterChange(filter: AccountListFilter): void {
    const nextKey = JSON.stringify(cleanAccountFilter(filter));
    if (this.lastFilterKey === nextKey) return;
    this.lastFilterKey = nextKey;
    this.allState.set(null);
  }

  onBodyChange(filter: AccountListFilter): void {
    this.onFilterChange(filter);
  }

  hiddenCount(visibleIds: ReadonlySet<string> | null): number {
    if (!visibleIds) return 0;
    if (this.allState()) return 0;
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

  replaceWith(rows: readonly AccountSelectionRow[]): void {
    this.allState.set(null);
    const next = new Map<string, SelectedAccountRow>();
    for (const row of rows) {
      const normalized = normalizeRow(row);
      next.set(normalized.id, normalized);
    }
    this.idsMap.set(next);
  }

  snapshot(): BulkJobSelection {
    const all = this.allState();
    if (all) {
      return {
        kind: 'QUERY',
        query: cleanAccountFilter(all.filter),
        excludedIds: Array.from(all.excluded),
      };
    }
    return {
      kind: 'IDS',
      ids: Array.from(this.idsMap().keys()),
    };
  }
}
