import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { rangeText } from '../../pricing.service';
import { GovernanceBadgeModule, VersionStatusBadge } from '../version-status-badge/version-status-badge';

export type GovernedTableColumn =
  | 'number'
  | 'status'
  | 'effective'
  | 'by'
  | 'tests'
  | 'source'
  | 'counts';

export interface GovernedRowAction {
  key: string;
  title: string;
  icon: string;
  tile: string;
  danger?: boolean;
  disabled?: boolean;
  reason?: string;
}

export interface GovernedRow {
  id: string;
  versionNumber: number;
  status: string;
  liveScheduled?: boolean;
  awaitingActivation?: boolean;
  supersededByVersionNumber?: number | null;
  restoredFromVersionNumber?: number | null;
  effectiveRange?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  byPrimary?: string | null;
  bySecondary?: string | null;
  byIsMe?: boolean;
  testPassed?: boolean | null;
  sourceLabel?: string | null;
  countsPrimary?: string | null;
  countsSecondary?: string | null;
  actions?: readonly GovernedRowAction[];
}

export interface GovernedRowActionEvent {
  row: GovernedRow;
  key: string;
}

const COLUMN_TRACKS: Readonly<Record<GovernedTableColumn, string>> = {
  number: 'minmax(0, 1.1fr)',
  status: 'minmax(0, 1.15fr)',
  effective: 'minmax(0, 1.75fr)',
  by: 'minmax(0, 1.45fr)',
  tests: 'minmax(0, 0.95fr)',
  source: 'minmax(0, 1.2fr)',
  counts: 'minmax(0, 1.1fr)',
};

@Component({
  selector: 'app-governed-versions-table',
  imports: [TranslocoPipe, ActionsMenu, VersionStatusBadge],
  templateUrl: './governed-versions-table.html',
})
export class GovernedVersionsTable {
  protected readonly lang = inject(LanguageState).current;
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  readonly rows = input.required<readonly GovernedRow[]>();
  readonly columns = input.required<readonly GovernedTableColumn[]>();
  readonly module = input.required<GovernanceBadgeModule>();
  readonly loading = input(false);
  readonly emptyText = input<string | null>(null);

  readonly open = output<GovernedRow>();
  readonly action = output<GovernedRowActionEvent>();

  protected readonly hasActions = computed(() =>
    this.rows().some((row) => (row.actions?.length ?? 0) > 0),
  );

  protected readonly gridTemplate = computed(() => {
    const tracks = this.columns().map((col) => COLUMN_TRACKS[col]);
    if (this.hasActions() || this.loading()) {
      tracks.push('var(--table-head-h)');
    }
    return tracks.join(' ');
  });

  protected effectiveText(row: GovernedRow): string {
    if (row.effectiveRange) {
      return row.effectiveRange;
    }
    return rangeText(row.effectiveFrom, row.effectiveTo, this.lang());
  }

  protected menuItems(row: GovernedRow): ActionItem[] {
    return (row.actions ?? []).map((item) => ({
      id: item.key,
      title: item.title,
      icon: item.icon,
      tile: item.tile,
      danger: item.danger,
      disabled: item.disabled,
      reason: item.reason,
    }));
  }

  protected onAction(row: GovernedRow, selection: ActionSelection): void {
    this.action.emit({ row, key: selection.id });
  }

  protected onRowKeydown(event: KeyboardEvent, row: GovernedRow): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open.emit(row);
    }
  }
}
