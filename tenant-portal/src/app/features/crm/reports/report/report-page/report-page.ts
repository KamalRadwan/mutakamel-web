import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCalendarTime,
  tablerChartBar,
  tablerDatabase,
  tablerInfoCircle,
  tablerLayoutDashboard,
  tablerPin,
  tablerStar,
  tablerTable,
} from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { ExportMenu } from '../../../../../shared/widgets/dashboard/exports/export-menu/export-menu';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { formatDateTime } from '../../../../../shared/ui/chart/chart-format';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Tabs, tabButtonId, tabPanelId, type TabItem } from '../../../../../shared/ui/tabs/tabs';
import { peekCatalogueReport, setReportFavourite } from '../../catalogue/catalogue.api';
import { AboutTab } from '../about-tab/about-tab';
import { OverviewTab } from '../overview-tab/overview-tab';
import { PinModal } from '../pin-modal/pin-modal';
import { RecordsTab } from '../records-tab/records-tab';
import { ReportFilters } from '../report-filters/report-filters';
import { REPORT_TABS, type ReportTab } from '../report.model';
import { ReportState } from '../report-state';
import { selectScopeTranslation } from '../../../../../shared/widgets/dashboard/scope-translation';
import type { ExportPeriod } from '../../../../../shared/widgets/dashboard/exports/exports.model';

function isReportTab(raw: string | null | undefined): raw is ReportTab {
  return (REPORT_TABS as readonly string[]).includes(raw ?? '');
}

