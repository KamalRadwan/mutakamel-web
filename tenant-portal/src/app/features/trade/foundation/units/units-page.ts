import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerPlus,
  tablerRefresh,
  tablerRuler2,
  tablerSearch,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { StepFilter, StepOption } from '../../../../shared/ui/step-filter/step-filter';
import { errorCodeOf, errorKey, newIdempotencyKey, ApiError } from '../../shared/trade-api';
import type { StatusCounts, Uom, UomStatus } from '../../shared/trade-foundation.model';
import { UnitModal } from './unit-modal/unit-modal';
import { countUoms, listAllUoms, uomReferences, updateUom } from './units.api';
import {
  UOM_LIMITS,
  UnitStatusFilter,
  compareUomsByCode,
  filterUomsBySearch,
  parseUomRefGroupsFromDetails,
} from './units.model';
import { UnitsTable } from './units-table/units-table';

const CAN_MANAGE = true; // later from the session permissions
const SEARCH_DEBOUNCE_MS = 200;

function parseStatusFilter(raw: string | null | undefined): UnitStatusFilter {
  const normalized = raw?.trim().toUpperCase();
  if (normalized === 'RETIRED') return 'RETIRED';
  if (normalized === 'ALL') return 'ALL';
  return 'ACTIVE';
}

