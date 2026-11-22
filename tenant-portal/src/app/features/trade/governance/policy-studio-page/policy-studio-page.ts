import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerPlus,
  tablerRefresh,
  tablerSearch,
  tablerShieldCheck,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { type ActionItem, type ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { ApiError, errorCodeOf, newIdempotencyKey } from '../../shared/trade-api';
import { DecisionModal } from '../decision-modal/decision-modal';
import { ScopeChip } from '../governance-shared/scope-chip/scope-chip';
import { VersionStatusBadge } from '../governance-shared/version-status-badge/version-status-badge';
import { PolicyModal } from '../policy-modal/policy-modal';
import { createVersion, getMetadata, getVersion, listDefinitions, setDefinitionStatus } from '../policy.api';
import { isPolicyVersionDetail } from '../policy.model';
import { supportedKinds } from '../policy.model';
import type {
  DefinitionStatus,
  GovernedDefinition,
  GovernedDefinitionRecord,
  GovernedVersion,
  PolicyContent,
  PolicyMetadata,
  PolicyTestCase,
} from '../policy.model';
import {
  ACTIVE_POLICY_KINDS,
  FACTS,
  FACTS_BY_KIND,
  POLICY_KINDS,
  type PolicyKind,
  operatorsFor,
} from '../policy.registry';
import { formatDateOnly } from '../pricing.service';

const CAN = { manage: true, test: true, approve: true, publish: true }; // later from the session

const ALLOWED_PAGE_SIZES = new Set([10, 25, 50]);
const NON_LIVE_IN_PROGRESS = new Set([
  'DRAFT',
  'TESTED',
  'APPROVAL_PENDING',
  'APPROVED',
  'REJECTED',
  'SCHEDULED',
]);

let nextPolicyStudioPageId = 0;

@Component({
  selector: 'app-policy-studio-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    DecisionModal,
    Dropdown,
    Pagination,
    PolicyModal,
    ScopeChip,
    Segmented,
    VersionStatusBadge,
  ],
  providers: [
    provideIcons({
      tablerAlertTriangle,
      tablerPlus,
      tablerRefresh,
      tablerSearch,
      tablerShieldCheck,
    }),
    provideTranslocoScope({ scope: 'trade-governance', alias: 'governance' }, { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-gov-policy', alias: 'policy' }),
  ],
  templateUrl: './policy-studio-page.html',
  host: { class: 'flex min-h-full flex-col gap-12 p-12' },
})
export class PolicyStudioPage {
  protected readonly uid = `policy-studio-${++nextPolicyStudioPageId}`;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly lang = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly createModal = viewChild.required(PolicyModal);
  private readonly decisionModal = viewChild.required(DecisionModal);

  protected readonly canManage = CAN.manage;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly definitions = signal<GovernedDefinition[]>([]);
  protected readonly metadata = signal<PolicyMetadata | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly busyId = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly kindFilter = signal<string>('ALL');
  protected readonly statusFilter = signal<'ALL' | DefinitionStatus>('ALL');
  protected readonly page = signal(this.readInitialPage());
  protected readonly pageSize = signal(this.readInitialSize());

  private readonly routeData = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  private readonly routeParams = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private lastOpenedDecisionId: string | null = null;

  protected readonly activeKinds = computed<readonly PolicyKind[]>(() => {
    const meta = this.metadata();
    const supported = supportedKinds(meta?.kinds.policies);
    if (supported.length) {
      return supported.filter((k): k is PolicyKind =>
        (POLICY_KINDS as readonly string[]).includes(k),
      );
    }
    return ACTIVE_POLICY_KINDS;
  });

  protected readonly kindOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('policy.list.allKinds') },
      ...this.activeKinds().map((k) => ({
        value: k,
        label: this.transloco.translate(`policy.kinds.${k}.name`),
      })),
    ];
  });

  protected readonly statusOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('policy.list.allStatuses') },
      { value: 'ACTIVE', label: this.transloco.translate('policy.list.active') },
      { value: 'INACTIVE', label: this.transloco.translate('policy.list.inactive') },
    ];
  });

  protected readonly filteredDefinitions = computed(() => {
    const q = this.search().trim().toLowerCase();
    const kind = this.kindFilter();
    const status = this.statusFilter();

    return this.definitions().filter((def) => {
      if (q && !def.code.toLowerCase().includes(q)) return false;
      if (kind !== 'ALL' && (def.policyKind ?? '') !== kind) return false;
      if (status !== 'ALL' && def.status !== status) return false;
      return true;
    });
  });

  protected readonly pagedDefinitions = computed(() => {
    const list = this.filteredDefinitions();
    const size = this.pageSize();
    const maxPage = Math.max(1, Math.ceil(list.length / size));
    const current = Math.min(this.page(), maxPage);
    const start = (current - 1) * size;
    return list.slice(start, start + size);
  });

  protected readonly hasActiveFilters = computed(
    () => this.search().trim() !== '' || this.kindFilter() !== 'ALL' || this.statusFilter() !== 'ALL',
  );

  constructor() {
    void this.reload();

    effect(() => {
      const data = this.routeData();
      const params = this.routeParams();
      const decisionId = data?.['decisionModal'] ? params.get('id') : null;
      if (decisionId && decisionId !== this.lastOpenedDecisionId) {
        this.lastOpenedDecisionId = decisionId;
        queueMicrotask(() => {
          void this.decisionModal().open(decisionId);
        });
      } else if (!decisionId) {
        this.lastOpenedDecisionId = null;
      }
    });
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const [defs, meta] = await Promise.all([
        listDefinitions('policy', { limit: 100 }),
        this.metadata() ? Promise.resolve(this.metadata()!) : getMetadata(),
      ]);
      this.definitions.set(defs.items);
      this.metadata.set(meta);
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected openCreateModal(): void {
    if (!this.canManage) return;
    this.createModal().open();
  }

  /** Create returns the bare definition row; a new definition has no versions yet. */
  protected onPolicyCreated(record: GovernedDefinitionRecord): void {
    const def: GovernedDefinition = { ...record, versions: [] };
    this.definitions.update((list) => [def, ...list]);
    void this.router.navigate(['/trade/governance/policy-studio', def.id]);
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.setPage(1);
  }

  protected onKindFilterChange(kind: string): void {
    this.kindFilter.set(kind);
    this.setPage(1);
  }

  protected onStatusFilterChange(status: string | null): void {
    this.statusFilter.set((status ?? 'ALL') as 'ALL' | DefinitionStatus);
    this.setPage(1);
  }

  protected onPageChange(next: number): void {
    this.setPage(next);
  }

  protected onPageSizeChange(next: number): void {
    this.pageSize.set(next);
    this.setPage(1, next);
  }

  protected openPolicy(def: GovernedDefinition): void {
    void this.router.navigate(['/trade/governance/policy-studio', def.id]);
  }

  protected liveVersionOf(def: GovernedDefinition): GovernedVersion | null {
    return (
      [...def.versions]
        .filter((v) => v.status === 'PUBLISHED')
        .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null
    );
  }

  protected liveVersionText(version: GovernedVersion): string {
    const date = formatDateOnly(version.effectiveFrom, this.lang());
    return this.transloco.translate('policy.list.liveVersion', { n: version.versionNumber, date });
  }

  protected inProgressVersionOf(def: GovernedDefinition): GovernedVersion | null {
    return (
      [...def.versions]
        .filter((v) => NON_LIVE_IN_PROGRESS.has(v.status))
        .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null
    );
  }

  protected actionsFor(def: GovernedDefinition): ActionItem[] {
    this.i18n();
    const isBusy = this.busyId() === def.id;
    const isActive = def.status === 'ACTIVE';
    return [
      {
        id: 'open',
        title: this.transloco.translate('policy.list.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'newVersion',
        title: this.transloco.translate('policy.list.actions.newVersion'),
        icon: 'tablerPlus',
        tile: 'bg-icon-teal',
        disabled: !this.canManage || isBusy,
      },
      {
        id: isActive ? 'deactivate' : 'activate',
        title: this.transloco.translate(
          isActive ? 'policy.list.actions.deactivate' : 'policy.list.actions.activate',
        ),
        icon: isActive ? 'tablerCircleOff' : 'tablerCheck',
        tile: isActive ? 'bg-icon-orange' : 'bg-icon-green',
        disabled: !this.canManage || isBusy,
      },
    ];
  }

  protected onRowAction(def: GovernedDefinition, selection: ActionSelection): void {
    if (selection.id === 'open') {
      this.openPolicy(def);
    } else if (selection.id === 'newVersion') {
      void this.createDraftVersion(def);
    } else if (selection.id === 'activate' || selection.id === 'deactivate') {
      void this.toggleDefinitionStatus(def, selection.id === 'activate' ? 'ACTIVE' : 'INACTIVE');
    }
  }

  protected onDecisionModalClosed(): void {
    if (this.route.snapshot.data['decisionModal']) {
      void this.router.navigate(['/trade/governance/policy-studio']);
    }
  }

  private async toggleDefinitionStatus(
    def: GovernedDefinition,
    nextStatus: DefinitionStatus,
  ): Promise<void> {
    if (!this.canManage || this.busyId()) return;
    this.busyId.set(def.id);
    try {
      const updated = await setDefinitionStatus(
        'policy',
        def.id,
        nextStatus,
        def.version,
        newIdempotencyKey(),
      );
      this.definitions.update((list) => list.map((d) => (d.id === updated.id ? { ...updated, versions: d.versions } : d)));
      this.notify.success(
        this.transloco.translate(
          nextStatus === 'ACTIVE' ? 'policy.list.toasts.activated' : 'policy.list.toasts.deactivated',
        ),
      );
    } catch (err) {
      this.notifyApiError(err);
      if (err instanceof ApiError && (errorCodeOf(err) ?? '').includes('STALE_VERSION')) {
        void this.reload();
      }
    } finally {
      this.busyId.set(null);
    }
  }

  private async createDraftVersion(def: GovernedDefinition): Promise<void> {
    if (!this.canManage || this.busyId()) return;
    this.busyId.set(def.id);
    try {
      const live = this.liveVersionOf(def);
      let content: PolicyContent;
      let testCases: PolicyTestCase[];

      if (live) {
        const liveDetail = await getVersion('policy', live.id);
        if (!isPolicyVersionDetail(liveDetail)) throw new Error('Not a policy version');
        content = structuredClone(liveDetail.content);
        testCases = structuredClone(liveDetail.testCases ?? []);
      } else {
        const meta = this.metadata();
        const factsList = meta?.facts ?? FACTS;
        const byKind = meta?.factsByKind ?? FACTS_BY_KIND;
        const firstFactKey = (byKind as Readonly<Record<string, readonly string[]>>)[(def.policyKind ?? '')]?.[0] ?? factsList[0]?.key ?? 'totalAmount';
        const firstFact = factsList.find((f) => f.key === firstFactKey);
        const op = operatorsFor(firstFact?.type ?? 'number')[0] ?? 'EQ';
        const defaultVal = firstFact?.type === 'boolean' ? false : firstFact?.type === 'number' ? 0 : '';
        content = {
          rules: [
            {
              code: '',
              priority: 10,
              all: [{ fact: firstFactKey, operator: op, value: defaultVal }],
              outcome: 'ALLOW',
              selectedValue: null,
              reasonCode: '',
            },
          ],
          defaultOutcome: 'ALLOW',
          defaultSelectedValue: null,
        };
        testCases = [
          {
            code: '',
            facts: { [firstFactKey]: defaultVal },
            expectedOutcome: 'ALLOW',
            expectedRuleCode: null,
            expectedSelectedValue: null,
          },
        ];
      }

      const effectiveFrom = new Date(Date.now() + 86_400_000).toISOString();
      const created = await createVersion<PolicyContent, PolicyTestCase>(
        'policy',
        def.id,
        {
          content,
          testCases,
          effectiveFrom,
          effectiveTo: null,
        },
        def.version,
        newIdempotencyKey(),
      );
      this.notify.success(
        this.transloco.translate('policy.list.toasts.versionCreated', { n: created.versionNumber }),
      );
      void this.router.navigate(['/trade/governance/policy-studio', def.id, 'versions', created.id]);
    } catch (err) {
      this.notifyApiError(err);
      if (err instanceof ApiError && (errorCodeOf(err) ?? '').includes('STALE_VERSION')) {
        void this.reload();
      }
    } finally {
      this.busyId.set(null);
    }
  }

  private notifyApiError(err: unknown): void {
    if (err instanceof ApiError) {
      const normalized = (errorCodeOf(err) ?? '').replaceAll('.', '_');
      const key = `governance.errors.${normalized}`;
      const translated = this.transloco.translate(key);
      this.notify.error(
        translated !== key ? translated : this.transloco.translate('tradeShared.errors.generic'),
      );
      return;
    }
    this.notify.error(this.transloco.translate('tradeShared.errors.network'));
  }

  private setPage(nextPage: number, nextSize = this.pageSize()): void {
    this.page.set(nextPage);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: nextPage, size: nextSize },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private readInitialPage(): number {
    const raw = Number(this.route.snapshot.queryParamMap.get('page'));
    return Number.isInteger(raw) && raw >= 1 ? raw : 1;
  }

  private readInitialSize(): number {
    const raw = Number(this.route.snapshot.queryParamMap.get('size'));
    return ALLOWED_PAGE_SIZES.has(raw) ? raw : 10;
  }
}
