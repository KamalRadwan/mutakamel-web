import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Badge, type BadgeTone } from '../../../../shared/ui/badge/badge';
import { DASH, formatDateTime, formatNumber } from '../../../../shared/ui/chart/chart-format';
import { DataCell, DataColumn, DataSort, DataTable } from '../../../../shared/ui/data-table/data-table';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { listReadiness } from './readiness.api';
import type { SourceReadiness } from '../../../../shared/widgets/dashboard/analytics.model';
import { readinessError } from './readiness-error';
import { tenantWide } from '../shared/settings-access';
import { readinessReasonKey } from './readiness-reasons';
import { ReadinessModal } from './readiness-modal/readiness-modal';

const STATUS_ORDER: readonly SourceReadiness['status'][] = [
  'READY',
  'EXPERIMENTAL',
  'NOT_READY',
  'SETUP_INCOMPLETE',
  'DISCONNECTED',
  'DEFERRED',
];

const KNOWN_FAMILIES = new Set([
  'CRM_CURRENT',
  'CRM_HISTORY',
  'CRM_CONFIG',
  'CORE',
  'TRADE',
  'FINANCE',
  'MARKETING',
  'HR',
  'WORKFLOW',
  'EMAIL',
  'CONTRACTS',
  'RECOMMENDATIONS',
  'PLATFORM',
]);

const FAMILY_ORDER = [
  'CRM_CURRENT',
  'CRM_HISTORY',
  'CRM_CONFIG',
  'CORE',
  'TRADE',
  'FINANCE',
  'MARKETING',
  'HR',
  'WORKFLOW',
  'EMAIL',
  'CONTRACTS',
  'RECOMMENDATIONS',
  'PLATFORM',
  'OTHER',
] as const;

function normalizeFamily(family: string): string {
  return KNOWN_FAMILIES.has(family) ? family : 'OTHER';
}

function compareNullableNumber(a: number | null, b: number | null, dir: 'asc' | 'desc'): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === 'asc' ? a - b : b - a;
}

function compareNullableDate(a: string | null, b: string | null, dir: 'asc' | 'desc'): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return dir === 'asc' ? a.localeCompare(b, 'en') : b.localeCompare(a, 'en');
}

