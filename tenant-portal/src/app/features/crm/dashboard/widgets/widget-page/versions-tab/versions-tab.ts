import { Component, DestroyRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerArrowBackUp, tablerArrowRight, tablerArrowsDiff, tablerCheck } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Notify } from '../../../../../../core/notify/notify';
import { Badge } from '../../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../../shared/ui/button/button';
import { DASH, formatDate, formatDateTime, formatNumber } from '../../../../../../shared/ui/chart/chart-format';
import { ConfirmDialog } from '../../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ConflictDialog } from '../../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { DataCell, DataColumn, DataTable } from '../../../../../../shared/ui/data-table/data-table';
import { FullState } from '../../../../../../shared/ui/full-state/full-state';
import { ApiError, errorCodeOf } from '../../../../../../shared/widgets/dashboard/analytics-api';
import { getCatalog } from '../../../../../../shared/widgets/dashboard/analytics.api';
import type { Catalog } from '../../../../../../shared/widgets/dashboard/analytics.model';
import { OrgApi } from '../../../../../../shared/widgets/dashboard/org.api';
import { errorKey } from '../../../../../../shared/widgets/dashboard/panel-state';
import {
  type BranchOption,
  compareVersions,
  listGrantedBranches,
  listVersions,
  restoreVersionToDraft,
} from '../../widgets.api';
import type { VersionCompare, VersionSnapshot, WidgetDetail } from '../../widgets.model';
import { can } from '../../../../../../shared/widgets/dashboard/analytics-permissions';
import { widgetConflict, widgetErrorMessage, widgetNeedsReload, widgetReadFailure, widgetWriteReadOnly, type WidgetReadFailure } from '../../builder/builder-errors';

interface VersionListItem {
  versionNumber: number;
  name: string;
  /** `crm_widget_versions.published_at` is nullable. */
  publishedAt: string | null;
  provenance: string;
}

interface CompareRow {
  key: string;
  label: string;
  leftText: string;
  rightText: string;
  changed: boolean;
}

/** Provenance codes are one fixed set shared with the dashboards store; older spellings map onto it. */
function normalizeProvenance(code: string): string {
  if (code === 'INITIAL_PUBLISH') return 'INITIAL';
  if (code === 'PUBLISHED_EDIT' || code === 'BUILDER_UPDATE') return 'PUBLISH';
  if (code.startsWith('RESTORED_FROM_V')) return 'RESTORE';
  return code;
}

@Component({
  selector: 'app-versions-tab',
  imports: [TranslocoPipe, NgIcon, Badge, Button, ConfirmDialog, ConflictDialog, DataTable, DataCell, FullState],
  providers: [provideIcons({ tablerArrowBackUp, tablerArrowRight, tablerArrowsDiff, tablerCheck })],
  templateUrl: './versions-tab.html',
  host: { class: 'block min-w-0' },
})
export class VersionsTab {
  private readonly notify = inject(Notify);
  private readonly org = inject(OrgApi);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly restoreDialog = viewChild.required<ConfirmDialog>('restoreDialog');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly widget = input.required<WidgetDetail>();
  /** True while the builder holds edits that are not saved; restoring replaces them. */
  readonly hasUnsavedEdits = input(false);
  readonly restored = output<void>();
  readonly countChange = output<number>();
  readonly becameReadOnly = output<void>();
  readonly forceReadOnly = input(false);
  readonly requestAccess = output<void>();

  protected readonly items = signal<VersionListItem[]>([]);
  protected readonly activeVersionNumber = signal<number | null>(null);
  protected readonly nextBeforeVersion = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly readFailure = signal<WidgetReadFailure | null>(null);
  protected readonly readOnly = signal(false);
  protected readonly conflictOpen = signal(false);
  protected readonly canRestore = computed(() => !this.readOnly() && !this.forceReadOnly() && can('crm.widgets.update'));
  private conflictVersions: [number, number] | null = null;
  protected readonly selected = signal<number[]>([]);
  protected readonly comparing = signal(false);
  protected readonly comparison = signal<VersionCompare | null>(null);
  protected readonly restoring = signal(false);
  private readonly catalog = signal<Catalog | null>(null);
  private readonly branches = signal<readonly BranchOption[]>([]);

