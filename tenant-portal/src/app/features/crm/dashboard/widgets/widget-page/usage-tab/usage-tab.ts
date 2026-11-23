import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerLayoutDashboard } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Notify } from '../../../../../../core/notify/notify';
import { Button } from '../../../../../../shared/ui/button/button';
import { DASH, formatNumber } from '../../../../../../shared/ui/chart/chart-format';
import { DataCell, DataColumn, DataTable } from '../../../../../../shared/ui/data-table/data-table';
import { Field } from '../../../../../../shared/ui/field/field';
import { errorCodeOf } from '../../../../../../shared/widgets/dashboard/analytics-api';
import { errorKey } from '../../../../../../shared/widgets/dashboard/panel-state';
import { getWidget } from '../../widgets.api';
import type { WidgetDetail } from '../../widgets.model';

type UsagePlacement = WidgetDetail['usage']['placements'][number];

export type UsageRow =
  | { kind: 'placement'; placement: UsagePlacement }
  | { kind: 'hidden'; count: number };

@Component({
  selector: 'app-usage-tab',
  imports: [TranslocoPipe, NgIcon, Button, DataTable, DataCell, Field],
  providers: [provideIcons({ tablerLayoutDashboard })],
  viewProviders: [provideTranslocoScope({ scope: 'crm-widget-page', alias: 'widgetPage' }, { scope: 'analytics', alias: 'analytics' })],
  templateUrl: './usage-tab.html',
  host: { class: 'block min-w-0' },
})
export class UsageTab {
  private static nextId = 0;
  protected readonly uid = `widget-usage-${++UsageTab.nextId}`;
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  readonly widget = input.required<WidgetDetail>();

  protected readonly dash = DASH;
  private readonly extraPlacements = signal<UsagePlacement[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loadingMore = signal(false);

  private loadMoreSeq = 0;

  constructor() {
    effect(() => {
      const current = this.widget();
      this.loadMoreSeq++;
      this.loadingMore.set(false);
      this.extraPlacements.set([]);
      this.nextCursor.set(current.usage.nextCursor);
    });
    inject(DestroyRef).onDestroy(() => this.loadMoreSeq++);
  }

  protected readonly dashboardCountText = computed(() =>
    formatNumber(this.widget().usage.dashboardCount, this.language()),
  );

  protected readonly placementCountText = computed(() =>
    formatNumber(this.widget().usage.placementCount, this.language()),
  );

  protected readonly hiddenPlacementCountText = computed(() =>
    formatNumber(this.widget().usage.hiddenPlacementCount, this.language()),
  );

  protected readonly activeShareCountText = computed(() => {
    const count = this.widget().usage.activeShareCount;
    return count == null ? DASH : formatNumber(count, this.language());
  });

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    return [
      { key: 'dashboard', label: this.transloco.translate('widgetPage.usage.dashboard'), width: 3 },
      { key: 'position', label: this.transloco.translate('widgetPage.usage.position'), width: 1, align: 'end', numeric: true },
      { key: 'size', label: this.transloco.translate('widgetPage.usage.size'), width: 1, align: 'end', numeric: true },
    ];
  });

  protected readonly allPlacements = computed<UsagePlacement[]>(() => {
    const base = this.widget().usage.placements;
    const extra = this.extraPlacements();
    if (extra.length === 0) return base;
    const seen = new Set(base.map((item) => item.placementId));
    const merged = [...base];
    for (const item of extra) {
      if (!seen.has(item.placementId)) {
        seen.add(item.placementId);
        merged.push(item);
      }
    }
    return merged;
  });

  protected readonly rows = computed<UsageRow[]>(() => {
    const placements = this.allPlacements();
    const result: UsageRow[] = placements.map((placement) => ({ kind: 'placement', placement }));
    const hiddenCount = this.widget().usage.hiddenPlacementCount;
    if (!this.nextCursor() && hiddenCount > 0) {
      result.push({ kind: 'hidden', count: hiddenCount });
    }
    return result;
  });

  protected readonly rowKey = (row: UsageRow): string =>
    row.kind === 'placement' ? `p:${row.placement.placementId}` : 'hidden';

  protected readonly hasClickablePlacements = computed(() => this.allPlacements().length > 0);

  protected onRowClick(row: UsageRow): void {
    if (row.kind !== 'placement') return;
    void this.router.navigate(['/crm/dashboard/dashboards', row.placement.dashboardId]);
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    const id = this.widget().id;
    if (!cursor || this.loadingMore()) return;

    const seq = ++this.loadMoreSeq;
    this.loadingMore.set(true);
    try {
      const detail = await getWidget(id, cursor);
      if (seq !== this.loadMoreSeq || this.widget().id !== id) return;
      this.extraPlacements.update((prev) => [...prev, ...detail.usage.placements]);
      this.nextCursor.set(detail.usage.nextCursor);
    } catch (error) {
      if (seq !== this.loadMoreSeq) return;
      this.notify.error(
        this.transloco.translate('widgetPage.usage.loadMoreError'),
        this.transloco.translate(errorKey(errorCodeOf(error))),
      );
    } finally {
      if (seq === this.loadMoreSeq) {
        this.loadingMore.set(false);
      }
    }
  }
}
