import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { tablerHelpCircle } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Button } from '../../../../../shared/ui/button/button';
import { DASH, formatDate, formatDateTime } from '../../../../../shared/ui/chart/chart-format';
import { DataCell, DataTable, type DataColumn } from '../../../../../shared/ui/data-table/data-table';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { getCatalog, getReceipt } from '../../../../../shared/widgets/dashboard/analytics.api';
import type { Catalog, DashboardRun, Receipt } from '../../../../../shared/widgets/dashboard/analytics.model';
import { can } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { getDashboard } from '../dashboards.api';
import type { DashboardDetail } from '../dashboards.model';
import { dashboardReadError } from '../dashboard-page/dashboard-read-error';
import { ExplainModal } from '../explain-modal/explain-modal';

@Component({
  selector: 'app-why-numbers-modal',
  imports: [TranslocoPipe, Button, DataCell, DataTable, Field, FullState, Modal, ExplainModal],
  providers: [
    provideTranslocoScope({ scope: 'crm-dash-filters', alias: 'dashFilters' }, { scope: 'analytics', alias: 'analytics' }),
    provideIcons({ tablerHelpCircle }),
  ],
  templateUrl: './why-numbers-modal.html',
})
export class WhyNumbersModal {
  private static nextId = 0;
  protected readonly uid = `why-modal-${++WhyNumbersModal.nextId}`;
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);
  private readonly modal = viewChild.required(Modal);
  private readonly explanation = viewChild.required(ExplainModal);
  protected readonly loading = signal(false);
  protected readonly failure = signal<unknown | null>(null);
  protected readonly readError = computed(() => {
    this.i18n();
    return this.failure() ? dashboardReadError(this.failure(), this.transloco, 'dashFilters') : null;
  });
  protected readonly receipts = signal<Receipt[]>([]);
  private readonly dashboard = signal<DashboardDetail | null>(null);
  private readonly catalog = signal<Catalog | null>(null);
  private readonly activeRun = signal<DashboardRun | null>(null);
  private dashboardId = '';
  private loadSeq = 0;
  protected readonly canViewReadiness = can('crm.analytics.readiness.view');
  protected readonly skeletonRows = [0, 1, 2, 3];
  protected readonly accessText = computed(() => {
    this.i18n();
    const access = this.dashboard()?.accessLevel;
    return access ? this.transloco.translate(`analytics.access.${access}`) : DASH;
  });
  protected readonly organizationText = computed(() => {
    const org = this.activeRun()?.organizationScope;
    return org ? [...org.companies.map((c) => c.name), ...org.branches.map((b) => b.name)].join(' · ') || DASH : DASH;
  });
  protected readonly periodText = computed(() => {
    this.i18n();
    const period = this.receipts().find((receipt) => receipt.period)?.period;
    return period ? `${formatDate(period.from, this.language())} – ${formatDate(period.to, this.language())}` : DASH;
  });
  protected readonly asOfText = computed(() => {
    this.i18n();
    const asOf = this.receipts()[0]?.asOf ?? this.activeRun()?.generatedAt;
    return asOf ? formatDateTime(asOf, this.language()) : DASH;
  });
  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    return ['metricKey', 'resultStatus', 'executedAt', 'explain'].map((key) => ({
      key, label: this.transloco.translate(`dashFilters.receiptColumns.${key}`),
    }));
  });
  protected readonly rowKey = (receipt: Receipt) => receipt.id;

  protected metricName(key: string): string {
    const metric = this.catalog()?.metrics.find((item) => item.key === key);
    return metric ? this.language() === 'ar' ? metric.labelAr : metric.labelEn : key;
  }

  protected executionTime(value: string): string { return formatDateTime(value, this.language()); }

  open(dashboardId: string, run: DashboardRun | null): void {
    const seq = ++this.loadSeq;
    this.dashboardId = dashboardId;
    this.activeRun.set(run);
    this.dashboard.set(null);
    this.receipts.set([]);
    this.failure.set(null);
    this.loading.set(true);
    this.modal().open();
    const receiptIds = [...new Set(run?.receipts.receiptIds ?? [])];
    void Promise.all([
      getDashboard(dashboardId),
      Promise.all(receiptIds.map((id) => getReceipt(id))),
      getCatalog().catch(() => null),
    ]).then(([dashboard, receipts, catalog]) => {
      if (seq !== this.loadSeq) return;
      this.dashboard.set(dashboard);
      this.receipts.set(receipts);
      this.catalog.set(catalog);
    }).catch((error: unknown) => {
      if (seq === this.loadSeq) this.failure.set(error);
    }).finally(() => {
      if (seq === this.loadSeq) this.loading.set(false);
    });
  }

  protected openExplanation(id: string): void { this.explanation().open(id); }
  protected close(): void { this.modal().close(); }
  protected onClosed(): void { this.loadSeq++; }
  protected onErrorAction(): void {
    if (this.readError()?.kind === 'provisioning' && this.canViewReadiness) this.openReadiness();
    else this.open(this.dashboardId, this.activeRun());
  }
  protected openReadiness(): void {
    this.modal().close();
    void this.router.navigate(['/crm/settings/data-readiness']);
  }
}
