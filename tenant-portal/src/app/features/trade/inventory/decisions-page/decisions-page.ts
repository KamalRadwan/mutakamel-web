import {
  Component,
  DestroyRef,
  Injector,
  computed,
  effect,
  inject,
  runInInjectionContext,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerCircleX, tablerGavel } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import {
  type ActionItem,
  type ActionSelection,
  ActionsMenu,
} from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { branchGrants } from '../../shared/trade-access';
import { tradeContext } from '../../shared/trade-api';
import { listDecisions } from '../inventory.api';
import {
  type DecisionAggregateType,
  INVENTORY_LIMITS,
  type InventoryDecision,
  type PolicyKind,
} from '../inventory.model';
import { errorKey, formatDateTime, hasCompanyGrant, isForbiddenError, shortId } from '../inventory.service';
import { DecisionModal } from '../decision-modal/decision-modal';
import { InventoryBadge } from '../inventory-shared/inventory-badge/inventory-badge';

type PolicyFilter = '' | PolicyKind;

interface DecisionCounts {
  all: number | null;
  INVENTORY_RESERVATION: number | null;
  INVENTORY_NEGATIVE: number | null;
  INVENTORY_OVER_RECEIPT: number | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = INVENTORY_LIMITS.pageSize;
const PAGE_SIZES: number[] = [20, 50, 100];
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;
const SEARCH_DEBOUNCE_MS = 300;
const GRID_COLS =
  'grid-cols-trade-inv-decision-row-actions';

const EMPTY_COUNTS: DecisionCounts = {
  all: null,
  INVENTORY_RESERVATION: null,
  INVENTORY_NEGATIVE: null,
  INVENTORY_OVER_RECEIPT: null,
};

function parsePolicyFilter(raw: string | null): PolicyFilter {
  if (
    raw === 'INVENTORY_RESERVATION' ||
    raw === 'INVENTORY_NEGATIVE' ||
    raw === 'INVENTORY_OVER_RECEIPT'
  ) {
    return raw;
  }
  return '';
}

function parsePage(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_PAGE;
}

function parsePageSize(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE_SIZE;
  const parsed = Number(raw);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

@Component({
  selector: 'app-decisions-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    SettingsFrame,
    StepFilter,
    Pagination,
    ActionsMenu,
    Button,
    FullState,
    InventoryBadge,
    DecisionModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-inventory', alias: 'tradeInventory' }, { scope: 'trade-inventory-evidence', alias: 'invEvidence' }),
    provideIcons({ tablerGavel, tablerAlertTriangle, tablerCircleX }),
  ],
  templateUrl: './decisions-page.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class DecisionsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly paramMap = toSignal(this.route.paramMap);
  private readonly queryParamMap = toSignal(this.route.queryParamMap);
  private readonly decisionModal = viewChild(DecisionModal);

  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly gridCols = GRID_COLS;

  protected readonly routeId = computed(() => this.paramMap()?.get('id')?.trim() || null);
  protected readonly rawAggregateParam = computed(
    () => this.queryParamMap()?.get('aggregateId')?.trim() || '',
  );
  protected readonly validAggregateId = computed(() => {
    const raw = this.rawAggregateParam();
    return UUID_PATTERN.test(raw) ? raw : '';
  });
  protected readonly policyFilter = computed<PolicyFilter>(() =>
    parsePolicyFilter(this.queryParamMap()?.get('policyKind') ?? null),
  );
  protected readonly page = computed(() => parsePage(this.queryParamMap()?.get('page') ?? null));
  protected readonly pageSize = computed(() =>
    parsePageSize(this.queryParamMap()?.get('size') ?? null),
  );

  protected readonly forbidden = signal(false);
  protected readonly canRead = computed(() => {
    const grants = runInInjectionContext(this.injector, () => branchGrants('trade.inventory.read'));
    const company = this.scope.company();
    const companyBranchIds = company?.branches.map((b) => b.id) ?? [];
    return hasCompanyGrant(grants, this.scope.branch()?.id ?? null, companyBranchIds);
  });
  protected readonly showForbidden = computed(() => !this.canRead() || this.forbidden());

  protected readonly searchDraft = signal('');
  protected readonly invalidRecordId = signal(false);
  protected readonly rows = signal<InventoryDecision[]>([]);
  protected readonly total = signal(0);
  protected readonly counts = signal<DecisionCounts>(EMPTY_COUNTS);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly errorMessageKey = signal('tradeInventory.errors.generic');

  protected readonly hasActiveFilters = computed(
    () => Boolean(this.validAggregateId() || this.policyFilter()),
  );

  private readonly branchById = computed(() => {
    const map = new Map<string, { nameEn: string; nameAr: string }>();
    for (const company of this.scope.companies()) {
      for (const branch of company.branches) {
        map.set(branch.id, branch);
      }
    }
    return map;
  });

  protected readonly steps = computed<StepOption[]>(() => {
    this.i18n();
    const c = this.counts();
    return [
      {
        id: '',
        label: this.transloco.translate('invEvidence.decisions.steps.all'),
        count: c.all,
      },
      {
        id: 'INVENTORY_RESERVATION',
        label: this.transloco.translate('invEvidence.decisions.steps.reservation'),
        count: c.INVENTORY_RESERVATION,
      },
      {
        id: 'INVENTORY_NEGATIVE',
        label: this.transloco.translate('invEvidence.decisions.steps.negative'),
        count: c.INVENTORY_NEGATIVE,
      },
      {
        id: 'INVENTORY_OVER_RECEIPT',
        label: this.transloco.translate('invEvidence.decisions.steps.overReceipt'),
        count: c.INVENTORY_OVER_RECEIPT,
      },
    ];
  });

  private listSeq = 0;
  private countsSeq = 0;
  private lastCountsAggregateId: string | null = null;
  private lastCompanyId: string | null = null;
  private lastUrlAggregate: string | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private openedModalId: string | null = null;
  private destroyed = false;

  constructor() {
    effect(() => {
      const urlRaw = this.rawAggregateParam();
      if (urlRaw === this.lastUrlAggregate) return;
      this.lastUrlAggregate = urlRaw;
      untracked(() => {
        this.clearSearchTimer();
        this.searchDraft.set(urlRaw);
        this.invalidRecordId.set(Boolean(urlRaw && !UUID_PATTERN.test(urlRaw)));
      });
    });

    effect(() => {
      const raw = this.searchDraft();
      untracked(() => this.onSearchDraftChange(raw));
    });

    effect(() => {
      const companyId = this.scope.company()?.id ?? '';
      const aggregateId = this.validAggregateId();
      const policyKind = this.policyFilter();
      const page = this.page();
      const limit = this.pageSize();
      const allowed = this.canRead();

      if (this.lastCompanyId !== companyId) {
        this.lastCompanyId = companyId;
        this.forbidden.set(false);
        this.lastCountsAggregateId = null;
      }

      if (!allowed) {
        untracked(() => {
          this.rows.set([]);
          this.total.set(0);
          this.counts.set(EMPTY_COUNTS);
          this.loading.set(false);
          this.loadFailed.set(false);
        });
        return;
      }

      untracked(() => {
        void this.loadDecisions({ aggregateId, policyKind, page, limit });
        const countsKey = `${companyId}|${aggregateId}`;
        if (countsKey !== this.lastCountsAggregateId) {
          this.lastCountsAggregateId = countsKey;
          void this.loadCounts(aggregateId);
        }
      });
    });

    effect(() => {
      if (this.showForbidden()) return;
      const id = this.routeId();
      const modal = this.decisionModal();
      if (!modal) return;
      if (id) {
        if (this.openedModalId !== id) {
          this.openedModalId = id;
          untracked(() => modal.open(id));
        }
      } else if (this.openedModalId !== null) {
        this.openedModalId = null;
        untracked(() => modal.closeSilently());
      }
    });

    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.clearSearchTimer();
      this.listSeq += 1;
      this.countsSeq += 1;
    });
  }

