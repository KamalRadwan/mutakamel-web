import { Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerApps,
  tablerChartArcs,
  tablerChartArea,
  tablerChartAreaLine,
  tablerChartBar,
  tablerChartBubble,
  tablerChartColumn,
  tablerChartDonut,
  tablerChartFunnel,
  tablerChartGridDots,
  tablerChartHistogram,
  tablerChartLine,
  tablerChartPie,
  tablerChartSankey,
  tablerChartScatter,
  tablerCheck,
  tablerDashboard,
  tablerGauge,
  tablerNumber,
  tablerProgress,
  tablerSearch,
  tablerTable,
  tablerTimeline,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { ApiError as CoreApiError } from '../../../../core/api/api-errors';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { ApiError, type TradeContext, errorCodeOf, errorKey, newIdempotencyKey } from '../../shared/trade-api';
import { addPlacement, listWidgets } from '../trade-dashboard.api';
import { vizDefaultSize, type Catalog, type DashboardDetail, type Size, type TradeViz, type WidgetListItem } from '../trade-dashboard.model';

function isForbiddenError(err: unknown): boolean {
  return (
    errorCodeOf(err) === 'TRADE.DASHBOARD.SOURCE_PERMISSION_REQUIRED' ||
    ((err instanceof ApiError || err instanceof CoreApiError) && err.status === 403)
  );
}

const VIZ_ICON: Record<TradeViz, string> = {
  METRIC_CARD: 'tablerNumber',
  LINE: 'tablerChartLine',
  AREA: 'tablerChartArea',
  LINE_AREA: 'tablerChartAreaLine',
  COLUMN: 'tablerChartColumn',
  BAR: 'tablerChartBar',
  STACKED_BAR: 'tablerChartHistogram',
  PIE: 'tablerChartPie',
  DONUT: 'tablerChartDonut',
  SCATTER: 'tablerChartScatter',
  BUBBLE: 'tablerChartBubble',
  GANTT: 'tablerTimeline',
  FLOWCHART: 'tablerChartSankey',
  SEMI_CIRCLE_GAUGE: 'tablerGauge',
  THREE_QUARTER_GAUGE: 'tablerChartArcs',
  CIRCULAR_PROGRESS_GAUGE: 'tablerProgress',
  DETAILED_SPEEDOMETER: 'tablerDashboard',
  TABLE: 'tablerTable',
  FUNNEL: 'tablerChartFunnel',
  HEATMAP: 'tablerChartGridDots',
};

let nextLibraryModalSeq = 0;

@Component({
  selector: 'app-trade-widget-library-modal',
  imports: [NgIcon, TranslocoPipe, Button, Field, Modal],
  // Takes inputs, so the component-level scope lives in viewProviders (tenant-portal Transloco rule).
  viewProviders: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-dashboard', alias: 'tradeDashboard' },
      { scope: 'trade-dashboard-modals', alias: 'tradeDashboardModals' },
    ),
  ],
  providers: [
    provideIcons({
      tablerApps,
      tablerSearch,
      tablerCheck,
      tablerX,
      tablerNumber,
      tablerChartLine,
      tablerChartArea,
      tablerChartAreaLine,
      tablerChartColumn,
      tablerChartBar,
      tablerChartHistogram,
      tablerChartPie,
      tablerChartDonut,
      tablerChartScatter,
      tablerChartBubble,
      tablerTimeline,
      tablerChartSankey,
      tablerGauge,
      tablerChartArcs,
      tablerProgress,
      tablerDashboard,
      tablerTable,
      tablerChartFunnel,
      tablerChartGridDots,
    }),
  ],
  templateUrl: './widget-library-modal.html',
  host: { class: 'contents' },
})
export class WidgetLibraryModal {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modalScope = toSignal(this.transloco.selectTranslation('trade-dashboard-modals'));

  private readonly modal = viewChild.required(Modal);
  private readonly rowButtons = viewChildren<ElementRef<HTMLButtonElement>>('rowBtn');

  readonly ctx = input.required<TradeContext>();
  readonly catalog = input<Catalog | null>(null);
  readonly added = output<{ placementId: string; widgetId: string; dashboardRevision: number }>();
  readonly forbidden = output<void>();

  protected readonly uid = `trade-widget-library-${++nextLibraryModalSeq}`;
  protected readonly dashboardName = signal('');
  protected readonly searchText = signal('');
  protected readonly allWidgets = signal<WidgetListItem[]>([]);
  protected readonly placedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly submitting = signal(false);

  private dashboardId = '';
  private loadSeq = 0;
  private readonly idempotencyKeys = new Map<string, string>();

  protected readonly unplacedWidgets = computed<WidgetListItem[]>(() => {
    const placed = this.placedIds();
    return this.allWidgets().filter((w) => !placed.has(w.id));
  });

  protected readonly filteredWidgets = computed<WidgetListItem[]>(() => {
    const query = this.searchText().trim().toLowerCase();
    const list = this.unplacedWidgets();
    if (!query) return list;
    return list.filter((w) => w.name.toLowerCase().includes(query));
  });