@Component({
  selector: 'app-report-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Button,
    Badge,
    Tabs,
    FullState,
    ExportMenu,
    ReportFilters,
    OverviewTab,
    RecordsTab,
    AboutTab,
    PinModal,
  ],
  providers: [
    ReportState,
    provideTranslocoScope(
      { scope: 'crm-rep-report', alias: 'repReport' },
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'dashboard-widgets', alias: 'dashboardWidgets' },
      { scope: 'chart', alias: 'chart' },
    ),
    provideIcons({
      tablerChartBar,
      tablerLayoutDashboard,
      tablerTable,
      tablerInfoCircle,
      tablerPin,
      tablerCalendarTime,
      tablerStar,
      tablerStarFill,
      tablerDatabase,
    }),
  ],
  templateUrl: './report-page.html',
  host: { class: 'flex flex-1 min-w-0 flex-col gap-10 p-12' },
})
export class ReportPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);
  private readonly reportScope = toSignal(selectScopeTranslation(this.transloco, 'crm-rep-report', 'repReport'));
  private readonly chartScope = toSignal(this.transloco.selectTranslation('chart'));
  private readonly paramMap = toSignal(this.route.paramMap);
  private readonly pinModal = viewChild.required(PinModal);

  protected readonly state = inject(ReportState);
  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;
  protected readonly favourite = signal(false);
  protected readonly skeletonItems = [0, 1, 2, 3] as const;

  private lastLoadedLang: 'ar' | 'en' | null = null;

  protected readonly routeKey = computed(() => this.paramMap()?.get('key') ?? '');
  protected readonly routeTab = computed(() => this.paramMap()?.get('tab') ?? '');

  protected readonly activeTab = computed<ReportTab>(() => {
    const raw = this.routeTab();
    if (!isReportTab(raw)) return 'overview';
    if (raw === 'records' && this.state.manifest() && !this.state.hasPageablePanels()) {
      return 'overview';
    }
    return raw;
  });

  protected readonly reportTitle = computed(() => {
    const manifest = this.state.manifest();
    const key = this.routeKey();
    const report = manifest?.report ?? peekCatalogueReport(key);
    if (!report) return key;
    return this.language() === 'ar' ? report.title.ar : report.title.en;
  });

  protected readonly domain = computed(
    () => this.state.manifest()?.report?.domain ?? peekCatalogueReport(this.routeKey())?.domain ?? 'pipeline',
  );

  protected readonly dataAsOfText = computed(() => {
    this.i18n();
    this.reportScope();
    this.chartScope();
    const iso = this.state.manifest()?.freshness.dataAsOf;
    if (!iso) return '';
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    const formatted = formatDateTime(iso, lang, chartT);
    const spaceIdx = formatted.lastIndexOf(' ');
    const date = spaceIdx > 0 ? formatted.slice(0, spaceIdx) : formatted;
    const time = spaceIdx > 0 ? formatted.slice(spaceIdx + 1) : '';
    return this.transloco.translate('repReport.dataAsOf', { date, time });
  });

  protected readonly staleTooltip = computed(() => {
    this.i18n();
    this.reportScope();
    this.chartScope();
    const oldest = this.state.manifest()?.freshness.oldestSourceAsOf;
    if (!oldest) return '';
    const lang = this.language();
    const chartT = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`chart.${key}`, params);
    return this.transloco.translate('repReport.staleTip', {
      date: formatDateTime(oldest, lang, chartT),
    });
  });

  protected readonly canPin = computed(
    () => can('crm.dashboards.update') && this.state.pinnablePanels().length > 0,
  );

  protected readonly canSchedule = computed(() => can('crm.subscriptions.manage'));
  protected readonly canExport = computed(() => can('crm.exports.create'));

  /** `ExportPeriodDto` is `{ from, to, kind? }`: the preset name travels as `kind`. */
  protected readonly exportPeriod = computed<ExportPeriod>(() => {
    const manifest = this.state.manifest();
    const req = this.state.request();
    return {
      kind: req.period?.preset ?? manifest?.period.kind ?? 'CURRENT_MONTH',
      from: req.period?.from ?? manifest?.period.from ?? '2026-11-01',
      to: req.period?.to ?? manifest?.period.to ?? '2026-11-21',
    };
  });

  protected readonly exportFilters = computed<Record<string, unknown> | null>(
    () => this.state.request().filters ?? null,
  );

  protected readonly tabs = computed<TabItem[]>(() => {
    this.i18n();
    this.reportScope();
    this.language();
    const items: TabItem[] = [
      {
        id: 'overview',
        label: this.transloco.translate('repReport.tabs.overview'),
        icon: 'tablerLayoutDashboard',
      },
    ];
    if (this.state.hasPageablePanels()) {
      items.push({
        id: 'records',
        label: this.transloco.translate('repReport.tabs.records'),
        icon: 'tablerTable',
      });
    }
    items.push({
      id: 'about',
      label: this.transloco.translate('repReport.tabs.about'),
      icon: 'tablerInfoCircle',
    });
    return items;
  });

  constructor() {
    effect(() => {
      const key = this.routeKey();
      if (!key) return;
      const lang = untracked(() => this.language());
      this.lastLoadedLang = lang;
      untracked(() => {
        this.favourite.set(peekCatalogueReport(key)?.favourite ?? false);
        void this.state.load(key);
      });
    });

    effect(() => {
      const key = this.routeKey();
      const rawTab = this.routeTab();
      const manifest = this.state.manifest();
      const hasPageable = this.state.hasPageablePanels();
      if (!key) return;

      if (!isReportTab(rawTab)) {
        untracked(() => {
          void this.router.navigate(['/crm/reports/catalogue', key, 'overview'], { replaceUrl: true });
        });
        return;
      }

      if (rawTab === 'records' && manifest && !hasPageable) {
        untracked(() => {
          void this.router.navigate(['/crm/reports/catalogue', key, 'overview'], { replaceUrl: true });
        });
      }
    });

    effect(() => {
      const lang = this.language();
      const manifest = untracked(() => this.state.manifest());
      if (!manifest || this.lastLoadedLang === lang) return;
      this.lastLoadedLang = lang;
      untracked(() => {
        void this.state.run();
      });
    });
  }

  protected async toggleFavourite(): Promise<void> {
    const key = this.state.reportKey() || this.routeKey();
    if (!key) return;
    const prev = this.favourite();
    const next = !prev;
    this.favourite.set(next);
    try {
      const res = await setReportFavourite(key, next);
      if ((this.state.reportKey() || this.routeKey()) === key) {
        this.favourite.set(res.favorite);
      }
    } catch (err) {
      if ((this.state.reportKey() || this.routeKey()) === key) {
        this.favourite.set(prev);
      }
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(err))));
    }
  }

  protected onTabChange(nextTab: string): void {
    const key = this.state.reportKey() || this.routeKey();
    if (!key || !isReportTab(nextTab) || nextTab === this.routeTab()) return;
    void this.router.navigate(['/crm/reports/catalogue', key, nextTab]);
  }

  protected openPinModal(panelKey?: string): void {
    const manifest = this.state.manifest();
    if (!manifest) return;
    this.pinModal().open(this.state.reportKey() || this.routeKey(), manifest.panels, panelKey);
  }

  protected goToSchedule(): void {
    const key = this.state.reportKey() || this.routeKey();
    if (!key) return;
    void this.router.navigate(['/crm/reports/schedules'], {
      queryParams: { new: 1, reportKey: key },
    });
  }

  protected openRecordsTab(panelKey: string): void {
    const key = this.state.reportKey() || this.routeKey();
    if (!key) return;
    void this.router.navigate(['/crm/reports/catalogue', key, 'records'], {
      queryParams: { panel: panelKey },
    });
  }

  protected openAboutExplain(panelKey: string): void {
    const key = this.state.reportKey() || this.routeKey();
    if (!key) return;
    void this.router.navigate(['/crm/reports/catalogue', key, 'about'], {
      queryParams: { panel: panelKey },
    });
  }

  protected goToCatalogue(): void {
    void this.router.navigate(['/crm/reports/catalogue']);
  }

  protected retryLoad(): void {
    const key = this.routeKey();
    if (!key) return;
    void this.state.load(key);
  }
}
