import { Component, computed, effect, inject, input, resource, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerInbox, tablerLink, tablerRefresh } from '@ng-icons/tabler-icons';
import { Button } from '../../../../shared/ui/button/button';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { listResults } from '../imports.api';
import type { RowResult } from '../imports.model';
import { fieldLabel, formatInt, normalizePage, translateRowError } from '../mapping-rows/mapping-rows';

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZES = [25, 50, 100];

@Component({
  selector: 'app-run-results-table',
  imports: [RouterLink, NgIcon, TranslocoPipe, Button, Pagination, AutomationBadge],
  providers: [provideIcons({ tablerAlertTriangle, tablerInbox, tablerLink, tablerRefresh })],
  templateUrl: './run-results-table.html',
  host: { class: 'flex min-w-0 flex-col gap-8' },
})
export class RunResultsTable {
  private readonly transloco = inject(TranslocoService);

  readonly runId = input.required<string>();
  readonly targetCode = input('');
  readonly status = input<RowResult['status'] | 'ALL'>('ALL');
  readonly refreshToken = input(0);

  protected readonly page = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  private readonly resultsResource = resource({
    params: () => ({
      runId: this.runId(),
      status: this.status(),
      page: this.page(),
      limit: Math.min(100, this.pageSize()),
      tick: this.refreshToken(),
    }),
    loader: async ({ params }) => {
      if (!params.runId) {
        return normalizePage<RowResult>([], 1, params.limit);
      }
      const res = await listResults(params.runId, {
        page: params.page,
        limit: params.limit,
        ...(params.status !== 'ALL' ? { status: params.status } : {}),
      });
      return normalizePage<RowResult>(res, params.page, params.limit);
    },
  });

  protected readonly loading = computed(() => this.resultsResource.isLoading() && !this.resultsResource.hasValue());
  protected readonly failed = computed(() => !!this.resultsResource.error());
  protected readonly items = computed<RowResult[]>(() =>
    this.resultsResource.hasValue() ? this.resultsResource.value().items : [],
  );
  protected readonly total = computed(() =>
    this.resultsResource.hasValue() ? this.resultsResource.value().total : 0,
  );

  constructor() {
    let prevRunId = '';
    let prevStatus: string = 'ALL';
    effect(() => {
      const id = this.runId();
      const status = this.status();
      if (id === prevRunId && status === prevStatus) return;
      prevRunId = id;
      prevStatus = status;
      untracked(() => this.page.set(1));
    });
  }

  protected retry(): void {
    this.resultsResource.reload();
  }

  protected onPageSizeChange(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(Math.min(100, size));
    this.page.set(1);
  }

  protected formatRowNumber(n: number): string {
    return formatInt(n);
  }

  protected fieldName(code: string | null | undefined): string {
    return fieldLabel(this.transloco, code);
  }

  protected problemText(code: string | null | undefined): string {
    return translateRowError(this.transloco, code);
  }
}