  private activeWidgetId: string | null = null;
  private loadSeq = 0;
  private compareSeq = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    void this.loadCatalogOnce();
    void this.loadBranchesOnce();

    effect(() => {
      const current = this.widget();
      if (current.id !== this.activeWidgetId) {
        this.activeWidgetId = current.id;
        this.selected.set([]);
        this.comparison.set(null);
        this.readOnly.set(false);
      }
      this.compareSeq++;
      this.comparison.set(null);
      this.comparing.set(false);
      void this.loadVersions(current.id);
    });

    destroyRef.onDestroy(() => {
      this.loadSeq++;
      this.compareSeq++;
    });
  }

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    return [
      { key: 'version', label: this.transloco.translate('widgetPage.versions.version'), width: 1.2 },
      { key: 'name', label: this.transloco.translate('widgetPage.versions.name'), width: 2.5 },
      { key: 'publishedAt', label: this.transloco.translate('widgetPage.versions.published'), width: 1.8 },
      { key: 'provenance', label: this.transloco.translate('widgetPage.versions.provenance'), width: 1.2 },
      { key: 'select', label: this.transloco.translate('widgetPage.versions.select'), width: 0.6, align: 'end' },
    ];
  });

  protected readonly rowKey = (row: VersionListItem): string => String(row.versionNumber);

  protected readonly compareRows = computed<CompareRow[]>(() => {
    const cmp = this.comparison();
    if (!cmp) return [];
    this.i18n();
    const lang = this.language();
    const cat = this.catalog();
    const left = cmp.left;
    const right = cmp.right;
    const changed = new Set(cmp.changedSections);

    const nameLeft = left.name || DASH;
    const nameRight = right.name || DASH;

    const kindLeft = this.translateOrFallback(`analytics.visualization.${left.visualizationType}`, left.visualizationType);
    const kindRight = this.translateOrFallback(
      `analytics.visualization.${right.visualizationType}`,
      right.visualizationType,
    );

    const metricsLeft = this.formatMetrics(left, cat, lang);
    const metricsRight = this.formatMetrics(right, cat, lang);

    const groupingLeft = this.formatGrouping(left, cat, lang);
    const groupingRight = this.formatGrouping(right, cat, lang);

    const filtersLeft = this.formatFilters(left, lang);
    const filtersRight = this.formatFilters(right, lang);

    const compareLeft = this.formatComparison(left, lang);
    const compareRight = this.formatComparison(right, lang);

    const displayLeft = this.formatDisplay(left);
    const displayRight = this.formatDisplay(right);

    return [
      {
        key: 'name',
        label: this.transloco.translate('widgetPage.versions.sections.name'),
        leftText: nameLeft,
        rightText: nameRight,
        changed: changed.has('NAME') || nameLeft !== nameRight,
      },
      {
        key: 'chartKind',
        label: this.transloco.translate('widgetPage.versions.sections.chartKind'),
        leftText: kindLeft,
        rightText: kindRight,
        changed: changed.has('VISUALIZATION') || left.visualizationType !== right.visualizationType,
      },
      {
        key: 'metrics',
        label: this.transloco.translate('widgetPage.versions.sections.metrics'),
        leftText: metricsLeft,
        rightText: metricsRight,
        changed: JSON.stringify(left.querySpec.series) !== JSON.stringify(right.querySpec.series),
      },
      {
        key: 'grouping',
        label: this.transloco.translate('widgetPage.versions.sections.grouping'),
        leftText: groupingLeft,
        rightText: groupingRight,
        changed:
          JSON.stringify(left.querySpec.dimension ?? null) !== JSON.stringify(right.querySpec.dimension ?? null) ||
          JSON.stringify(left.querySpec.breakdown ?? null) !== JSON.stringify(right.querySpec.breakdown ?? null),
      },
      {
        key: 'filters',
        label: this.transloco.translate('widgetPage.versions.sections.filters'),
        leftText: filtersLeft,
        rightText: filtersRight,
        changed:
          JSON.stringify(left.querySpec.filters ?? null) !== JSON.stringify(right.querySpec.filters ?? null) ||
          JSON.stringify(left.querySpec.scopeBinding ?? null) !== JSON.stringify(right.querySpec.scopeBinding ?? null),
      },
      {
        key: 'comparison',
        label: this.transloco.translate('widgetPage.versions.sections.comparison'),
        leftText: compareLeft,
        rightText: compareRight,
        changed:
          JSON.stringify(left.querySpec.comparison ?? { type: 'NONE' }) !==
          JSON.stringify(right.querySpec.comparison ?? { type: 'NONE' }),
      },
      {
        key: 'display',
        label: this.transloco.translate('widgetPage.versions.sections.display'),
        leftText: displayLeft,
        rightText: displayRight,
        changed:
          changed.has('DISPLAY') ||
          changed.has('NOTES') ||
          JSON.stringify(left.displaySpec ?? {}) !== JSON.stringify(right.displaySpec ?? {}) ||
          (left.description ?? null) !== (right.description ?? null),
      },
    ];
  });

  protected formatPublished(iso: string | null): string {
    return iso ? formatDateTime(iso, this.language()) : '—';
  }

  protected provenanceLabel(provenance: string): string {
    return this.translateOrFallback(`widgetPage.versions.provenances.${normalizeProvenance(provenance)}`, provenance);
  }

  protected isSelected(versionNumber: number): boolean {
    return this.selected().includes(versionNumber);
  }

  protected toggleVersion(versionNumber: number): void {
    const current = this.selected();
    if (current.includes(versionNumber)) {
      this.selected.set(current.filter((v) => v !== versionNumber));
      return;
    }
    if (current.length >= 2) return;
    this.selected.set([...current, versionNumber]);
  }

  protected retry(): void {
    void this.loadVersions(this.widget().id);
  }

  protected async loadMore(): Promise<void> {
    const before = this.nextBeforeVersion();
    const id = this.widget().id;
    if (before == null || this.loadingMore()) return;

    const seq = ++this.loadSeq;
    this.loadingMore.set(true);
    try {
      const res = await listVersions(id, before);
      if (seq !== this.loadSeq || this.widget().id !== id) return;
      this.items.update((prev) => {
        const seen = new Set(prev.map((item) => item.versionNumber));
        const merged = [...prev];
        for (const item of res.items) {
          if (!seen.has(item.versionNumber)) {
            seen.add(item.versionNumber);
            merged.push(item);
          }
        }
        return merged;
      });
      this.activeVersionNumber.set(res.activeVersionNumber);
      this.nextBeforeVersion.set(res.nextBeforeVersion);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.notify.error(
        this.transloco.translate('widgetPage.versions.loadError'),
        this.transloco.translate(errorKey(errorCodeOf(error))),
      );
    } finally {
      if (seq === this.loadSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  protected async compareSelected(): Promise<void> {
    const sel = this.selected();
    if (sel.length !== 2 || this.comparing()) return;
    const older = Math.min(sel[0], sel[1]);
    const newer = Math.max(sel[0], sel[1]);
    await this.runCompare(older, newer);
  }

  protected clearCompare(): void {
    this.compareSeq++;
    this.comparing.set(false);
    this.comparison.set(null);
  }

  protected async restoreLeft(): Promise<void> {
    const cmp = this.comparison();
    if (!cmp || cmp.restoreState !== 'AVAILABLE' || !cmp.proof || this.restoring() || !this.canRestore()) return;

    const id = this.widget().id;
    const seq = this.compareSeq;

    const confirmed = await this.restoreDialog().open();
    if (!confirmed) return;
    if (this.hasUnsavedEdits() && !(await this.discardDialog().open())) return;

    if (id !== this.widget().id || seq !== this.compareSeq) return;
    this.restoring.set(true);
    try {
      await restoreVersionToDraft(id, {
        leftVersionNumber: cmp.left.versionNumber,
        rightVersionNumber: cmp.right.versionNumber,
        sourceVersionNumber: cmp.left.versionNumber,
        expectedWidgetRevision: cmp.widgetRevision,
        expectedGovernanceRevision: cmp.governanceRevision,
        impactId: cmp.proof.impactId,
        acknowledged: true,
      });
      if (id !== this.widget().id || seq !== this.compareSeq) return;
      this.notify.success(
        this.transloco.translate('widgetPage.versions.restoreSuccess', { n: cmp.left.versionNumber }),
      );
      this.restored.emit();
    } catch (error) {
      if (id !== this.widget().id || seq !== this.compareSeq) return;
      if (widgetConflict(error)) {
        this.conflictVersions = [cmp.left.versionNumber, cmp.right.versionNumber];
        this.comparison.set(null);
        this.conflictOpen.set(true);
        return;
      }
      this.notify.error(
        this.transloco.translate('widgetPage.versions.restoreError'),
        widgetErrorMessage(error, this.transloco, 'widgetPage', true),
      );
      if (widgetWriteReadOnly(error)) {
        this.readOnly.set(true);
        this.becameReadOnly.emit();
      }
      if (widgetNeedsReload(error) || errorCodeOf(error) === 'CRM_WIDGET_VERSION_RESTORE_DRAFT_EXISTS') {
        this.comparison.set(null);
        await this.runCompare(cmp.left.versionNumber, cmp.right.versionNumber);
      }
    } finally {
      this.restoring.set(false);
    }
  }

  protected async resolveConflict(keepChanges: boolean): Promise<void> {
    this.conflictOpen.set(false);
    const versions = this.conflictVersions;
    this.conflictVersions = null;
    await this.loadVersions(this.widget().id);
    if (versions) await this.runCompare(...versions);
    if (!keepChanges) this.selected.set([]);
  }

  protected readonly failureText = computed(() => {
    this.i18n();
    const failure = this.readFailure();
    return [failure?.message, failure?.correlationId
      ? this.transloco.translate('widgetPage.requests.correlation', { id: failure.correlationId }) : ''].filter(Boolean).join(' ');
  });

  protected readonly failureAction = computed(() => {
    const failure = this.readFailure();
    return failure?.kind === 'provisioning'
      ? can('crm.analytics.readiness.view') ? 'widgetPage.requests.readiness' : null
      : failure?.requestAccess ? 'widgetPage.requests.requestAccess'
      : failure?.kind === 'load-failure' ? 'analytics.common.retry' : null;
  });

  protected onFailureAction(): void {
    if (this.readFailure()?.kind === 'provisioning' && can('crm.analytics.readiness.view'))
      void this.router.navigateByUrl('/crm/settings/data-readiness');
    else if (this.readFailure()?.requestAccess) this.requestAccess.emit();
    else this.retry();
  }

  private async runCompare(older: number, newer: number): Promise<void> {
    const id = this.widget().id;
    const seq = ++this.compareSeq;
    this.comparing.set(true);
    try {
      const res = await compareVersions(id, older, newer);
      if (seq !== this.compareSeq || this.widget().id !== id) return;
      this.comparison.set(res);
    } catch (error) {
      if (seq !== this.compareSeq) return;
      this.comparison.set(null);
      if (widgetConflict(error)) {
        this.conflictVersions = [older, newer];
        this.conflictOpen.set(true);
        return;
      }
      this.readFailure.set(widgetReadFailure(error, this.transloco, 'widgetPage'));
      this.loadFailed.set(true);
    } finally {
      if (seq === this.compareSeq) {
        this.comparing.set(false);
      }
    }
  }

  private async loadVersions(widgetId: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.readFailure.set(null);
    try {
      const res = await listVersions(widgetId);
      if (seq !== this.loadSeq || this.widget().id !== widgetId) return;
      this.items.set(res.items);
      this.activeVersionNumber.set(res.activeVersionNumber);
      this.nextBeforeVersion.set(res.nextBeforeVersion);
      this.countChange.emit(Math.max(res.items.length, res.activeVersionNumber ?? 0));
    } catch (error) {
      if (seq !== this.loadSeq || this.widget().id !== widgetId) return;
      if (error instanceof ApiError && error.status === 404 && this.widget().versionNumber == null) {
        this.items.set([]);
        this.activeVersionNumber.set(null);
        this.nextBeforeVersion.set(null);
        this.countChange.emit(0);
      } else {
        this.readFailure.set(widgetReadFailure(error, this.transloco, 'widgetPage'));
        this.loadFailed.set(true);
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async loadBranchesOnce(): Promise<void> {
    try {
      this.branches.set(await listGrantedBranches(this.org));
    } catch {
      // Optional enrichment for branch names; raw ids serve as fallback.
    }
  }

  private async loadCatalogOnce(): Promise<void> {
    try {
      this.catalog.set(await getCatalog());
    } catch {
      // Optional enrichment for metric/dimension labels; raw keys serve as fallback.
    }
  }

  private formatMetrics(snap: VersionSnapshot, cat: Catalog | null, lang: 'ar' | 'en'): string {
    const series = snap.querySpec.series ?? [];
    if (series.length === 0) return DASH;
    return series
      .map((s) => {
        const meta = cat?.metrics.find((m) => m.key === s.metricKey);
        const label = (meta ? (lang === 'ar' ? meta.labelAr : meta.labelEn) : null) || s.label || s.metricKey;
        if (s.axis === 'RIGHT') {
          return `${label} (${this.transloco.translate('widgetPage.versions.compareLabels.axisRight')})`;
        }
        return label;
      })
      .join(' · ');
  }

  private formatGrouping(snap: VersionSnapshot, cat: Catalog | null, lang: 'ar' | 'en'): string {
    const parts: string[] = [];
    const dim = snap.querySpec.dimension;
    if (dim?.key) {
      const dimMeta = cat?.dimensions.find((d) => d.key === dim.key);
      const dimLabel = (dimMeta ? (lang === 'ar' ? dimMeta.labelAr : dimMeta.labelEn) : null) || dim.key;
      const dimParts = [dimLabel];
      if (dim.grain) {
        dimParts.push(this.translateOrFallback(`widgetPage.versions.compareLabels.grain.${dim.grain}`, dim.grain));
      }
      if (dim.topN != null) {
        dimParts.push(this.transloco.translate('widgetPage.versions.compareLabels.topN', { n: dim.topN }));
      }
      parts.push(dimParts.join(' · '));
    }

    const br = snap.querySpec.breakdown;
    if (br?.key) {
      const brMeta = cat?.dimensions.find((d) => d.key === br.key);
      const brLabel = (brMeta ? (lang === 'ar' ? brMeta.labelAr : brMeta.labelEn) : null) || br.key;
      parts.push(this.transloco.translate('widgetPage.versions.compareLabels.splitBy', { dimension: brLabel }));
      if (br.topN != null) {
        parts.push(this.transloco.translate('widgetPage.versions.compareLabels.topN', { n: br.topN }));
      }
      if (br.groupRest) {
        parts.push(this.transloco.translate('widgetPage.versions.compareLabels.groupRest'));
      }
    }

    return parts.length > 0 ? parts.join(' · ') : this.transloco.translate('widgetPage.versions.compareLabels.none');
  }

  private formatFilters(snap: VersionSnapshot, lang: 'ar' | 'en'): string {
    const parts: string[] = [];
    const f = snap.querySpec.filters;
    if (f?.datePreset) {
      if (f.datePreset === 'CUSTOM' && f.dateFrom && f.dateTo) {
        parts.push(`${formatDate(f.dateFrom, lang)} – ${formatDate(f.dateTo, lang)}`);
      } else {
        parts.push(this.translateOrFallback(`analytics.datePreset.${f.datePreset}`, f.datePreset));
      }
    }
    if (f?.branchId) {
      const branch = this.branches().find((b) => b.id === f.branchId);
      parts.push(branch ? (lang === 'ar' ? branch.name.ar : branch.name.en) : f.branchId);
    }
    if (f?.currencyCode) {
      parts.push(f.currencyCode);
    }
    if (f?.staleDays != null) {
      parts.push(formatNumber(f.staleDays, lang));
    }
    if (f?.closingWindowDays != null) {
      parts.push(formatNumber(f.closingWindowDays, lang));
    }
    if (snap.querySpec.scopeBinding?.kind === 'FIXED_REQUESTED') {
      parts.push(this.transloco.translate('widgetPage.versions.compareLabels.fixedScope'));
    } else if (snap.querySpec.scopeBinding?.kind === 'VIEWER_RELATIVE') {
      parts.push(this.transloco.translate('widgetPage.versions.compareLabels.viewerRelative'));
    }

    return parts.length > 0 ? parts.join(' · ') : this.transloco.translate('widgetPage.versions.compareLabels.none');
  }

  private formatComparison(snap: VersionSnapshot, lang: 'ar' | 'en'): string {
    const cmp = snap.querySpec.comparison;
    if (!cmp || cmp.type === 'NONE') {
      return this.transloco.translate('analytics.compare.NONE');
    }
    if (cmp.type === 'PREVIOUS_PERIOD' || cmp.type === 'PREVIOUS_YEAR') {
      return this.translateOrFallback(`analytics.compare.${cmp.type}`, cmp.type);
    }
    if (cmp.type === 'TARGET') {
      return this.transloco.translate('widgetPage.versions.compareLabels.target', {
        value: cmp.target != null ? formatNumber(cmp.target, lang) : DASH,
      });
    }
    if (cmp.type === 'DATASETS') {
      return this.transloco.translate('widgetPage.versions.compareLabels.datasets', {
        count: cmp.datasets?.length ?? 0,
      });
    }
    return this.transloco.translate('widgetPage.versions.compareLabels.governedTarget', {
      currency: cmp.governedTarget?.currencyCode || DASH,
    });
  }

  private formatDisplay(snap: VersionSnapshot): string {
    const parts: string[] = [];
    const d = snap.displaySpec;
    if (d?.legendPosition) {
      const pos = this.translateOrFallback(
        `widgetPage.versions.compareLabels.legendPos.${d.legendPosition}`,
        d.legendPosition,
      );
      parts.push(this.transloco.translate('widgetPage.versions.compareLabels.legend', { position: pos }));
    }
    if (d?.numberFormat) {
      const fmt = this.translateOrFallback(
        `widgetPage.versions.compareLabels.numFmt.${d.numberFormat}`,
        d.numberFormat,
      );
      parts.push(this.transloco.translate('widgetPage.versions.compareLabels.format', { format: fmt }));
    }
    if (d?.subtitle) {
      parts.push(this.transloco.translate('widgetPage.versions.compareLabels.subtitle', { text: d.subtitle }));
    }
    if (snap.description) {
      parts.push(this.transloco.translate('widgetPage.versions.compareLabels.description', { text: snap.description }));
    }
    return parts.length > 0 ? parts.join(' · ') : this.transloco.translate('widgetPage.versions.compareLabels.none');
  }

  private translateOrFallback(key: string, fallback: string): string {
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : fallback;
  }
}
