import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { BULK_JOB_LIMITS, BulkJobSelection } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError } from '../../settings/shared/settings-api';
import { RecordSelection } from '../../shared/record/selection/record-selection';
import { selectOpportunities } from '../opportunities.api';
import type {
  OpportunityRow,
  OpportunitySearchBody,
  SelectedOpportunity,
} from '../opportunities.model';
import { PipelineScope } from '../pipeline-scope';

export const OPPORTUNITY_SELECTION_LIMIT = BULK_JOB_LIMITS.maxItems;
export const OPPORTUNITY_DELETE_TYPED_CONFIRM_FROM = 50;

export type OpportunitySelectionRow = Pick<
  OpportunityRow,
  'id' | 'title' | 'ownerUserId' | 'stageId' | 'status' | 'updatedAt'
>;

export function toSelectedOpportunity(row: OpportunitySelectionRow): SelectedOpportunity {
  return {
    id: row.id,
    title: row.title,
    ownerUserId: row.ownerUserId,
    stageId: row.stageId,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class OpportunitySelection extends RecordSelection<string> {
  private readonly pipelineScope = inject(PipelineScope, { optional: true });
  private readonly rowsById = new Map<string, SelectedOpportunity>();
  private readonly truncatedState = signal(false);
  private readonly selectingAllState = signal(false);

  private selectAllSeq = 0;
  private lastPipelineId: string | null | undefined = undefined;

  readonly truncated = this.truncatedState.asReadonly();
  readonly selectingAll = this.selectingAllState.asReadonly();

  constructor() {
    super(OPPORTUNITY_SELECTION_LIMIT);

    const scope = this.pipelineScope;
    if (scope) {
      effect(() => {
        const pipelineId = scope.current()?.id ?? null;
        untracked(() => this.onPipelineChange(pipelineId));
      });
    }
  }

  toggle(row: OpportunitySelectionRow): void {
    this.toggleId(row.id);
    if (this.mode() === 'ids') {
      if (this.isSelected(row.id)) {
        this.rowsById.set(row.id, toSelectedOpportunity(row));
      } else {
        this.rowsById.delete(row.id);
      }
    }
  }

  setRows(rows: readonly OpportunitySelectionRow[], selected: boolean): void {
    if (this.mode() === 'ids') {
      for (const row of rows) {
        if (selected) {
          this.rowsById.set(row.id, toSelectedOpportunity(row));
        } else {
          this.rowsById.delete(row.id);
        }
      }
    }
    this.setIds(
      rows.map((row) => row.id),
      selected,
    );
  }

  togglePage(rows: readonly OpportunitySelectionRow[]): void {
    if (rows.length === 0) return;
    const ids = rows.map((row) => row.id);
    const shouldSelect = this.pageState(ids) !== 'all';
    this.setRows(rows, shouldSelect);
  }

  override pageState(rowIds: readonly string[]): 'none' | 'some' | 'all' {
    return super.pageState(rowIds);
  }

  override async selectAllMatching(
    body: OpportunitySearchBody,
    _total?: number,
    sort?: unknown,
  ): Promise<{ total: number; truncated: boolean }> {
    const seq = ++this.selectAllSeq;
    this.selectingAllState.set(true);
    this.truncatedState.set(false);
    try {
      const res = await selectOpportunities(body, this.limit);
      if (seq !== this.selectAllSeq) {
        return { total: res.total, truncated: res.truncated };
      }

      if (res.total <= 0) {
        this.clear();
        return { total: 0, truncated: false };
      }

      if (res.truncated) {
        this.replaceWith(res.items);
        this.truncatedState.set(true);
        return { total: res.total, truncated: true };
      }

      this.rowsById.clear();
      for (const item of res.items) {
        this.rowsById.set(item.id, toSelectedOpportunity(item));
      }
      super.selectAllMatching(body, res.total, sort);
      this.truncatedState.set(false);
      return { total: res.total, truncated: false };
    } finally {
      if (seq === this.selectAllSeq) {
        this.selectingAllState.set(false);
      }
    }
  }

  override onBodyChange(body: OpportunitySearchBody): void {
    const prevAll = this.allState();
    super.onBodyChange(body);
    if (prevAll && !this.allState()) {
      this.truncatedState.set(false);
    }
  }

  onPipelineChange(pipelineId: string | null): void {
    if (this.lastPipelineId !== undefined && this.lastPipelineId !== null && this.lastPipelineId !== pipelineId) {
      this.clear();
    }
    this.lastPipelineId = pipelineId;
  }

  override clear(): void {
    this.selectAllSeq++;
    this.rowsById.clear();
    this.truncatedState.set(false);
    this.selectingAllState.set(false);
    super.clear();
  }

  replaceWith(rows: readonly OpportunitySelectionRow[]): void {
    this.selectAllSeq++;
    this.rowsById.clear();
    for (const row of rows) {
      this.rowsById.set(row.id, toSelectedOpportunity(row));
    }
    this.truncatedState.set(false);
    this.selectingAllState.set(false);
    this.replaceIds(rows.map((row) => row.id));
  }

  override snapshot(): BulkJobSelection {
    const all = this.allState();
    if (all) {
      return {
        kind: 'QUERY',
        query: toBulkQuery(all.body),
        excludedIds: Array.from(all.excluded),
      };
    }
    return {
      kind: 'IDS',
      ids: Array.from(this.ids()),
    };
  }

  async resolve(): Promise<SelectedOpportunity[]> {
    const all = this.allState();
    if (!all) {
      return this.ids()
        .map((id) => this.rowsById.get(id))
        .filter((row): row is SelectedOpportunity => Boolean(row));
    }
    const { items, truncated } = await selectOpportunities(all.body as OpportunitySearchBody, this.limit);
    if (truncated) {
      throw new ApiError(422, 'BULK_SELECTION_TOO_LARGE', { max: [String(this.limit)] });
    }
    if (all.excluded.size === 0) return items;
    return items.filter((item) => !all.excluded.has(item.id));
  }
}

// Backend OpportunitySearchFiltersDto (forbidNonWhitelisted): the QUERY is the search body
// without sorting or paging, so only these keys may be sent.
const BULK_QUERY_KEYS = [
  'branchId',
  'search',
  'searchField',
  'filter',
  'filterTree',
  'tagIds',
  'tagIdsAll',
  'tagIdsNone',
] as const;

export function toBulkQuery(body: unknown): Record<string, unknown> {
  const source = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const query: Record<string, unknown> = {};
  for (const key of BULK_QUERY_KEYS) {
    if (source[key] !== undefined) query[key] = structuredClone(source[key]);
  }
  return query;
}