@Component({
  selector: 'app-units-page',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, StepFilter, UnitsTable, UnitModal],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-units', alias: 'tradeUnits' }),
    provideIcons({
      tablerPlus,
      tablerSearch,
      tablerX,
      tablerRefresh,
      tablerRuler2,
      tablerAlertTriangle,
    }),
  ],
  templateUrl: './units-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col gap-8 p-12' },
})
export class UnitsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly unitModal = viewChild.required(UnitModal);
  private readonly retireDialog = viewChild.required<ConfirmDialog>('retireDialog');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly canManage = CAN_MANAGE;
  protected readonly searchMax = UOM_LIMITS.searchMax;

  protected readonly units = signal<Uom[]>([]);
  protected readonly statusCounts = signal<StatusCounts<'ACTIVE' | 'RETIRED'> | null>(null);
  protected readonly loading = signal(true);
  protected readonly hasLoaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly busyIds = signal<ReadonlySet<string>>(new Set());
  protected readonly pendingRetireUnit = signal<Uom | null>(null);

  private readonly initialQ = (this.route.snapshot.queryParamMap.get('q') ?? '').slice(0, UOM_LIMITS.searchMax);
  private readonly initialStatus = parseStatusFilter(this.route.snapshot.queryParamMap.get('status'));

  protected readonly searchInputText = signal(this.initialQ);
  protected readonly searchQuery = signal(this.initialQ);
  protected readonly statusFilter = signal<UnitStatusFilter>(this.initialStatus);

  private lastUrlQ = this.initialQ;
  private lastUrlStatus: UnitStatusFilter = this.initialStatus;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private loadSeq = 0;
  private countsSeq = 0;
  private destroyed = false;
  private readonly pendingRowKeys = new Map<string, { signature: string; key: string }>();

  protected readonly searchMatchedUoms = computed<Uom[]>(() => {
    // Keep the client-side filter over the full list; the real API call sends GET /api/tenant/trade/v1/uoms?search= (<= 80 chars, code prefix first or name substring).
    return filterUomsBySearch(this.units(), this.searchQuery());
  });

  protected readonly statusSteps = computed<StepOption[]>(() => {
    this.i18n();
    const ready = this.hasLoaded();
    const hasSearch = this.searchQuery().trim().length > 0;
    const counts = this.statusCounts();

    let activeCount: number | null = null;
    let retiredCount: number | null = null;
    let allCount: number | null = null;

    if (ready) {
      if (hasSearch) {
        const matched = this.searchMatchedUoms();
        let active = 0;
        let retired = 0;
        for (const unit of matched) {
          if (unit.status === 'ACTIVE') active += 1;
          else retired += 1;
        }
        activeCount = active;
        retiredCount = retired;
        allCount = matched.length;
      } else if (counts) {
        activeCount = counts.ACTIVE;
        retiredCount = counts.RETIRED;
        allCount = counts.total;
      }
    }

    return [
      {
        id: 'ACTIVE',
        label: this.transloco.translate('tradeUnits.filter.active'),
        count: activeCount,
      },
      {
        id: 'RETIRED',
        label: this.transloco.translate('tradeUnits.filter.retired'),
        count: retiredCount,
      },
      {
        id: 'ALL',
        label: this.transloco.translate('tradeUnits.filter.all'),
        count: allCount,
      },
    ];
  });

  protected readonly visibleUoms = computed<Uom[]>(() => {
    const filter = this.statusFilter();
    const matched = this.searchMatchedUoms();
    if (filter === 'ALL') return matched;
    return matched.filter((unit) => unit.status === filter);
  });

  protected readonly activeFilterStatusName = computed(() => {
    this.i18n();
    const filter = this.statusFilter();
    if (filter === 'ALL') return '';
    const translated = this.transloco.translate(`tradeShared.uomStatus.${filter}`);
    return this.language() === 'en' ? translated.toLowerCase() : translated;
  });

  constructor() {
    effect(() => {
      const qp = this.queryParams();
      if (!qp) return;
      const urlQ = (qp.get('q') ?? '').slice(0, UOM_LIMITS.searchMax);
      const urlStatus = parseStatusFilter(qp.get('status'));
      untracked(() => {
        if (urlQ !== this.lastUrlQ) {
          this.lastUrlQ = urlQ;
          this.clearSearchDebounce();
          this.searchInputText.set(urlQ);
          this.searchQuery.set(urlQ);
        }
        if (urlStatus !== this.lastUrlStatus) {
          this.lastUrlStatus = urlStatus;
          this.statusFilter.set(urlStatus);
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.clearSearchDebounce();
    });
    void this.load();
  }

  protected async load(): Promise<void> {
    const seq = ++this.loadSeq;
    const cSeq = ++this.countsSeq;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const [items, counts] = await Promise.all([listAllUoms(), countUoms()]);
      if (seq !== this.loadSeq) return;
      this.units.set(items);
      if (cSeq === this.countsSeq) {
        this.statusCounts.set(counts);
      }
      this.hasLoaded.set(true);
    } catch {
      if (seq !== this.loadSeq) return;
      this.failed.set(true);
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }

  protected openCreate(): void {
    if (!this.canManage) return;
    this.unitModal().openCreate();
  }

  protected openUnit(unit: Uom): void {
    this.unitModal().openEdit(unit);
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, this.searchMax);
    this.searchInputText.set(value);
    this.clearSearchDebounce();
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.applySearch(value);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected clearSearch(focusInput = false): void {
    this.clearSearchDebounce();
    this.searchInputText.set('');
    this.applySearch('');
    if (focusInput) {
      this.searchInput()?.nativeElement.focus();
    }
  }

  protected onStatusChange(next: string): void {
    const parsed = parseStatusFilter(next);
    if (parsed === this.statusFilter() && parsed === this.lastUrlStatus) return;
    this.statusFilter.set(parsed);
    this.lastUrlStatus = parsed;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: parsed === 'ACTIVE' ? null : parsed },
      queryParamsHandling: 'merge',
    });
  }

  protected onUnitSaved(event: { unit: Uom; isNew: boolean }): void {
    this.upsertUnit(event.unit);
    void this.refreshCounts();
    if (event.isNew && this.statusFilter() === 'RETIRED') {
      this.onStatusChange('ACTIVE');
    }
  }

  protected onUnitReloaded(unit: Uom): void {
    this.upsertUnit(unit);
    void this.refreshCounts();
  }

  protected async onRetireRequested(unit: Uom): Promise<void> {
    if (!this.canManage || this.busyIds().has(unit.id)) return;
    this.setBusy(unit.id, true);
    let refs;
    try {
      refs = await uomReferences(unit.id);
    } catch (error) {
      this.notify.error(this.transloco.translate(errorKey(error)));
      return;
    } finally {
      this.setBusy(unit.id, false);
    }
    if (this.destroyed) return;
    if (refs.blocking) {
      this.unitModal().openInUseWarning(refs.groups);
      return;
    }

    this.pendingRetireUnit.set(unit);
    const confirmed = await this.retireDialog().open();
    if (!confirmed || this.destroyed) {
      this.pendingRetireUnit.set(null);
      return;
    }
    await this.changeStatus(unit, 'RETIRED');
    this.pendingRetireUnit.set(null);
  }

  protected async onActivateRequested(unit: Uom): Promise<void> {
    if (!this.canManage || this.busyIds().has(unit.id)) return;
    await this.changeStatus(unit, 'ACTIVE');
  }

  private async refreshCounts(): Promise<void> {
    const seq = ++this.countsSeq;
    try {
      const counts = await countUoms();
      if (seq === this.countsSeq && !this.destroyed) {
        this.statusCounts.set(counts);
      }
    } catch {
      // Silent background count refresh; existing counts stay shown until next reload.
    }
  }

  private async changeStatus(unit: Uom, targetStatus: UomStatus): Promise<void> {
    const key = this.rowIdempotencyKey(unit.id, unit.version, targetStatus);
    this.setBusy(unit.id, true);
    try {
      const updated = await updateUom(unit.id, { status: targetStatus }, unit.version, key);
      this.pendingRowKeys.delete(unit.id);
      this.upsertUnit(updated);
      void this.refreshCounts();
      this.notify.success(
        this.transloco.translate(
          targetStatus === 'RETIRED' ? 'tradeUnits.toast.retired' : 'tradeUnits.toast.activated',
        ),
      );
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'TRADE.CATALOG.UOM_RETIRE_REFERENCED') {
        this.pendingRowKeys.delete(unit.id);
        const details = error instanceof ApiError ? error.details : undefined;
        this.unitModal().openInUseWarning(parseUomRefGroupsFromDetails(details));
        return;
      }
      if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.pendingRowKeys.delete(unit.id);
        this.unitModal().openConflictFromRow(unit, targetStatus);
        return;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      this.setBusy(unit.id, false);
    }
  }

  private rowIdempotencyKey(id: string, version: number, targetStatus: UomStatus): string {
    const signature = `${version}:${targetStatus}`;
    const cached = this.pendingRowKeys.get(id);
    if (cached?.signature === signature) {
      return cached.key;
    }
    const key = newIdempotencyKey();
    this.pendingRowKeys.set(id, { signature, key });
    return key;
  }

  private upsertUnit(unit: Uom): void {
    this.units.update((current) => {
      const exists = current.some((item) => item.id === unit.id);
      const next = exists ? current.map((item) => (item.id === unit.id ? unit : item)) : [...current, unit];
      return next.slice().sort(compareUomsByCode);
    });
  }

  private applySearch(value: string): void {
    this.searchQuery.set(value);
    const paramValue = value.trim() ? value : null;
    const nextUrlQ = paramValue ?? '';
    if (nextUrlQ === this.lastUrlQ) return;
    this.lastUrlQ = nextUrlQ;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: paramValue },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private clearSearchDebounce(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