@Component({
  selector: 'app-data-readiness-page',
  imports: [TranslocoPipe, Badge, DataTable, DataCell, Field, FullState, SettingsFrame, ReadinessModal],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'settings-data-readiness', alias: 'readiness' },
    ),
  ],
  templateUrl: './data-readiness-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class DataReadinessPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly readinessModal = viewChild<ReadinessModal>('readinessModal');
  private readonly queryParams = toSignal(this.route.queryParamMap);

  protected readonly canView = tenantWide('crm.analytics.readiness.view');
  protected readonly accessDenied = signal(false);
  private readonly correlationId = signal<string | null>(null);
  protected readonly loadFailureText = computed(() => {
    this.i18n();
    const message = this.transloco.translate('analytics.common.loadFailed');
    const id = this.correlationId();
    return id ? `${message} ${this.transloco.translate('settings.common.correlationId', { id })}` : message;
  });
  protected readonly statuses = STATUS_ORDER;

  protected readonly items = signal<SourceReadiness[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadedOnce = signal(false);
  protected readonly loadError = signal(false);
  protected readonly search = signal('');
  protected readonly selectedStatus = signal<SourceReadiness['status'] | null>(null);
  protected readonly selectedFamily = signal<string | null>(null);
  protected readonly sort = signal<DataSort | null>({ key: 'sourceKey', dir: 'asc' });

  private loadSeq = 0;
  private activeSourceKey: string | null = null;

  protected readonly rowKey = (row: SourceReadiness): string => row.sourceKey;

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    return [
      { key: 'sourceKey', label: this.transloco.translate('readiness.table.source'), width: 1.9, sortable: true },
      { key: 'sourceFamily', label: this.transloco.translate('readiness.table.family'), width: 1.2, sortable: true },
      { key: 'ownerModule', label: this.transloco.translate('readiness.table.ownerModule'), width: 0.9, sortable: true },
      { key: 'status', label: this.transloco.translate('readiness.table.status'), width: 1.2, sortable: true },
      { key: 'reasonCode', label: this.transloco.translate('readiness.table.reason'), width: 1.9 },
      { key: 'lagSeconds', label: this.transloco.translate('readiness.table.freshness'), width: 1.5, sortable: true },
      {
        key: 'affectedReportCount',
        label: this.transloco.translate('readiness.table.affectedReports'),
        width: 0.9,
        align: 'end',
        sortable: true,
      },
      { key: 'lastCheckedAt', label: this.transloco.translate('readiness.table.lastChecked'), width: 1.3, sortable: true },
    ];
  });

  private readonly searchMatched = computed(() => {
    this.i18n();
    const lang = this.language();
    const term = this.search().trim().toLocaleLowerCase(lang);
    const all = this.items();
    if (!term) return all;
    return all.filter((row) => {
      const familyLabel = this.familyLabel(row.sourceFamily).toLocaleLowerCase(lang);
      return (
        row.sourceKey.toLowerCase().includes(term) ||
        row.sourceFamily.toLowerCase().includes(term) ||
        familyLabel.includes(term)
      );
    });
  });

  protected readonly statusCounts = computed(() => {
    const family = this.selectedFamily();
    const pool = family ? this.searchMatched().filter((row) => normalizeFamily(row.sourceFamily) === family) : this.searchMatched();
    const counts: Record<SourceReadiness['status'], number> = {
      READY: 0,
      EXPERIMENTAL: 0,
      NOT_READY: 0,
      SETUP_INCOMPLETE: 0,
      DISCONNECTED: 0,
      DEFERRED: 0,
    };
    for (const row of pool) {
      counts[row.status]++;
    }
    return { total: pool.length, byStatus: counts };
  });

  protected readonly availableFamilies = computed(() => {
    const present = new Set<string>(this.items().map((row) => normalizeFamily(row.sourceFamily)));
    const ordered: string[] = FAMILY_ORDER.filter((key) => present.has(key));
    for (const key of present) {
      if (!ordered.includes(key)) ordered.push(key);
    }
    return ordered;
  });

  protected readonly familyCounts = computed(() => {
    const status = this.selectedStatus();
    const pool = status ? this.searchMatched().filter((row) => row.status === status) : this.searchMatched();
    const counts: Record<string, number> = {};
    for (const row of pool) {
      const key = normalizeFamily(row.sourceFamily);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return { total: pool.length, byFamily: counts };
  });

  protected readonly visibleRows = computed(() => {
    this.i18n();
    const lang = this.language();
    const status = this.selectedStatus();
    const family = this.selectedFamily();
    const currentSort = this.sort();

    const filtered = this.searchMatched().filter(
      (row) =>
        (status === null || row.status === status) &&
        (family === null || normalizeFamily(row.sourceFamily) === family),
    );

    return [...filtered].sort((a, b) => {
      if (currentSort) {
        const dir = currentSort.dir;
        const mult = dir === 'asc' ? 1 : -1;
        let cmp = 0;
        switch (currentSort.key) {
          case 'sourceKey':
            cmp = mult * a.sourceKey.localeCompare(b.sourceKey, 'en');
            break;
          case 'sourceFamily':
            cmp = mult * this.familyLabel(a.sourceFamily).localeCompare(this.familyLabel(b.sourceFamily), lang);
            break;
          case 'ownerModule':
            cmp = mult * a.ownerModule.localeCompare(b.ownerModule, 'en');
            break;
          case 'status':
            cmp = mult * this.uiStateLabel(a.uiState).localeCompare(this.uiStateLabel(b.uiState), lang);
            break;
          case 'lagSeconds':
            cmp = compareNullableNumber(a.lagSeconds, b.lagSeconds, dir);
            break;
          case 'affectedReportCount':
            cmp = mult * (a.affectedReportCount - b.affectedReportCount);
            break;
          case 'lastCheckedAt':
            cmp = compareNullableDate(a.lastCheckedAt, b.lastCheckedAt, dir);
            break;
        }
        if (cmp !== 0) return cmp;
      }
      return a.sourceKey.localeCompare(b.sourceKey, 'en');
    });
  });

  protected readonly emptyText = computed(() => {
    this.i18n();
    if (!this.loadedOnce()) return '';
    return this.items().length === 0
      ? this.transloco.translate('readiness.empty')
      : this.transloco.translate('readiness.noMatches');
  });

  constructor() {
    if (this.canView) {
      void this.reload();

      effect(() => {
        const sourceParam = this.queryParams()?.get('source')?.trim() || null;
        const modal = this.readinessModal();
        if (!modal) return;
        untracked(() => {
          if (sourceParam && sourceParam !== this.activeSourceKey) {
            this.activeSourceKey = sourceParam;
            modal.open(sourceParam);
          } else if (!sourceParam && this.activeSourceKey !== null) {
            this.activeSourceKey = null;
            modal.close();
          }
        });
      });
    }
  }

  protected async reload(): Promise<void> {
    if (!this.canView || this.loading()) return;
    const seq = ++this.loadSeq;
    this.loading.set(true);
    if (!this.loadedOnce()) {
      this.loadError.set(false);
    }
    try {
      const response = await listReadiness();
      if (seq !== this.loadSeq) return;
      this.items.set(response.items);
      const family = this.selectedFamily();
      if (family && !response.items.some((row) => normalizeFamily(row.sourceFamily) === family)) {
        this.selectedFamily.set(null);
      }
      this.loadedOnce.set(true);
      this.loadError.set(false);
      this.correlationId.set(null);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      const failure = readinessError(this.transloco, error);
      if (failure.kind === 'forbidden') {
        this.accessDenied.set(true);
        this.loadError.set(false);
      } else if (!this.loadedOnce()) {
        this.loadError.set(true);
        this.correlationId.set(failure.correlationId);
      } else {
        this.notify.error(failure.message);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected selectStatus(status: SourceReadiness['status'] | null): void {
    this.selectedStatus.set(status);
  }

  protected selectFamily(family: string | null): void {
    this.selectedFamily.set(family);
  }

  protected openSource(sourceKey: string): void {
    if (!this.canView || this.accessDenied()) return;
    this.activeSourceKey = sourceKey;
    this.readinessModal()?.open(sourceKey);
    if (this.queryParams()?.get('source') !== sourceKey) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { source: sourceKey },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected onModalClosed(): void {
    this.activeSourceKey = null;
    if (this.queryParams()?.has('source')) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { source: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/');
  }

  protected onChipKeydown(event: KeyboardEvent): void {
    const current = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('button[role="radio"]');
    const group = event.currentTarget as HTMLElement;
    if (!current || !group) return;

    const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button[role="radio"]'));
    const index = buttons.indexOf(current);
    if (index === -1 || buttons.length === 0) return;

    const rtl = getComputedStyle(group).direction === 'rtl';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    let nextIndex = -1;
    if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = buttons.length - 1;
    } else if (event.key === nextKey || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % buttons.length;
    } else if (event.key === prevKey || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + buttons.length) % buttons.length;
    }

    if (nextIndex === -1) return;
    event.preventDefault();
    const target = buttons[nextIndex];
    target.focus();
    target.click();
  }

  protected familyTranslationKey(family: string): string {
    return `readiness.family.${normalizeFamily(family)}`;
  }

  protected uiStateTone(uiState: SourceReadiness['uiState']): BadgeTone {
    switch (uiState) {
      case 'AVAILABLE':
        return 'success';
      case 'EXPERIMENTAL':
      case 'SETUP_INCOMPLETE':
        return 'warning';
      case 'NOT_CONNECTED':
      default:
        return 'none';
    }
  }

  protected reasonText(code: string | null): string {
    if (!code) return DASH;
    return this.transloco.translate(readinessReasonKey(code));
  }

  protected formatFreshness(lagSeconds: number | null): string {
    if (lagSeconds === null) return DASH;
    const lang = this.language();
    const plural = new Intl.PluralRules(lang);
    if (lagSeconds > 0 && lagSeconds < 60) {
      return this.transloco.translate(`readiness.behindSeconds.${plural.select(lagSeconds)}`, {
        n: formatNumber(lagSeconds, lang, 0),
      });
    }
    const minutes = Math.round(lagSeconds / 60);
    return this.transloco.translate(`readiness.behind.${plural.select(minutes)}`, {
      n: formatNumber(minutes, lang, 0),
    });
  }

  protected formatCount(value: number): string {
    return formatNumber(value, this.language(), 0);
  }

  protected formatLastChecked(iso: string | null): string {
    return iso ? formatDateTime(iso, this.language()) : DASH;
  }

  private familyLabel(family: string): string {
    return this.transloco.translate(this.familyTranslationKey(family));
  }

  private uiStateLabel(uiState: SourceReadiness['uiState']): string {
    return this.transloco.translate(`analytics.readinessUi.${uiState}`);
  }
}