  protected reload(): void {
    if (!this.canRead()) return;
    this.forbidden.set(false);
    const aggregateId = this.validAggregateId();
    void this.loadDecisions({
      aggregateId,
      policyKind: this.policyFilter(),
      page: this.page(),
      limit: this.pageSize(),
    });
    void this.loadCounts(aggregateId);
  }

  protected goHome(): void {
    void this.router.navigate(['/']);
  }

  protected onForbidden(): void {
    this.forbidden.set(true);
  }

  protected onFrameEnter(event: Event): void {
    if (!this.isFrameSearchInput(event.target)) return;
    event.preventDefault();
    this.commitSearchNow(this.searchDraft());
  }

  protected onFrameEscape(event: Event): void {
    if (!this.isFrameSearchInput(event.target)) return;
    this.searchDraft.set('');
    this.commitSearchNow('');
  }

  protected onFrameFocusout(event: FocusEvent): void {
    const target = event.target;
    if (!this.isFrameSearchInput(target)) return;
    const related = event.relatedTarget as Node | null;
    if (related && (target as HTMLElement).parentElement?.contains(related)) {
      return;
    }
    this.commitSearchNow(this.searchDraft());
  }

  protected onPolicyChange(nextKind: string): void {
    const parsed = parsePolicyFilter(nextKind);
    if (parsed === this.policyFilter()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { policyKind: parsed || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageChange(nextPage: number): void {
    const clean = Math.max(DEFAULT_PAGE, nextPage);
    if (clean === this.page()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: clean === DEFAULT_PAGE ? null : clean },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageSizeChange(nextSize: number): void {
    if (!PAGE_SIZES.includes(nextSize) || nextSize === this.pageSize()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        size: nextSize === DEFAULT_PAGE_SIZE ? null : nextSize,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected clearFilters(): void {
    this.clearSearchTimer();
    this.invalidRecordId.set(false);
    this.lastUrlAggregate = '';
    this.searchDraft.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { aggregateId: null, policyKind: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected openDecision(row: InventoryDecision): void {
    void this.router.navigate(['/trade/inventory/decisions', row.id], {
      queryParamsHandling: 'preserve',
    });
  }

  protected onRowKeydown(event: KeyboardEvent, row: InventoryDecision): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openDecision(row);
    }
  }

  protected onModalClosed(): void {
    this.openedModalId = null;
    if (this.routeId()) {
      void this.router.navigate(['/trade/inventory/decisions'], {
        queryParamsHandling: 'preserve',
      });
    }
  }

  protected outcomeBadgeValue(row: InventoryDecision): string | null {
    const outcome = row.result.outcome?.trim();
    if (!outcome) return null;
    return outcome === 'SELECT' && row.result.selectedValue
      ? row.result.selectedValue
      : outcome;
  }

  protected explanationText(row: InventoryDecision): string {
    this.i18n();
    const code = row.result.explanationCode?.trim();
    if (code) {
      const key = `invEvidence.explanations.${code}`;
      const translated = this.transloco.translate(key);
      if (translated && translated !== key) {
        return translated;
      }
    }
    return row.explanation?.trim() || this.transloco.translate('tradeInventory.common.none');
  }

  protected aggregateTypeLabel(type: DecisionAggregateType | string | null | undefined): string {
    this.i18n();
    const clean = type?.trim();
    if (!clean) return this.transloco.translate('tradeInventory.common.none');
    const key = `invEvidence.aggregateTypes.${clean}`;
    const translated = this.transloco.translate(key);
    if (translated && translated !== key) {
      return translated;
    }
    return this.transloco.translate('invEvidence.aggregateTypes.unknown');
  }

  protected shortId(id: string): string {
    return shortId(id);
  }

  protected branchName(branchId: string | null): string {
    this.i18n();
    if (!branchId) {
      return this.transloco.translate('invEvidence.decisions.companyScope');
    }
    const branch = this.branchById().get(branchId);
    if (!branch) return branchId;
    return this.language() === 'ar' ? branch.nameAr : branch.nameEn;
  }

  protected formatDateTime(iso: string): string {
    return formatDateTime(iso);
  }

  protected rowActions(_row: InventoryDecision): ActionItem[] {
    this.i18n();
    return [
      {
        id: 'open',
        title: this.transloco.translate('invEvidence.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'copyCorrelation',
        title: this.transloco.translate('invEvidence.decisions.actions.copyCorrelation'),
        icon: 'tablerCopy',
        tile: 'bg-icon-gray',
      },
    ];
  }

  protected onRowAction(row: InventoryDecision, selection: ActionSelection): void {
    if (selection.id === 'open') {
      this.openDecision(row);
      return;
    }
    if (selection.id === 'copyCorrelation') {
      void this.copyCorrelation(row.correlationId);
    }
  }

  private onSearchDraftChange(raw: string): void {
    this.clearSearchTimer();
    const trimmed = raw.trim();

    if (!trimmed) {
      this.invalidRecordId.set(false);
      if (this.rawAggregateParam()) {
        this.lastUrlAggregate = '';
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { aggregateId: null, page: null },
          queryParamsHandling: 'merge',
        });
      }
      return;
    }

    if (UUID_PATTERN.test(trimmed)) {
      this.invalidRecordId.set(false);
      if (trimmed === this.rawAggregateParam()) return;
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null;
        this.commitSearchNow(this.searchDraft());
      }, SEARCH_DEBOUNCE_MS);
      return;
    }

    if (trimmed === this.rawAggregateParam()) {
      this.invalidRecordId.set(true);
      return;
    }

    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.commitSearchNow(this.searchDraft());
    }, SEARCH_DEBOUNCE_MS);
  }

  private commitSearchNow(raw: string): void {
    this.clearSearchTimer();
    const trimmed = raw.trim();
    if (!trimmed) {
      this.invalidRecordId.set(false);
      if (this.rawAggregateParam()) {
        this.lastUrlAggregate = '';
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { aggregateId: null, page: null },
          queryParamsHandling: 'merge',
        });
      }
      return;
    }

