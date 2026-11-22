import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerDatabase,
  tablerExclamationCircle,
  tablerHelpCircle,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import {
  endOfMonth,
  endOfQuarter,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { Badge, type BadgeTone } from '../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../shared/ui/button/button';
import { DASH, formatDate, formatDateTime } from '../../../../../shared/ui/chart/chart-format';
import { DataCell, type DataColumn, DataTable } from '../../../../../shared/ui/data-table/data-table';
import { formatLocalDate, parseLocalDate } from '../../../../../shared/ui/date-range/date-range-presets';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { rectInPage, viewport } from '../../../../../shared/ui/overlay/zoom';
import { listReadiness } from '../../../../../shared/widgets/dashboard/analytics.api';
import type {
  DashboardRun,
  DatePreset,
  SourceReadiness,
} from '../../../../../shared/widgets/dashboard/analytics.model';
import { FAKE_NOW, errorCodeOf } from '../../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { FAKE_BRANCHES } from '../../../../../shared/widgets/dashboard/fake/fake-org';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';
import { getScopeInspector } from '../dashboards.api';
import type { ScopeInspector } from '../dashboards.model';

interface WhySourceRow {
  resource: string;
  sourceLabel: string;
  accessText: string;
  statusTone: BadgeTone;
  statusText: string;
}

const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

function resolveRunPeriodDates(run: DashboardRun | null): { from: string; to: string } | null {
  if (!run) return null;
  for (const exec of Object.values(run.widgets)) {
    if (exec.meta.effectivePeriod?.from && exec.meta.effectivePeriod?.to) {
      return {
        from: exec.meta.effectivePeriod.from,
        to: exec.meta.effectivePeriod.to,
      };
    }
  }
  const { datePreset, dateFrom, dateTo } = run.filters;
  if (dateFrom && dateTo) {
    return { from: dateFrom, to: dateTo };
  }
  if (!datePreset || datePreset === 'CUSTOM') return null;

  const anchor = parseLocalDate(FAKE_NOW) ?? new Date(2026, 10, 21);
  const bounds = presetDates(datePreset, anchor);
  return bounds ? { from: formatLocalDate(bounds.from), to: formatLocalDate(bounds.to) } : null;
}

function presetDates(preset: DatePreset, anchor: Date): { from: Date; to: Date } | null {
  switch (preset) {
    case 'TODAY':
      return { from: anchor, to: anchor };
    case 'CURRENT_WEEK':
      return { from: startOfWeek(anchor, { weekStartsOn: 0 }), to: anchor };
    case 'CURRENT_MONTH':
      return { from: startOfMonth(anchor), to: anchor };
    case 'CURRENT_QUARTER':
      return { from: startOfQuarter(anchor), to: anchor };
    case 'CURRENT_YEAR':
      return { from: new Date(anchor.getFullYear(), 0, 1), to: anchor };
    case 'LAST_MONTH': {
      const prev = subMonths(anchor, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case 'LAST_3_COMPLETE_MONTHS':
      return { from: startOfMonth(subMonths(anchor, 3)), to: endOfMonth(subMonths(anchor, 1)) };
    case 'LAST_QUARTER': {
      const prev = subMonths(anchor, 3);
      return { from: startOfQuarter(prev), to: endOfQuarter(prev) };
    }
    case 'LAST_YEAR': {
      const prev = subYears(anchor, 1);
      return { from: new Date(prev.getFullYear(), 0, 1), to: new Date(prev.getFullYear(), 11, 31) };
    }
    case 'LAST_7_DAYS':
      return { from: subDays(anchor, 6), to: anchor };
    case 'LAST_30_DAYS':
      return { from: subDays(anchor, 29), to: anchor };
    case 'LAST_90_DAYS':
      return { from: subDays(anchor, 89), to: anchor };
    default:
      return null;
  }
}

function matchReadiness(
  resource: string,
  list: readonly SourceReadiness[],
): SourceReadiness | undefined {
  return (
    list.find(
      (item) =>
        item.sourceKey.startsWith(`crm.${resource}.`) ||
        item.sourceKey === `crm.${resource}` ||
        item.ownerModule === resource,
    ) ?? undefined
  );
}

@Component({
  selector: 'app-why-numbers-modal',
  imports: [NgIcon, TranslocoPipe, Badge, Button, DataCell, DataTable, Modal],
  providers: [
    provideTranslocoScope(
      { scope: 'crm-dash-filters', alias: 'dashFilters' },
      { scope: 'analytics', alias: 'analytics' },
    ),
    provideIcons({ tablerDatabase, tablerExclamationCircle, tablerHelpCircle }),
  ],
  templateUrl: './why-numbers-modal.html',
})
export class WhyNumbersModal {
  private static nextId = 0;
  protected readonly uid = `why-modal-${++WhyNumbersModal.nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly loading = signal(false);
  protected readonly inspector = signal<ScopeInspector | null>(null);
  protected readonly readiness = signal<SourceReadiness[]>([]);
  protected readonly activeRun = signal<DashboardRun | null>(null);
  protected readonly activeTip = signal<string | null>(null);
  protected readonly tipPlace = signal({ top: 0, start: 0 });
  private loadSeq = 0;

  protected readonly canViewReadiness = computed(() => can('crm.analytics.readiness.view'));

  protected readonly accessBadgeText = computed(() => {
    this.i18n();
    this.language();
    const insp = this.inspector();
    if (!insp) return DASH;
    return this.transloco.translate(`analytics.access.${insp.effectiveLevel}`);
  });

  protected readonly capReasonText = computed(() => {
    this.i18n();
    this.language();
    const reason = this.inspector()?.capReason;
    if (!reason) return null;
    return this.transloco.translate(`dashFilters.capReason.${reason}`);
  });

  protected readonly companyBranchText = computed(() => {
    const lang = this.language();
    const company = this.scope.company();
    const branch = this.scope.branch();
    const cName = lang === 'ar' ? company.nameAr : company.nameEn;
    const bName = lang === 'ar' ? branch.nameAr : branch.nameEn;
    return `${cName} · ${bName}`;
  });

  protected readonly recordsCountedText = computed(() => {
    this.i18n();
    const lang = this.language();
    const insp = this.inspector();
    if (!insp) return DASH;

    const ownerText = this.transloco.translate(`analytics.scope.${insp.ownerMode.toLowerCase()}`);
    if (insp.branches === 'ALL' || insp.branches.length === 0) {
      return `${ownerText} · ${this.transloco.translate('dashFilters.allBranches')}`;
    }

    const branchMap = new Map<string, string>();
    for (const b of FAKE_BRANCHES) {
      branchMap.set(b.id, lang === 'ar' ? b.name.ar : b.name.en);
    }
    for (const c of this.scope.companies()) {
      for (const b of c.branches) {
        if (!branchMap.has(b.id)) {
          branchMap.set(b.id, lang === 'ar' ? b.nameAr : b.nameEn);
        }
      }
    }
    const separator = lang === 'ar' ? '، ' : ', ';
    const names = insp.branches.map((id) => branchMap.get(id) ?? id).join(separator);
    return `${ownerText} · ${names}`;
  });

  protected readonly periodText = computed(() => {
    this.i18n();
    const lang = this.language();
    const bounds = resolveRunPeriodDates(this.activeRun());
    if (!bounds) return DASH;
    return `${formatDate(bounds.from, lang)} – ${formatDate(bounds.to, lang)}`;
  });

  protected readonly dataAsOfText = computed(() => {
    this.i18n();
    const lang = this.language();
    const generatedAt = this.activeRun()?.generatedAt;
    if (!generatedAt) return DASH;
    return formatDateTime(generatedAt, lang);
  });

  protected readonly sourceColumns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    return [
      { key: 'sourceLabel', label: this.transloco.translate('dashFilters.source'), width: 1.4 },
      { key: 'accessText', label: this.transloco.translate('dashFilters.access'), width: 1 },
      { key: 'statusText', label: this.transloco.translate('dashFilters.status'), width: 1 },
    ];
  });

  protected readonly sourceRows = computed<WhySourceRow[]>(() => {
    this.i18n();
    this.language();
    const insp = this.inspector();
    if (!insp) return [];
    const readinessList = this.readiness();

    return insp.sources.map((src) => {
      const resourceKey = `dashFilters.resource.${src.resource}`;
      const translatedResource = this.transloco.translate(resourceKey);
      const sourceLabel =
        translatedResource && translatedResource !== resourceKey ? translatedResource : src.resource;

      const accessText =
        src.granted && src.scope
          ? this.transloco.translate(`analytics.scope.${src.scope}`)
          : this.transloco.translate('dashFilters.noAccess');

      const matched = matchReadiness(src.resource, readinessList);
      const statusTone: BadgeTone =
        matched?.status === 'READY'
          ? 'success'
          : matched?.status === 'EXPERIMENTAL'
            ? 'warning'
            : 'none';
      const uiState = matched?.uiState ?? 'NOT_CONNECTED';
      const statusText = this.transloco.translate(`analytics.readinessUi.${uiState}`);

      return {
        resource: src.resource,
        sourceLabel,
        accessText,
        statusTone,
        statusText,
      };
    });
  });

  protected readonly rowKeyFn = (row: WhySourceRow) => row.resource;

  open(dashboardId: string, run: DashboardRun | null): void {
    const seq = ++this.loadSeq;
    this.activeRun.set(run);
    this.inspector.set(null);
    this.readiness.set([]);
    this.loading.set(true);
    this.activeTip.set(null);
    this.modal().open();

    void Promise.all([getScopeInspector(dashboardId), listReadiness()])
      .then(([insp, readinessRes]) => {
        if (seq !== this.loadSeq) return;
        this.inspector.set(insp);
        this.readiness.set(readinessRes.items);
        this.loading.set(false);
      })
      .catch((error: unknown) => {
        if (seq !== this.loadSeq) return;
        this.loading.set(false);
        this.notify.error(this.transloco.translate(errorKey(errorCodeOf(error))));
        this.modal().close();
      });
  }

  protected close(): void {
    this.modal().close();
  }

  protected onClosed(): void {
    this.loadSeq++;
    this.activeTip.set(null);
    this.loading.set(false);
  }

  protected openReadiness(): void {
    this.modal().close();
    void this.router.navigate(['/crm/settings/data-readiness']);
  }

  protected showTip(key: string, triggerEl: HTMLElement, tipEl: HTMLElement): void {
    const rect = rectInPage(triggerEl);
    const tipRect = rectInPage(tipEl);
    const tipWidth = tipRect.width || 240;
    const tipHeight = tipRect.height || 20;
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + tipWidth > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tipWidth;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tipWidth);
    }
    const top = Math.max(8, rect.bottom - tipHeight);

    this.tipPlace.set({ top, start });
    this.activeTip.set(key);
  }

  protected hideTip(): void {
    this.activeTip.set(null);
  }
}