  protected readonly selectedWidget = computed<WidgetListItem | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.filteredWidgets().find((w) => w.id === id) ?? null;
  });

  protected readonly activeRowIndex = computed(() => {
    const list = this.filteredWidgets();
    const id = this.selectedId();
    if (id) {
      const idx = list.findIndex((w) => w.id === id);
      if (idx !== -1) return idx;
    }
    return 0;
  });

  protected readonly vizSizeMap = computed<ReadonlyMap<TradeViz, Size>>(() => {
    const map = new Map<TradeViz, Size>();
    for (const viz of this.catalog()?.visualizations ?? []) {
      map.set(viz.type, vizDefaultSize(viz));
    }
    return map;
  });

  protected readonly selectedTypeLabel = computed(() => {
    this.i18n();
    this.modalScope();
    const sel = this.selectedWidget();
    if (!sel) return '';
    return this.transloco.translate(`tradeDashboardModals.viz.${sel.visualizationType}`);
  });

  protected readonly selectedSizeLabel = computed(() => {
    const sel = this.selectedWidget();
    if (!sel) return '';
    const size = this.vizSizeMap().get(sel.visualizationType);
    return size ? `${size.w} \u00d7 ${size.h}` : '—';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.loadSeq++;
      this.idempotencyKeys.clear();
    });
  }

  open(detail: DashboardDetail): void {
    this.dashboardId = detail.id;
    this.dashboardName.set(detail.name);
    this.placedIds.set(new Set(detail.placements.map((p) => p.widgetId)));
    this.searchText.set('');
    this.allWidgets.set([]);
    this.selectedId.set(null);
    this.loadFailed.set(false);
    this.submitting.set(false);
    this.idempotencyKeys.clear();

    this.modal().open();
    void this.fetchWidgets();
  }

  protected vizIcon(type: TradeViz): string {
    return VIZ_ICON[type];
  }

  protected defaultSizeOf(type: TradeViz): Size | null {
    return this.vizSizeMap().get(type) ?? null;
  }

  protected onSearchInput(value: string): void {
    this.searchText.set(value);
  }

  protected clearSearch(): void {
    this.searchText.set('');
  }

  protected selectWidget(widget: WidgetListItem): void {
    this.selectedId.set(widget.id);
  }

  protected onRowKeydown(event: KeyboardEvent, index: number): void {
    const list = this.filteredWidgets();
    if (list.length === 0) return;

    let nextIndex = -1;
    if (event.key === 'ArrowDown') {
      nextIndex = (index + 1) % list.length;
    } else if (event.key === 'ArrowUp') {
      nextIndex = (index - 1 + list.length) % list.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = list.length - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = list[index];
      if (item) this.selectWidget(item);
      return;
    } else {
      return;
    }

    event.preventDefault();
    const target = list[nextIndex];
    if (!target) return;
    this.selectWidget(target);
    this.rowButtons()[nextIndex]?.nativeElement.focus();
  }

  protected retryLoad(): void {
    void this.fetchWidgets();
  }

  protected cancel(): void {
    if (this.submitting()) return;
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.loadSeq++;
    this.submitting.set(false);
    this.idempotencyKeys.clear();
  }

  protected async submit(): Promise<void> {
    const sel = this.selectedWidget();
    if (!sel || this.submitting()) return;

    const seq = this.loadSeq;
    const dashboardId = this.dashboardId;
    let key = this.idempotencyKeys.get(sel.id);
    if (!key) {
      key = newIdempotencyKey();
      this.idempotencyKeys.set(sel.id, key);
    }

    this.submitting.set(true);
    try {
      const res = await addPlacement(this.ctx(), dashboardId, { widgetId: sel.id }, key);
      if (seq !== this.loadSeq || dashboardId !== this.dashboardId) return;
      this.added.emit({
        placementId: res.placementId,
        widgetId: res.widgetId,
        dashboardRevision: res.dashboardRevision,
      });
      this.modal().close();
    } catch (error) {
      if (seq !== this.loadSeq || dashboardId !== this.dashboardId) return;
      if (isForbiddenError(error)) {
        this.modal().close();
        this.forbidden.emit();
        return;
      }
      const code = errorCodeOf(error);
      if (code === 'GW.IDEM.MISMATCH' || code === 'TRADE.IDEMPOTENCY.MISMATCH') {
        this.idempotencyKeys.delete(sel.id);
      }
      if (code === 'TRADE.DASHBOARD.LIMIT_EXCEEDED') {
        this.notify.error(this.transloco.translate('tradeDashboardModals.library.limitExceeded'));
      } else {
        this.notify.error(this.transloco.translate(errorKey(error)));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.submitting.set(false);
      }
    }
  }

  private async fetchWidgets(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const list = await listWidgets(this.ctx());
      if (seq !== this.loadSeq) return;
      this.allWidgets.set(list.items);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (isForbiddenError(error)) {
        this.modal().close();
        this.forbidden.emit();
        return;
      }
      this.loadFailed.set(true);
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
