import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCalendarStats,
  tablerEye,
  tablerLock,
  tablerLockOpen,
  tablerPlus,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import {
  ActionsMenu,
  type ActionItem,
  type ActionSelection,
} from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { StepFilter, type StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { ApiError, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import { itemName, listReasons, listReferenceData } from '../../shared/trade-foundation.api';
import type { ReasonCode } from '../../shared/trade-foundation.model';
import { closePeriod, listPeriods, reopenPeriod } from '../inventory.api';
import {
  INVENTORY_LIMITS,
  type InventoryPeriod,
  type InventoryReasonKind,
  type PeriodStatus,
} from '../inventory.model';
import { errorKey, errorReason, periodDays } from '../inventory.service';
import { InventoryBadge } from '../inventory-shared/inventory-badge/inventory-badge';
import { InventoryConflict } from '../inventory-shared/inventory-conflict/inventory-conflict';
import { InventoryReasonDialog } from '../inventory-shared/inventory-reason-dialog/inventory-reason-dialog';
import { PeriodModal } from '../period-modal/period-modal';

const CAN_GOVERN = true; // later from the session permissions
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = INVENTORY_LIMITS.pageSize;
const PAGE_SIZES: number[] = [25, 50, 100];
const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;
const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

type PeriodStatusFilter = '' | PeriodStatus;

interface PeriodCounts {
  all: number;
  open: number;
  closed: number;
}

interface PendingTransition {
  mode: 'close' | 'reopen';
  period: InventoryPeriod;
  key: string;
}

function parseStatusParam(raw: string | undefined): PeriodStatusFilter {
  const norm = raw?.trim().toUpperCase();
  if (norm === 'OPEN' || norm === 'CLOSED') return norm;
  return '';
}

function parsePageParam(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : DEFAULT_PAGE;
}

function parseSizeParam(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_PAGE_SIZE;
  const n = Number(raw);
  return PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE;
}

@Component({
  selector: 'app-periods-page',
  imports: [
    NgIcon,
    TranslocoPipe,
    ActionsMenu,
    Button,
    DateField,
    Field,
    Modal,
    Pagination,
    SettingsFrame,
    SettingsNotice,
    StepFilter,
    InventoryBadge,
    InventoryConflict,
    InventoryReasonDialog,
    PeriodModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-inventory', alias: 'tradeInventory' }, { scope: 'trade-inventory-setup', alias: 'invSetup' }),
    provideIcons({
      tablerCalendarStats,
      tablerEye,
      tablerLock,
      tablerLockOpen,
      tablerAlertTriangle,
      tablerPlus,
      tablerX,
    }),
  ],
  templateUrl: './periods-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class PeriodsPage {
  private static nextId = 0;
  protected readonly uid = `periods-page-${++PeriodsPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly periodModal = viewChild.required(PeriodModal);
  private readonly reasonDialog = viewChild.required(InventoryReasonDialog);
  private readonly conflictDialog = viewChild.required<InventoryConflict>('conflictDialog');
  private readonly warningAlert = viewChild.required<Modal>('warningAlert');

  /** Bound from route param `:id`. */
  readonly id = input<string | undefined>(undefined);
  /** Bound from `?status=`. */
  readonly statusParam = input<string | undefined>(undefined, { alias: 'status' });
  /** Bound from `?effectiveAt=`. */
  readonly effectiveAtParam = input<string | undefined>(undefined, { alias: 'effectiveAt' });
  /** Bound from `?page=`. */
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });
  /** Bound from `?size=`. */
  readonly sizeParam = input<string | undefined>(undefined, { alias: 'size' });

  protected readonly canGovern = CAN_GOVERN;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly gridColumns =
    'grid-cols-trade-inv-period-row-actions';

  protected readonly search = signal('');
  protected readonly rows = signal<readonly InventoryPeriod[]>([]);
  protected readonly total = signal(0);
  protected readonly counts = signal<PeriodCounts | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly creatingOpenBusy = signal(false);

  protected readonly closeReasons = signal<readonly ReasonCode[]>([]);
  protected readonly ownerNames = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly pendingTransition = signal<PendingTransition | null>(null);
  protected readonly transitionPending = signal(false);
  protected readonly warningMessage = signal('');

  private lastOpenedRouteId: string | null = null;
  private loadSeq = 0;
  private routeOpenSeq = 0;
  private destroyed = false;

  protected readonly statusFilter = computed<PeriodStatusFilter>(() =>
    parseStatusParam(this.statusParam()),
  );
  protected readonly effectiveAtFilter = computed(() => this.effectiveAtParam()?.trim() ?? '');
  protected readonly page = computed(() => parsePageParam(this.pageParam()));
  protected readonly pageSize = computed(() => parseSizeParam(this.sizeParam()));

  protected readonly hasActiveFilters = computed(
    () =>
      this.statusFilter() !== '' ||
      this.effectiveAtFilter() !== '' ||
      this.search().trim() !== '',
  );

  protected readonly filteredRows = computed<readonly InventoryPeriod[]>(() => {
    const needle = this.search().trim().toLowerCase();
    const list = this.rows();
    if (!needle) return list;
    return list.filter((p) => p.code.toLowerCase().includes(needle));
  });

  protected readonly closeReasonByCode = computed(() => {
    const map = new Map<string, ReasonCode>();
    for (const r of this.closeReasons()) {
      map.set(r.code.toUpperCase(), r);
    }
    return map;
  });

  protected readonly reasonLabelFn = (code: string | null): string => {
    if (!code) return this.transloco.translate('tradeInventory.common.none');
    const matched = this.closeReasonByCode().get(code.trim().toUpperCase());
    if (matched) {
      return itemName(matched, this.language()) || matched.code;
    }
    return code;
  };

  protected readonly userLabelFn = (id: string | null): string => {
    if (!id) return '';
    return this.ownerNames().get(id) ?? id;
  };

  protected readonly statusSteps = computed<StepOption[]>(() => {
    this.i18n();
    const counts = this.counts();
    return [
      {
        id: '',
        label: this.transloco.translate('invSetup.periods.steps.all'),
        count: counts?.all ?? null,
      },
      {
        id: 'OPEN',
        label: this.transloco.translate('invSetup.periods.steps.open'),
        count: counts?.open ?? null,
      },
      {
        id: 'CLOSED',
        label: this.transloco.translate('invSetup.periods.steps.closed'),
        count: counts?.closed ?? null,
      },
    ];
  });

  protected readonly dialogKind = computed<InventoryReasonKind>(() =>
    this.pendingTransition()?.mode === 'reopen'
      ? 'INVENTORY_PERIOD_REOPEN'
      : 'INVENTORY_PERIOD_CLOSE',
  );

  protected readonly dialogTitle = computed(() => {
    this.i18n();
    return this.transloco.translate(
      this.pendingTransition()?.mode === 'reopen'
        ? 'invSetup.periods.reopenDialog.title'
        : 'invSetup.periods.closeDialog.title',
    );
  });

  protected readonly dialogMessage = computed(() => {
    this.i18n();
    return this.transloco.translate(
      this.pendingTransition()?.mode === 'reopen'
        ? 'invSetup.periods.reopenDialog.message'
        : 'invSetup.periods.closeDialog.message',
    );
  });

  protected readonly dialogConfirmLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(
      this.pendingTransition()?.mode === 'reopen'
        ? 'invSetup.periods.reopenDialog.confirm'
        : 'invSetup.periods.closeDialog.confirm',
    );
  });

  protected readonly dialogTone = computed<'danger' | 'primary'>(() =>
    this.pendingTransition()?.mode === 'reopen' ? 'primary' : 'danger',
  );

  constructor() {
    void this.loadLookups();

    effect(() => {
      const status = this.statusFilter();
      const effectiveAt = this.effectiveAtFilter();
      const page = this.page();
      const size = this.pageSize();
      this.scope.company();
      untracked(() => {
        void this.loadPeriods(status, effectiveAt, page, size);
      });
    });

    effect(() => {
      const routeId = this.id()?.trim() ?? '';
      if (!routeId) {
        this.lastOpenedRouteId = null;
        return;
      }
      if (routeId === this.lastOpenedRouteId) return;
      this.lastOpenedRouteId = routeId;
      untracked(() => {
        void this.openPeriodById(routeId);
      });
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  protected reload(): void {
    void this.loadLookups();
    void this.loadPeriods(
      this.statusFilter(),
      this.effectiveAtFilter(),
      this.page(),
      this.pageSize(),
    );
  }

  protected async openCreate(): Promise<void> {
    if (!this.canGovern || this.creatingOpenBusy()) return;
    this.creatingOpenBusy.set(true);
    let latest: InventoryPeriod | null = null;
    try {
      const firstPage = await listPeriods({ page: 1, limit: 20 });
      latest = this.pickLatestPeriod(firstPage.items);
    } catch {
      latest = this.pickLatestPeriod(this.rows());
    } finally {
      this.creatingOpenBusy.set(false);
    }
    if (this.destroyed) return;
    this.periodModal().openCreate(latest);
  }

  protected openPeriod(period: InventoryPeriod): void {
    void this.router.navigate(['/trade/inventory/periods', period.id], {
      queryParamsHandling: 'preserve',
    });
  }

  protected onRowKeydown(event: KeyboardEvent, period: InventoryPeriod): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openPeriod(period);
    }
  }

  protected onEffectiveAtChange(next: string | null): void {
    const clean = next?.trim() ?? '';
    if (clean === this.effectiveAtFilter()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { effectiveAt: clean || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onStatusChange(next: string): void {
    const status = parseStatusParam(next);
    if (status === this.statusFilter()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: status || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageChange(nextPage: number): void {
    const safe = Math.max(DEFAULT_PAGE, nextPage);
    if (safe === this.page()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: safe === DEFAULT_PAGE ? null : safe },
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
    this.search.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: null, effectiveAt: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected formatDay(isoDay: string): string {
    const match = ISO_DAY_RE.exec(isoDay.trim());
    if (!match) return isoDay || '—';
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  protected formatDateTime(iso: string): string {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return '—';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = String(dt.getFullYear()).padStart(4, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  protected daysCount(period: InventoryPeriod): number {
    return periodDays(period.startsOn, period.endsOn);
  }

  protected backdateLabel(days: number): string {
    this.i18n();
    const form = new Intl.PluralRules(this.language()).select(days);
    return this.transloco.translate(`invSetup.periods.backdateDays.${form}`, { n: days });
  }

  protected rowActions(period: InventoryPeriod): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('invSetup.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (this.canGovern) {
      if (period.status === 'OPEN') {
        items.push({
          id: 'close',
          title: this.transloco.translate('invSetup.periods.actions.close'),
          icon: 'tablerLock',
          tile: 'bg-icon-red',
          danger: true,
        });
      } else {
        items.push({
          id: 'reopen',
          title: this.transloco.translate('invSetup.periods.actions.reopen'),
          icon: 'tablerLockOpen',
          tile: 'bg-icon-green',
        });
      }
    }

    return items;
  }

  protected onRowAction(period: InventoryPeriod, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
        this.openPeriod(period);
        break;
      case 'close':
        this.startTransition('close', period);
        break;
      case 'reopen':
        this.startTransition('reopen', period);
        break;
    }
  }

  protected startTransition(mode: 'close' | 'reopen', period: InventoryPeriod): void {
    if (!this.canGovern || this.transitionPending()) return;
    this.pendingTransition.set({
      mode,
      period,
      key: newIdempotencyKey(),
    });
    this.reasonDialog().open();
  }

  protected async onTransitionConfirmed(reasonCode: string): Promise<void> {
    const pending = this.pendingTransition();
    if (!pending || this.transitionPending()) return;

    this.transitionPending.set(true);
    try {
      const updated =
        pending.mode === 'close'
          ? await closePeriod(pending.period.id, pending.period.version, reasonCode, pending.key)
          : await reopenPeriod(pending.period.id, pending.period.version, reasonCode, pending.key);

      if (this.destroyed) return;
      this.reasonDialog().close();
      this.pendingTransition.set(null);

      const toastKey =
        pending.mode === 'close'
          ? 'invSetup.periods.toast.closed'
          : 'invSetup.periods.toast.reopened';
      this.notify.success(this.transloco.translate(toastKey, { code: updated.code }));

      this.periodModal().updateViewedPeriod(updated);
      this.reload();
    } catch (error) {
      if (this.destroyed) return;
      this.handleTransitionError(error);
    } finally {
      this.transitionPending.set(false);
    }
  }

  protected onTransitionCancelled(): void {
    this.pendingTransition.set(null);
  }

  protected onPeriodCreated(): void {
    this.reload();
  }

  protected onModalClosed(): void {
    this.lastOpenedRouteId = null;
    if (this.id()) {
      void this.router.navigate(['/trade/inventory/periods'], {
        queryParamsHandling: 'preserve',
      });
    }
  }

  protected async onConflictReload(): Promise<void> {
    await this.loadPeriods(
      this.statusFilter(),
      this.effectiveAtFilter(),
      this.page(),
      this.pageSize(),
    );
    const openId = this.id()?.trim();
    if (openId) {
      const fresh = await this.findPeriodById(openId);
      if (fresh) {
        this.periodModal().updateViewedPeriod(fresh);
      }
    }
  }

  protected closeWarningAlert(): void {
    this.warningAlert().close();
  }

  private handleTransitionError(error: unknown): void {
    if (error instanceof ApiError) {
      if (error.code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.reasonDialog().close();
        this.pendingTransition.set(null);
        this.conflictDialog().open();
        return;
      }
      if (error.code === 'TRADE.INVENTORY.PERIOD_CLOSED') {
        const reason = errorReason(error);
        if (reason === 'transition_not_allowed' || reason === 'overlapping_open_period') {
          this.reasonDialog().close();
          this.pendingTransition.set(null);
          this.warningMessage.set(this.transloco.translate(errorKey(error)));
          this.warningAlert().open();
          return;
        }
      }
    }
    this.notify.error(this.transloco.translate(errorKey(error)));
  }

  private async loadPeriods(
    status: PeriodStatusFilter,
    effectiveAt: string,
    page: number,
    limit: number,
  ): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);

    const commonFilter = {
      effectiveAt: effectiveAt || undefined,
    };

    try {
      const [listPage, allCountPage, openCountPage, closedCountPage] = await Promise.all([
        listPeriods({
          ...commonFilter,
          status: status || undefined,
          page,
          limit,
        }),
        listPeriods({ ...commonFilter, page: 1, limit: 1 }),
        listPeriods({ ...commonFilter, status: 'OPEN', page: 1, limit: 1 }),
        listPeriods({ ...commonFilter, status: 'CLOSED', page: 1, limit: 1 }),
      ]);
      if (seq !== this.loadSeq) return;
      this.rows.set(listPage.items);
      this.total.set(listPage.total);
      this.counts.set({
        all: allCountPage.total,
        open: openCountPage.total,
        closed: closedCountPage.total,
      });
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.rows.set([]);
      this.total.set(0);
      this.loadFailed.set(true);
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  private async openPeriodById(periodId: string): Promise<void> {
    const seq = ++this.routeOpenSeq;
    const cached = this.rows().find((p) => p.id === periodId);
    if (cached) {
      this.periodModal().openView(cached);
      return;
    }

    try {
      const found = await this.findPeriodById(periodId);
      if (seq !== this.routeOpenSeq || this.destroyed) return;
      if (found) {
        this.periodModal().openView(found);
        return;
      }
      this.notify.error(
        this.transloco.translate('tradeInventory.errors.TRADE_INVENTORY_PERIOD_NOT_FOUND'),
      );
    } catch (error) {
      if (seq !== this.routeOpenSeq || this.destroyed) return;
      this.notify.error(this.transloco.translate(errorKey(error)));
    }

    this.lastOpenedRouteId = null;
    void this.router.navigate(['/trade/inventory/periods'], {
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
  }

  private async findPeriodById(periodId: string): Promise<InventoryPeriod | null> {
    let page = 1;
    let fetched = 0;
    while (true) {
      const res = await listPeriods({ page, limit: 200 });
      const match = res.items.find((p) => p.id === periodId);
      if (match) return match;
      fetched += res.items.length;
      if (fetched >= res.total || res.items.length === 0) return null;
      page += 1;
    }
  }

  private async loadLookups(): Promise<void> {
    const ctx = tradeContext(this.scope, 'COMPANY');
    const [reasonsRes, refRes] = await Promise.allSettled([
      listReasons('INVENTORY_PERIOD_CLOSE', { includeInactive: true }),
      listReferenceData(ctx),
    ]);
    if (this.destroyed) return;

    if (reasonsRes.status === 'fulfilled') {
      this.closeReasons.set(reasonsRes.value);
    }
    if (refRes.status === 'fulfilled') {
      const map = new Map<string, string>();
      for (const owner of refRes.value.owners) {
        map.set(owner.id, owner.name);
      }
      this.ownerNames.set(map);
    }
  }

  private pickLatestPeriod(list: readonly InventoryPeriod[]): InventoryPeriod | null {
    let latest: InventoryPeriod | null = null;
    for (const p of list) {
      if (!latest || p.endsOn > latest.endsOn) {
        latest = p;
      }
    }
    return latest;
  }
}