    if (!UUID_PATTERN.test(trimmed)) {
      this.invalidRecordId.set(true);
      return;
    }

    this.invalidRecordId.set(false);
    if (this.searchDraft() !== trimmed) {
      this.searchDraft.set(trimmed);
    }
    if (trimmed === this.rawAggregateParam()) return;

    this.lastUrlAggregate = trimmed;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { aggregateId: trimmed, page: null },
      queryParamsHandling: 'merge',
    });
  }

  private isFrameSearchInput(target: EventTarget | null): target is HTMLInputElement {
    return target instanceof HTMLInputElement && !target.closest('[data-decisions-body]');
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private async loadDecisions(params: {
    aggregateId: string;
    policyKind: PolicyFilter;
    page: number;
    limit: number;
  }): Promise<void> {
    if (!this.canRead()) {
      this.loading.set(false);
      return;
    }
    const seq = ++this.listSeq;
    this.loading.set(true);
    this.loadFailed.set(false);

    try {
      const res = await listDecisions(
        {
          aggregateId: params.aggregateId || undefined,
          policyKind: params.policyKind || undefined,
          page: params.page,
          limit: params.limit,
        },
        tradeContext(this.scope, 'COMPANY'),
      );
      if (this.destroyed || seq !== this.listSeq) return;
      this.rows.set(res.items);
      this.total.set(res.total);
      this.loading.set(false);
    } catch (error) {
      if (this.destroyed || seq !== this.listSeq) return;
      this.rows.set([]);
      this.total.set(0);
      this.loading.set(false);
      if (isForbiddenError(error)) {
        this.loadFailed.set(false);
        this.forbidden.set(true);
        return;
      }
      this.loadFailed.set(true);
      this.errorMessageKey.set(errorKey(error));
    }
  }

  private async loadCounts(aggregateId: string): Promise<void> {
    if (!this.canRead()) return;
    const seq = ++this.countsSeq;
    const ctx = tradeContext(this.scope, 'COMPANY');
    const base = {
      aggregateId: aggregateId || undefined,
      page: 1,
      limit: 1,
    };

    try {
      const [all, reservation, negative, overReceipt] = await Promise.all([
        listDecisions(base, ctx),
        listDecisions({ ...base, policyKind: 'INVENTORY_RESERVATION' }, ctx),
        listDecisions({ ...base, policyKind: 'INVENTORY_NEGATIVE' }, ctx),
        listDecisions({ ...base, policyKind: 'INVENTORY_OVER_RECEIPT' }, ctx),
      ]);
      if (this.destroyed || seq !== this.countsSeq) return;
      this.counts.set({
        all: all.total,
        INVENTORY_RESERVATION: reservation.total,
        INVENTORY_NEGATIVE: negative.total,
        INVENTORY_OVER_RECEIPT: overReceipt.total,
      });
    } catch (error) {
      if (this.destroyed || seq !== this.countsSeq) return;
      this.counts.set(EMPTY_COUNTS);
      if (isForbiddenError(error)) {
        this.loadFailed.set(false);
        this.forbidden.set(true);
      }
    }
  }

  private async copyCorrelation(correlationId: string): Promise<void> {
    const clean = correlationId.trim();
    if (!clean) return;
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(clean);
      this.notify.success(this.transloco.translate('tradeInventory.common.copied'));
    } catch {
      this.notify.error(this.transloco.translate('tradeInventory.errors.generic'));
    }
  }
}
