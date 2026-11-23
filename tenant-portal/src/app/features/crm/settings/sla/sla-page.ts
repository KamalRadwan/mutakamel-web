import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerClock, tablerX } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { formatDate, formatNumber, formatPercent } from '../../../../shared/ui/chart/chart-format';
import { DataCell, DataColumn, DataTable } from '../../../../shared/ui/data-table/data-table';
import { Dropdown, DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { ApiError, errorCodeOf } from '../../../../core/api/api-errors';
import { anyGrant, branchGrants } from '../shared/settings-access';
import { slaError } from './sla-error';
import { SlaModal } from './sla-modal/sla-modal';
import { getPolicy, listPolicies, listSlaBranches } from './sla.api';
import {
  ListSlaPoliciesQuery,
  SLA_APPLIES_TO_RECORDS,
  SLA_POLICY_KINDS,
  SLA_STATES,
  SlaAppliesToRecord,
  SlaPolicy,
  SlaPolicyKind,
  SlaPolicyState,
  decomposeTargetMinutes,
} from './sla.model';
import { WorkspaceLookups } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { WorkspaceBranch } from '../../../../shared/widgets/workspace-lookups/workspace-lookups.model';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';

type FilterKindValue = SlaPolicyKind | 'ALL';
type FilterRecordValue = SlaAppliesToRecord | 'ALL';
type FilterBranchValue = string; // 'ALL' | 'tenant' | branchId
type FilterStateValue = SlaPolicyState | 'ALL';

interface ActiveFilterChip {
  key: 'kind' | 'record' | 'branch' | 'state';
  label: string;
}

@Component({
  selector: 'app-sla-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    Badge,
    Button,
    DataCell,
    DataTable,
    Dropdown,
    Field,
    FullState,
    SettingsFrame,
    SlaModal,
  ],
  providers: [
    provideTranslocoScope(
      'settings',
      { scope: 'analytics', alias: 'analytics' },
      { scope: 'chart', alias: 'chart' },
      { scope: 'settings-sla', alias: 'sla' },
    ),
    provideIcons({ tablerClock, tablerX }),
  ],
  templateUrl: './sla-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class SlaPage {
  private readonly lookups = inject(WorkspaceLookups);
  private readonly scope = inject(TenantScopeState);
  protected readonly canChooseBranch = anyGrant('org.branch.read');
  private readonly readGrants = [
    branchGrants('crm.sla.manage'),
    branchGrants('crm.dashboards.read'),
  ];
  protected readonly branches = signal<WorkspaceBranch[]>([]);
  protected readonly serverReadOnly = signal(false);
  protected readonly forbidden = signal(false);
  protected readonly failureText = signal('');
  protected readonly correlationId = signal<string | null>(null);
  private static nextId = 0;
  protected readonly uid = `sla-page-${++SlaPage.nextId}`;

  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly slaModal = viewChild<SlaModal>('slaModal');

  protected readonly canRead = anyGrant('crm.sla.manage') || anyGrant('crm.dashboards.read');
  private readonly manageGranted = anyGrant('crm.sla.manage');
  protected readonly canManage = computed(() => this.manageGranted && !this.serverReadOnly());

  protected readonly policies = signal<SlaPolicy[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadError = signal(false);

  protected readonly search = signal('');
  protected readonly kindFilter = signal<FilterKindValue>('ALL');
  protected readonly recordFilter = signal<FilterRecordValue>('ALL');
  protected readonly branchFilter = signal<FilterBranchValue>('ALL');
  protected readonly stateFilter = signal<FilterStateValue>('ALL');

  private loadSeq = 0;

  protected readonly rowKey = (policy: SlaPolicy) => policy.id;

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    return [
      { key: 'name', label: this.transloco.translate('sla.table.name'), width: 2.1 },
      { key: 'kind', label: this.transloco.translate('sla.table.kind'), width: 1.3 },
      { key: 'record', label: this.transloco.translate('sla.table.record'), width: 0.9 },
      { key: 'branch', label: this.transloco.translate('sla.table.branch'), width: 1.3 },
      { key: 'target', label: this.transloco.translate('sla.table.target'), width: 1.8 },
      {
        key: 'version',
        label: this.transloco.translate('sla.table.version'),
        width: 0.6,
        align: 'end',
        numeric: true,
      },
      { key: 'effective', label: this.transloco.translate('sla.table.effective'), width: 1.7 },
      { key: 'state', label: this.transloco.translate('sla.table.state'), width: 0.9 },
    ];
  });

  protected readonly kindOptions = computed<DropdownOption<FilterKindValue>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('sla.filters.all') },
      ...SLA_POLICY_KINDS.map((value) => ({
        value,
        label: this.transloco.translate(`sla.kind.${value}`),
      })),
    ];
  });

  protected readonly recordOptions = computed<DropdownOption<FilterRecordValue>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('sla.filters.all') },
      ...SLA_APPLIES_TO_RECORDS.map((value) => ({
        value,
        label: this.transloco.translate(`sla.record.${value}`),
      })),
    ];
  });

  protected readonly branchOptions = computed<DropdownOption<FilterBranchValue>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('sla.filters.all') },
      { value: 'tenant', label: this.transloco.translate('sla.filters.tenantDefault') },
      ...this.branches().map((branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    ];
  });

  protected readonly stateOptions = computed<DropdownOption<FilterStateValue>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('sla.filters.all') },
      ...SLA_STATES.map((value) => ({
        value,
        label: this.transloco.translate(`sla.state.${value}`),
      })),
    ];
  });

  protected readonly filteredPolicies = computed(() => {
    const query = this.search().trim().toLowerCase();
    const list = this.policies();
    if (!query) return list;
    return list.filter(
      (policy) =>
        policy.nameEn.toLowerCase().includes(query) || policy.nameAr.toLowerCase().includes(query),
    );
  });

  protected readonly activeFilterChips = computed<ActiveFilterChip[]>(() => {
    this.i18n();
    const chips: ActiveFilterChip[] = [];

    const kind = this.kindFilter();
    if (kind !== 'ALL') {
      chips.push({
        key: 'kind',
        label: `${this.transloco.translate('sla.filters.kind')}: ${this.transloco.translate(`sla.kind.${kind}`)}`,
      });
    }

    const record = this.recordFilter();
    if (record !== 'ALL') {
      chips.push({
        key: 'record',
        label: `${this.transloco.translate('sla.filters.record')}: ${this.transloco.translate(`sla.record.${record}`)}`,
      });
    }

    const branch = this.branchFilter();
    if (branch !== 'ALL') {
      const branchLabel =
        branch === 'tenant'
          ? this.transloco.translate('sla.filters.tenantDefault')
          : this.resolveBranchName(branch);
      chips.push({
        key: 'branch',
        label: `${this.transloco.translate('sla.filters.branch')}: ${branchLabel}`,
      });
    }

    const state = this.stateFilter();
    if (state !== 'ALL') {
      chips.push({
        key: 'state',
        label: `${this.transloco.translate('sla.filters.state')}: ${this.transloco.translate(`sla.state.${state}`)}`,
      });
    }

    return chips;
  });

  protected readonly emptyText = computed(() => {
    this.i18n();
    return this.search().trim() || this.activeFilterChips().length > 0
      ? this.transloco.translate('settings.common.noResults')
      : this.transloco.translate('sla.errors.noPoliciesYet');
  });

  constructor() {
    if (this.canRead) {
      void this.load();
      if (this.canChooseBranch) void this.loadBranches();
    }
  }

  private async loadBranches(): Promise<void> {
    try {
      const branches = await listSlaBranches(this.lookups);
      this.branches.set(
        branches.filter(
          (branch) =>
            branch.status === 'ACTIVE' &&
            (this.scope.me()?.accessScope.branchesTruncated ||
              this.readGrants.some((grant) => grant === 'ALL' || grant.has(branch.id))),
        ),
      );
    } catch (error) {
      this.notify.error(slaError(this.transloco, error).message);
    }
  }

  protected async load(): Promise<void> {
    if (!this.canRead) return;
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set(false);
    this.forbidden.set(false);
    this.loadingMore.set(false);
    try {
      const page = await listPolicies(this.buildQuery());
      if (seq !== this.loadSeq) return;
      this.policies.set(page.items);
      this.nextCursor.set(page.pageInfo.nextCursor);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      if (error instanceof ApiError && error.status === 401) return;
      const failure = slaError(this.transloco, error);
      this.forbidden.set(failure.kind === 'forbidden');
      this.failureText.set(failure.message);
      this.correlationId.set(failure.correlationId);
      this.loadError.set(failure.kind !== 'forbidden');
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;
    const seq = this.loadSeq;
    this.loadingMore.set(true);
    try {
      const page = await listPolicies(this.buildQuery(cursor));
      if (seq !== this.loadSeq) return;
      this.policies.update((current) => [...current, ...page.items]);
      this.nextCursor.set(page.pageInfo.nextCursor);
    } catch (error) {
      if (seq === this.loadSeq) {
        if (errorCodeOf(error) === 'CRM_DASHBOARD_LIST_CURSOR_INVALID') {
          await this.load();
        } else if (!(error instanceof ApiError && error.status === 401)) {
          this.notify.error(slaError(this.transloco, error).message);
        }
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loadingMore.set(false);
      }
    }
  }

  protected onKindFilterChange(value: FilterKindValue): void {
    this.kindFilter.set(value);
    void this.load();
  }

  protected onRecordFilterChange(value: FilterRecordValue): void {
    this.recordFilter.set(value);
    void this.load();
  }

  protected onBranchFilterChange(value: FilterBranchValue): void {
    this.branchFilter.set(value);
    void this.load();
  }

  protected onStateFilterChange(value: FilterStateValue): void {
    this.stateFilter.set(value);
    void this.load();
  }

  protected removeFilterChip(key: ActiveFilterChip['key']): void {
    if (key === 'kind') this.kindFilter.set('ALL');
    else if (key === 'record') this.recordFilter.set('ALL');
    else if (key === 'branch') this.branchFilter.set('ALL');
    else this.stateFilter.set('ALL');
    void this.load();
  }

  protected clearFilters(): void {
    this.kindFilter.set('ALL');
    this.recordFilter.set('ALL');
    this.branchFilter.set('ALL');
    this.stateFilter.set('ALL');
    void this.load();
  }

  protected openCreate(): void {
    if (!this.canManage()) return;
    this.slaModal()?.openCreate();
  }

  protected async openPolicy(policy: SlaPolicy): Promise<void> {
    try {
      this.slaModal()?.openPolicy(await getPolicy(policy.id));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      this.notify.error(slaError(this.transloco, error).message);
      if (errorCodeOf(error) === 'CRM_DASHBOARD_RESOURCE_NOT_FOUND') await this.load();
    }
  }

  protected onPublished(): void {
    void this.load();
  }

  protected goBack(): void {
    void this.router.navigateByUrl('/crm/dashboard');
  }

  protected policyName(policy: SlaPolicy): string {
    return this.language() === 'ar' ? policy.nameAr : policy.nameEn;
  }

  protected branchName(branchId: string | null | undefined): string {
    if (!branchId) {
      return this.transloco.translate('sla.table.allBranchesDefault');
    }
    return this.resolveBranchName(branchId);
  }

  protected targetPrefixText(policy: SlaPolicy): string {
    this.i18n();
    const lang = this.language();
    const { value, unit } = decomposeTargetMinutes(policy.targetMinutes, policy.clockKind);
    const n = formatNumber(value, lang, 0);
    const plural = new Intl.PluralRules(lang);

    if (policy.policyKind === 'FOLLOW_UP_CADENCE') {
      const unitCap = unit === 'days' ? 'Days' : unit === 'hours' ? 'Hours' : 'Minutes';
      const duration = this.transloco.translate(
        `sla.targetFormat.cadence${unitCap}.${plural.select(value)}`,
        { n },
      );
      const touchCount = policy.requiredTouchCount ?? 0;
      const touches = formatNumber(touchCount, lang, 0);
      return this.transloco.translate(
        `sla.targetFormat.cadencePrefix.${plural.select(touchCount)}`,
        {
          touches,
          duration,
        },
      );
    }

    const prefix = policy.clockKind === 'WORKING_MINUTES' ? 'working' : 'calendar';
    const unitCap = unit === 'days' ? 'Days' : unit === 'hours' ? 'Hours' : 'Minutes';
    return this.transloco.translate(
      `sla.targetFormat.${prefix}${unitCap}.${plural.select(value)}`,
      { n },
    );
  }

  protected formattedCompliancePct(policy: SlaPolicy): string {
    return formatPercent(policy.compliancePct ?? 0, 1);
  }

  protected formatPolicyDate(iso: string | null | undefined): string {
    if (!iso) return this.transloco.translate('sla.table.now');
    return formatDate(iso, this.language(), (key, params) =>
      this.transloco.translate(`chart.${key}`, params),
    );
  }

  private buildQuery(cursor?: string): ListSlaPoliciesQuery {
    const query: ListSlaPoliciesQuery = {};
    if (this.kindFilter() !== 'ALL') query.kind = this.kindFilter() as SlaPolicyKind;
    if (this.recordFilter() !== 'ALL') query.record = this.recordFilter() as SlaAppliesToRecord;
    if (this.branchFilter() !== 'ALL') query.branchId = this.branchFilter();
    if (this.stateFilter() !== 'ALL') query.state = this.stateFilter() as SlaPolicyState;
    if (cursor) query.cursor = cursor;
    return query;
  }

  private resolveBranchName(branchId: string): string {
    return (
      this.branches().find((branch) => branch.id === branchId)?.name ??
      this.transloco.translate('sla.filters.branch')
    );
  }
}
