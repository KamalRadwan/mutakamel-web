import { Injectable } from '@angular/core';
import { ApiError } from '../../settings/shared/settings-api';
import { RecordSelection } from '../../shared/record/selection/record-selection';
import { CustomerRow, CustomerSearchBody } from '../customers.model';
import { selectCustomers } from './customer-bulk.api';
import {
  CUSTOMER_SELECTION_LIMIT,
  CustomerBulkSort,
  SelectedCustomerRow,
} from './customer-bulk.model';

export function toSelectedCustomerRow(row: CustomerRow): SelectedCustomerRow {
  return {
    id: row.id,
    displayName: row.displayName,
    ownerUserId: row.ownerUserId,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class CustomerSelection extends RecordSelection<string> {
  private readonly rowsById = new Map<string, SelectedCustomerRow>();

  constructor() {
    super(CUSTOMER_SELECTION_LIMIT);
  }

  toggle(row: CustomerRow | SelectedCustomerRow): void {
    const selectedRow = 'branchId' in row ? toSelectedCustomerRow(row) : row;
    this.toggleId(selectedRow.id);
    if (this.mode() === 'ids') {
      if (this.isSelected(selectedRow.id)) {
        this.rowsById.set(selectedRow.id, selectedRow);
      } else {
        this.rowsById.delete(selectedRow.id);
      }
    }
  }

  setRows(rows: readonly (CustomerRow | SelectedCustomerRow)[], selected: boolean): void {
    const selectedRows = rows.map((row) => ('branchId' in row ? toSelectedCustomerRow(row) : row));
    if (this.mode() === 'ids') {
      for (const row of selectedRows) {
        if (selected) {
          this.rowsById.set(row.id, row);
        } else {
          this.rowsById.delete(row.id);
        }
      }
    }
    this.setIds(
      selectedRows.map((row) => row.id),
      selected,
    );
  }

  override selectAllMatching(body: CustomerSearchBody, total: number, sort?: CustomerBulkSort): void {
    super.selectAllMatching(body, total, sort);
    if (this.mode() === 'all') {
      this.rowsById.clear();
    }
  }

  override onBodyChange(body: CustomerSearchBody): void {
    super.onBodyChange(body);
  }

  override clear(): void {
    this.rowsById.clear();
    super.clear();
  }

  replaceWith(rows: readonly SelectedCustomerRow[]): void {
    this.rowsById.clear();
    for (const row of rows) {
      this.rowsById.set(row.id, row);
    }
    this.replaceIds(rows.map((row) => row.id));
  }

  async resolve(): Promise<SelectedCustomerRow[]> {
    const all = this.allState();
    if (!all) {
      return this.ids()
        .map((id) => this.rowsById.get(id))
        .filter((row): row is SelectedCustomerRow => !!row);
    }

    const { items, truncated } = await selectCustomers(
      all.body as CustomerSearchBody,
      all.sort as CustomerBulkSort | undefined,
      CUSTOMER_SELECTION_LIMIT,
    );
    if (truncated) {
      throw new ApiError(422, 'CUSTOMER_PROFILE_SELECTION_TOO_LARGE');
    }
    if (all.excluded.size === 0) return items;
    return items.filter((item) => !all.excluded.has(item.id));
  }
}
