import { Injectable } from '@angular/core';
import { ApiError } from '../../settings/shared/settings-api';
import { RecordSelection } from '../../shared/record/selection/record-selection';
import { LeadSearchBody } from '../lead-search/lead-search.compile';
import { LeadRow } from '../leads.model';
import { selectLeads } from './lead-bulk.api';
import { SELECTION_LIMIT, SelectedRow } from './lead-bulk.model';

export function toSelectedRow(row: LeadRow): SelectedRow {
  return {
    id: row.id,
    displayName: row.displayName,
    ownerUserId: row.owner?.userId ?? null,
    stageId: row.stageId,
    stageFlag: row.stageFlag,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class LeadSelection extends RecordSelection<string> {
  private readonly rowsById = new Map<string, SelectedRow>();

  constructor() {
    super(SELECTION_LIMIT);
  }

  toggle(row: SelectedRow): void {
    this.toggleId(row.id);
    if (this.mode() === 'ids') {
      if (this.isSelected(row.id)) {
        this.rowsById.set(row.id, row);
      } else {
        this.rowsById.delete(row.id);
      }
    }
  }

  setRows(rows: SelectedRow[], selected: boolean): void {
    if (this.mode() === 'ids') {
      for (const row of rows) {
        if (selected) {
          this.rowsById.set(row.id, row);
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

  override selectAllMatching(body: LeadSearchBody, total: number, sort?: unknown): void {
    super.selectAllMatching(body, total, sort);
    if (this.mode() === 'all') {
      this.rowsById.clear();
    }
  }

  override onBodyChange(body: LeadSearchBody): void {
    super.onBodyChange(body);
  }

  override clear(): void {
    this.rowsById.clear();
    super.clear();
  }

  replaceWith(rows: SelectedRow[]): void {
    this.rowsById.clear();
    for (const row of rows) {
      this.rowsById.set(row.id, row);
    }
    this.replaceIds(rows.map((row) => row.id));
  }

  async resolve(): Promise<SelectedRow[]> {
    const all = this.allState();
    if (!all) {
      return this.ids()
        .map((id) => this.rowsById.get(id))
        .filter((row): row is SelectedRow => !!row);
    }
    const { items, truncated } = await selectLeads(all.body as LeadSearchBody, SELECTION_LIMIT);
    if (truncated) {
      throw new ApiError(422, 'LEAD_SELECTION_TOO_LARGE');
    }
    if (all.excluded.size === 0) return items;
    return items.filter((item) => !all.excluded.has(item.id));
  }
}
