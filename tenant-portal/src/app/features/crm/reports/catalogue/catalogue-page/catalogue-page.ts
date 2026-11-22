import { Component, DestroyRef, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowsExchange,
  tablerChartBarOff,
  tablerChecklist,
  tablerCircleCheck,
  tablerCircleX,
  tablerClockCheck,
  tablerFileInvoice,
  tablerLayoutGrid,
  tablerLock,
  tablerMail,
  tablerSearch,
  tablerShieldCheck,
  tablerStar,
  tablerTable,
  tablerTarget,
  tablerTargetArrow,
  tablerTrendingUp,
  tablerUserPlus,
  tablerUsers,
  tablerUsersGroup,
  tablerX,
} from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { DASH } from '../../../../../shared/ui/chart/chart-format';
import { DataCell, DataColumn, DataTable } from '../../../../../shared/ui/data-table/data-table';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { ViewOption, ViewSwitcher } from '../../../../../shared/ui/view-switcher/view-switcher';
import { errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { listCatalogue, listWholeCatalogue, setReportFavourite } from '../catalogue.api';
import {
  CatalogueView,
  REPORT_DOMAINS,
  REPORT_DOMAIN_META,
  ReportCatalogueItem,
  ReportDomain,
  ReportDomainMeta,
  ReportReadiness,
  countByDomain,
  isReportDisabled,
  readinessBadge,
  reportTitleIn,
} from '../catalogue.model';
import { ReportCard } from '../report-card/report-card';

const PAGE_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 200;
const SKELETON_CARDS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

interface DomainSection {
  domain: ReportDomain;
  meta: ReportDomainMeta;
  count: number;
  items: ReportCatalogueItem[];
}

function isTruthyParam(value: string | null): boolean {
  return value === '1' || value === 'true';
}

function emptyCounts(): Record<ReportDomain, number> {
  return Object.fromEntries(REPORT_DOMAINS.map((domain) => [domain, 0])) as Record<ReportDomain, number>;
}

function sumCounts(counts: Record<ReportDomain, number>): number {
  return REPORT_DOMAINS.reduce((sum, domain) => sum + (counts[domain] ?? 0), 0);
}

@Component({
  selector: 'app-catalogue-page',
  imports: [NgIcon, TranslocoPipe, Badge, Button, DataCell, DataTable, FullState, ViewSwitcher, ReportCard],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-rep-catalogue', alias: 'repCatalogue' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({
      tablerSearch,
      tablerX,
      tablerCircleX,
      tablerStar,
      tablerStarFill,
      tablerCircleCheck,
      tablerLayoutGrid,
      tablerTable,
      tablerChartBarOff,
      tablerLock,
      tablerTrendingUp,
      tablerArrowsExchange,
      tablerUserPlus,
      tablerTarget,
      tablerClockCheck,
      tablerChecklist,
      tablerUsersGroup,
      tablerTargetArrow,
      tablerUsers,
      tablerFileInvoice,
      tablerMail,
      tablerShieldCheck,
    }),
  ],
  templateUrl: './catalogue-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-12 p-12' },
})
export class CataloguePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private loadSeq = 0;

  protected readonly domains = REPORT_DOMAINS;
  protected readonly skeletonCards = SKELETON_CARDS;
  protected readonly dash = DASH;

  protected readonly urlQuery = computed(() => this.queryParams()?.get('q') ?? '');
  protected readonly searchInput = linkedSignal(() => this.urlQuery());
  protected readonly selectedDomain = computed<ReportDomain | null>(() => {
    const raw = this.queryParams()?.get('domain');
    return raw && (REPORT_DOMAINS as readonly string[]).includes(raw) ? (raw as ReportDomain) : null;
  });
  protected readonly favouritesOnly = computed(() => isTruthyParam(this.queryParams()?.get('fav') ?? null));
  protected readonly availableOnly = computed(() => isTruthyParam(this.queryParams()?.get('available') ?? null));
  protected readonly view = computed<CatalogueView>(() =>
    this.queryParams()?.get('view') === 'table' ? 'table' : 'cards',
  );

  protected readonly items = signal<ReportCatalogueItem[]>([]);
  protected readonly counts = signal<Record<ReportDomain, number>>(emptyCounts());
  protected readonly favouriteCount = signal(0);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly loadErrorKey = signal<string | null>(null);
  protected readonly searchErrorKey = signal<string | null>(null);
  protected readonly togglingKeys = signal<ReadonlySet<string>>(new Set());
  private readonly reloadTick = signal(0);

  protected readonly totalCount = computed(() => sumCounts(this.counts()));

  protected readonly viewOptions = computed<ViewOption[]>(() => {
    this.i18n();
    return [
      { id: 'cards', icon: 'tablerLayoutGrid', label: this.transloco.translate('repCatalogue.cards') },
      { id: 'table', icon: 'tablerTable', label: this.transloco.translate('repCatalogue.table') },
    ];
  });

  protected readonly tableColumns = computed<DataColumn[]>(() => {
    this.i18n();
    return [
      { key: 'code', label: this.transloco.translate('repCatalogue.code'), width: 0.7 },
      { key: 'report', label: this.transloco.translate('repCatalogue.report'), width: 3.2 },
      { key: 'domain', label: this.transloco.translate('repCatalogue.domain'), width: 1.6 },
      { key: 'basis', label: this.transloco.translate('repCatalogue.basis'), width: 1.2 },
      { key: 'readiness', label: this.transloco.translate('repCatalogue.readiness'), width: 1.2 },
      { key: 'favourite', label: this.transloco.translate('repCatalogue.favouriteCol'), width: 0.9 },
      { key: 'pinned', label: this.transloco.translate('repCatalogue.pinned'), width: 0.8, align: 'end' },
    ];
  });

  protected readonly groupedSections = computed<DomainSection[]>(() => {
    const byDomain = new Map<ReportDomain, ReportCatalogueItem[]>();
    for (const item of this.items()) {
      const list = byDomain.get(item.domain);
      if (list) {
        list.push(item);
      } else {
        byDomain.set(item.domain, [item]);
      }
    }

    const currentCounts = this.counts();
    const sections: DomainSection[] = [];
    for (const domain of REPORT_DOMAINS) {
      const list = byDomain.get(domain);
      if (!list?.length) continue;
      sections.push({
        domain,
        meta: REPORT_DOMAIN_META[domain],
        count: currentCounts[domain] || list.length,
        items: list,
      });
    }
    return sections;
  });

  protected readonly reportRowKey = (row: ReportCatalogueItem) => row.reportKey;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
      }
    });

    effect(() => {
      const q = this.urlQuery();
      const domain = this.selectedDomain();
      const fav = this.favouritesOnly();
      const avail = this.availableOnly();
      this.reloadTick();

      untracked(() => {
        void this.loadCatalogue(q, domain, fav, avail);
      });
    });
  }

  protected onSearchInput(value: string): void {
    this.searchInput.set(value);
    if (value.length <= 120 && this.searchErrorKey()) {
      this.searchErrorKey.set(null);
    }
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.updateQueryParams({ q: value || null }, true);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected onSearchEnter(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    const value = this.searchInput();
    if (value !== this.urlQuery()) {
      this.updateQueryParams({ q: value || null }, true);
    }
  }

  protected clearSearch(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.searchInput.set('');
    this.searchErrorKey.set(null);
    if (this.urlQuery()) {
      this.updateQueryParams({ q: null }, true);
    }
  }

  protected toggleFavourites(): void {
    this.updateQueryParams({ fav: this.favouritesOnly() ? null : '1' });
  }

  protected toggleAvailable(): void {
    this.updateQueryParams({ available: this.availableOnly() ? null : '1' });
  }

  protected setView(nextView: string): void {
    const normalized: CatalogueView = nextView === 'table' ? 'table' : 'cards';
    if (normalized === this.view()) return;
    this.updateQueryParams({ view: normalized === 'cards' ? null : 'table' });
  }

  protected selectDomain(domain: ReportDomain | null): void {
    if (domain === this.selectedDomain()) return;
    this.updateQueryParams({ domain });
  }

  protected retry(): void {
    this.reloadTick.update((tick) => tick + 1);
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore() || this.loading()) return;

    const seq = this.loadSeq;
    this.loadingMore.set(true);
    try {
      const page = await listCatalogue({
        domain: this.selectedDomain() ?? undefined,
        q: this.urlQuery() || undefined,
        favourite: this.favouritesOnly() || undefined,
        availableOnly: this.availableOnly() || undefined,
        cursor,
        limit: PAGE_LIMIT,
      });
      if (seq !== this.loadSeq) return;
      this.items.update((prev) => [...prev, ...page.items]);
      this.nextCursor.set(page.pageInfo.nextCursor);
      this.hasMore.set(page.pageInfo.hasMore);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      if (seq === this.loadSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  protected openReport(report: ReportCatalogueItem): void {
    if (isReportDisabled(report.readiness)) return;
    void this.router.navigate(['/crm/reports/catalogue', report.reportKey, 'overview']);
  }

  protected onTableStarClick(event: MouseEvent, report: ReportCatalogueItem): void {
    event.stopPropagation();
    void this.toggleFavourite(report);
  }

  protected async toggleFavourite(report: ReportCatalogueItem): Promise<void> {
    if (isReportDisabled(report.readiness) || this.isToggling(report.reportKey)) return;

    const seq = this.loadSeq;
    const nextFav = !report.favourite;
    const prevItems = this.items();
    const prevCounts = this.counts();
    const prevFavCount = this.favouriteCount();
    const favFilterActive = this.favouritesOnly();

    this.setToggling(report.reportKey, true);
    this.favouriteCount.set(Math.max(0, prevFavCount + (nextFav ? 1 : -1)));

    if (favFilterActive && !nextFav) {
      this.items.set(prevItems.filter((entry) => entry.reportKey !== report.reportKey));
      this.counts.set({
        ...prevCounts,
        [report.domain]: Math.max(0, (prevCounts[report.domain] ?? 0) - 1),
      });
    } else {
      this.items.set(
        prevItems.map((entry) => (entry.reportKey === report.reportKey ? { ...entry, favourite: nextFav } : entry)),
      );
    }

    try {
      const result = await setReportFavourite(report.reportKey, nextFav);
      if (seq !== this.loadSeq) return;
      this.items.update((current) =>
        current.map((entry) =>
          entry.reportKey === report.reportKey
            ? { ...entry, favourite: result.favorite, dashboardId: result.dashboardId }
            : entry,
        ),
      );
    } catch (error) {
      if (seq === this.loadSeq) {
        this.items.set(prevItems);
        this.counts.set(prevCounts);
        this.favouriteCount.set(prevFavCount);
      }
      this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
    } finally {
      this.setToggling(report.reportKey, false);
    }
  }

  protected isToggling(reportKey: string): boolean {
    return this.togglingKeys().has(reportKey);
  }

  protected isDisabled(readiness: ReportReadiness): boolean {
    return isReportDisabled(readiness);
  }

  protected domainMeta(domain: ReportDomain): ReportDomainMeta {
    return REPORT_DOMAIN_META[domain];
  }

  protected badgeFor(readiness: ReportReadiness) {
    return readinessBadge(readiness);
  }

  protected reportTitle(report: ReportCatalogueItem): string {
    return reportTitleIn(report, this.language());
  }

  private async loadCatalogue(
    q: string,
    domain: ReportDomain | null,
    favourite: boolean,
    availableOnly: boolean,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadErrorKey.set(null);
    if (q.length <= 120) {
      this.searchErrorKey.set(null);
    }

    try {
      // Per-domain counts come from the whole catalogue for the same search (lead decision: no counts endpoint).
      const [page, whole] = await Promise.all([
        listCatalogue({
          domain: domain ?? undefined,
          q: q || undefined,
          favourite: favourite || undefined,
          availableOnly: availableOnly || undefined,
          cursor: null,
          limit: PAGE_LIMIT,
        }),
        listWholeCatalogue({
          q: q || undefined,
          availableOnly: availableOnly || undefined,
        }),
      ]);

      if (seq !== this.loadSeq) return;
      const favourites = whole.filter((item) => item.favourite);
      this.items.set(page.items);
      this.counts.set(countByDomain(favourite ? favourites : whole));
      this.favouriteCount.set(favourites.length);
      this.nextCursor.set(page.pageInfo.nextCursor);
      this.hasMore.set(page.pageInfo.hasMore);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      const code = errorCodeOf(error);
      if (code === 'CRM_VALIDATION_FAILED') {
        this.searchErrorKey.set('repCatalogue.searchTooLong');
      } else {
        this.loadErrorKey.set(errorKey(code));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private setToggling(reportKey: string, busy: boolean): void {
    this.togglingKeys.update((prev) => {
      const next = new Set(prev);
      if (busy) {
        next.add(reportKey);
      } else {
        next.delete(reportKey);
      }
      return next;
    });
  }

  private updateQueryParams(patch: Record<string, string | null>, replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patch,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
}
