import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import {
  tablerArrowBackUp,
  tablerCash,
  tablerEye,
  tablerFileText,
  tablerPencil,
  tablerShieldCheck,
  tablerStar,
  tablerToggleRight,
  tablerTrash,
  tablerTruckDelivery,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Field } from '../../../../shared/ui/field/field';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Segmented, SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { Switch } from '../../../../shared/ui/switch/switch';
import { TabItem, Tabs, tabButtonId, tabPanelId } from '../../../../shared/ui/tabs/tabs';
import { errorCodeOf } from '../../shared/trade-api';
import { countTerms, deleteTerm, listAllTerms, makeDefaultTerm, updateTerm } from '../../shared/terms/terms.api';
import { settingsErrorText } from '../settings-errors';
import { SettingsMutationKeys } from '../settings-mutation-keys';
import { TERM_TYPES, type Incoterm, type TermCounts, type TermSide, type TermType, type TradeTerm } from '../../shared/terms/terms.model';
import { TermModal } from './term-modal/term-modal';
import { translationEvents } from '../../../../core/i18n/translation-events';

const CAN_MANAGE = true; // later from trade.terms.manage
const SEARCH_DEBOUNCE_MS = 300;
const SORT_ORDER_MAX = 1_000_000;

type SideFilter = 'ALL' | 'SALES' | 'PURCHASE';

const TYPE_ICONS: Record<TermType, string> = {
  PAYMENT: 'tablerCash',
  DELIVERY: 'tablerTruckDelivery',
  WARRANTY: 'tablerShieldCheck',
  RETURNS: 'tablerArrowBackUp',
  GENERAL: 'tablerFileText',
};

function parseTermType(raw: string | null | undefined): TermType {
  const upper = raw?.trim().toUpperCase();
  return TERM_TYPES.find((type) => type === upper) ?? 'PAYMENT';
}

function parseSideFilter(raw: string | null | undefined): SideFilter {
  const upper = raw?.trim().toUpperCase();
  if (upper === 'SALES') return 'SALES';
  if (upper === 'PURCHASE') return 'PURCHASE';
  return 'ALL';
}

function sortTerms(list: readonly TradeTerm[]): TradeTerm[] {
  return list.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

@Component({
  selector: 'app-terms-page',
  imports: [
    TranslocoPipe,
    ActionsMenu,
    Badge,
    Button,
    ConfirmDialog,
    Field,
    FullState,
    Segmented,
    SettingsFrame,
    Switch,
    Tabs,
    TermModal,
  ],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      'settings',
      { scope: 'trade-settings', alias: 'tset' },
      { scope: 'trade-settings-terms', alias: 'tterms' },
    ),
    provideIcons({
      tablerArrowBackUp,
      tablerCash,
      tablerEye,
      tablerFileText,
      tablerPencil,
      tablerShieldCheck,
      tablerStar,
      tablerToggleRight,
      tablerTrash,
      tablerTruckDelivery,
    }),
  ],
  templateUrl: './terms-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class TermsPage {
  private static nextId = 0;
  protected readonly uid = `terms-page-${++TermsPage.nextId}`;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly scope = inject(ScopeState);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;
  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly termModal = viewChild.required(TermModal);
  private readonly deleteDialog = viewChild.required<ConfirmDialog>('deleteDialog');

  protected readonly canManage = CAN_MANAGE;
  protected readonly skeletonRows = [0, 1, 2, 3, 4];
  protected readonly tabButtonId = tabButtonId;
  protected readonly tabPanelId = tabPanelId;

  private readonly initialType = parseTermType(this.route.snapshot.queryParamMap.get('type'));
  private readonly initialSide = parseSideFilter(this.route.snapshot.queryParamMap.get('side'));

  protected readonly activeType = signal<TermType>(this.initialType);
  protected readonly sideFilter = signal<SideFilter>(this.initialSide);
  protected readonly showInactive = signal(false);
  protected readonly searchInput = signal('');
  private readonly debouncedSearch = signal('');

  protected readonly terms = signal<TradeTerm[]>([]);
  protected readonly counts = signal<TermCounts | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  private readonly busyIds = signal<ReadonlySet<string>>(new Set());
  private readonly mutationKeys = new SettingsMutationKeys();
  private readonly maxOrderByType = signal<Partial<Record<TermType, number>>>({});

  private readonly listReloadTick = signal(0);
  private readonly countsReloadTick = signal(0);
  private lastUrlType: TermType = this.initialType;
  private lastUrlSide: SideFilter = this.initialSide;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private listSeq = 0;
  private countsSeq = 0;
  private destroyed = false;
  private silentNextList = false;

  protected readonly hasPaymentColumn = computed(() => this.activeType() === 'PAYMENT');
  protected readonly hasDeliveryColumn = computed(() => this.activeType() === 'DELIVERY');
  protected readonly hasSearchFilter = computed(() => this.debouncedSearch().trim().length > 0);

  protected readonly tabItems = computed<readonly TabItem[]>(() => {
    this.i18n();
    const counts = this.counts();
    return TERM_TYPES.map((type) => ({
      id: type,
      label: this.transloco.translate(`tset.types.${type}`),
      icon: TYPE_ICONS[type],
      count: counts ? counts.byType[type] : null,
    }));
  });

  protected readonly sideFilterOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('tterms.filters.all') },
      { value: 'SALES', label: this.transloco.translate('tset.sides.SALES') },
      { value: 'PURCHASE', label: this.transloco.translate('tset.sides.PURCHASE') },
    ];
  });

  protected readonly gridColumns = computed(() => {
    if (this.hasPaymentColumn() || this.hasDeliveryColumn()) {
      return 'grid-cols-trade-term-extended-row-actions';
    }
    return 'grid-cols-trade-term-row-actions';
  });

  protected readonly activeTypeEmptyName = computed(() => {
    this.i18n();
    const label = this.transloco.translate(`tset.types.${this.activeType()}`);
    return this.language() === 'en' ? label.toLowerCase() : label;
  });

  protected readonly nextSortOrder = computed(() => {
    const type = this.activeType();
    let maxOrder = this.maxOrderByType()[type] ?? 0;
    for (const item of this.terms()) {
      if (item.termType === type && item.sortOrder > maxOrder) {
        maxOrder = item.sortOrder;
      }
    }
    const next = maxOrder <= 0 ? 10 : Math.floor(maxOrder / 10) * 10 + 10;
    return Math.min(next, SORT_ORDER_MAX);
  });

  constructor() {
    effect(() => {
      const qp = this.queryParams();
      if (!qp) return;
      const urlType = parseTermType(qp.get('type'));
      const urlSide = parseSideFilter(qp.get('side'));
      untracked(() => {
        if (urlType !== this.lastUrlType) {
          this.lastUrlType = urlType;
          this.activeType.set(urlType);
          this.terms.set([]);
        }
        if (urlSide !== this.lastUrlSide) {
          this.lastUrlSide = urlSide;
          this.sideFilter.set(urlSide);
        }
      });
    });

    effect(() => {
      const companyId = this.scope.company().id;
      this.countsReloadTick();
      untracked(() => {
        void companyId;
        void this.fetchCounts();
      });
    });

    effect(() => {
      const companyId = this.scope.company().id;
      const type = this.activeType();
      const side = this.sideFilter();
      const includeInactive = this.showInactive();
      const search = this.debouncedSearch();
      this.listReloadTick();
      untracked(() => {
        void companyId;
        const silent = this.silentNextList;
        this.silentNextList = false;
        void this.fetchTerms(type, side, includeInactive, search, silent);
      });
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.clearSearchDebounce();
    });
  }

  protected onTypeChange(next: string): void {
    const parsed = parseTermType(next);
    if (parsed === this.activeType() && parsed === this.lastUrlType) return;
    this.activeType.set(parsed);
    this.terms.set([]);
    this.lastUrlType = parsed;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type: parsed },
      queryParamsHandling: 'merge',
    });
  }

  protected onSideChange(next: string | null): void {
    const parsed = parseSideFilter(next);
    if (parsed === this.sideFilter() && parsed === this.lastUrlSide) return;
    this.sideFilter.set(parsed);
    this.lastUrlSide = parsed;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { side: parsed === 'ALL' ? null : parsed },
      queryParamsHandling: 'merge',
    });
  }

  protected onSearchChange(value: string): void {
    this.searchInput.set(value);
    this.clearSearchDebounce();
    if (value === '') {
      this.debouncedSearch.set('');
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.debouncedSearch.set(value);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected clearSearch(): void {
    this.clearSearchDebounce();
    this.searchInput.set('');
    this.debouncedSearch.set('');
  }

  protected clearSideFilter(): void {
    this.onSideChange('ALL');
  }

  protected reloadAll(): void {
    this.listReloadTick.update((n) => n + 1);
    this.countsReloadTick.update((n) => n + 1);
  }

  protected openCreate(): void {
    if (!this.canManage) return;
    const defaultSide: TermSide = this.sideFilter() === 'PURCHASE' ? 'PURCHASE' : 'SALES';
    this.termModal().openCreate(this.activeType(), this.nextSortOrder(), defaultSide);
  }

  protected openTerm(term: TradeTerm): void {
    this.termModal().openEdit(term);
  }

  protected primaryName(term: TradeTerm): string {
    const lang = this.language();
    const other = lang === 'ar' ? 'en' : 'ar';
    return term.localizedNames[lang] || term.localizedNames[other] || term.displayName || term.code;
  }

  protected secondaryName(term: TradeTerm): string {
    const other = this.language() === 'ar' ? 'en' : 'ar';
    return term.localizedNames[other] ?? '';
  }

  protected fullText(term: TradeTerm): string {
    const lang = this.language();
    const other = lang === 'ar' ? 'en' : 'ar';
    return (term.localizedTexts[lang] || term.localizedTexts[other] || '').trim();
  }

  protected firstLineText(term: TradeTerm): string {
    const full = this.fullText(term);
    if (!full) return '';
    return full.split(/\r?\n/, 1)[0].trim();
  }

  protected incotermName(code: Incoterm): string {
    this.i18n();
    return this.transloco.translate(`tset.incoterms.${code}`);
  }

  protected rowActions(term: TradeTerm): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('tterms.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (!this.canManage) return items;

    items.push(
      {
        id: 'edit',
        title: this.transloco.translate('tterms.actions.edit'),
        icon: 'tablerPencil',
        tile: 'bg-icon-navy',
      },
      {
        id: 'makeDefault',
        title: this.transloco.translate('tterms.actions.makeDefault'),
        icon: 'tablerStar',
        tile: 'bg-icon-orange',
        disabled: term.isDefault || !term.isActive,
        reason: term.isDefault
          ? this.transloco.translate('tterms.actions.alreadyDefault')
          : !term.isActive
            ? this.transloco.translate('tterms.actions.inactiveCannotBeDefault')
            : undefined,
      },
      {
        id: term.isActive ? 'deactivate' : 'activate',
        title: this.transloco.translate(term.isActive ? 'tterms.actions.deactivate' : 'tterms.actions.activate'),
        icon: 'tablerToggleRight',
        tile: 'bg-icon-teal',
      },
      {
        id: 'delete',
        title: this.transloco.translate('tterms.actions.delete'),
        icon: 'tablerTrash',
        tile: 'bg-icon-red',
        danger: true,
        disabled: term.isDefault,
        reason: term.isDefault ? this.transloco.translate('tterms.actions.deleteDefaultDisabled') : undefined,
      },
    );

    return items;
  }

  protected async handleAction(term: TradeTerm, selection: ActionSelection): Promise<void> {
    if (selection.id === 'open' || selection.id === 'edit') {
      this.openTerm(term);
      return;
    }
    if (!this.canManage || this.busyIds().has(term.id)) return;

    if (selection.id === 'makeDefault') {
      if (term.isDefault || !term.isActive) return;
      await this.runRowMakeDefault(term);
      return;
    }

    if (selection.id === 'activate' || selection.id === 'deactivate') {
      await this.runRowToggleActive(term, selection.id === 'activate');
      return;
    }

    if (selection.id === 'delete') {
      if (term.isDefault) return;
      await this.runRowDelete(term);
    }
  }

  protected onTermSaved(term: TradeTerm): void {
    this.upsertTerm(term);
    this.countsReloadTick.update((n) => n + 1);
    if (term.isDefault) {
      this.triggerSilentListRefresh();
    }
  }

  protected onTermReloaded(term: TradeTerm): void {
    this.upsertTerm(term);
    this.countsReloadTick.update((n) => n + 1);
  }

  protected onTermDeleted(id: string): void {
    this.terms.update((current) => current.filter((item) => item.id !== id));
    this.countsReloadTick.update((n) => n + 1);
  }

  private async runRowMakeDefault(term: TradeTerm): Promise<void> {
    this.setBusy(term.id, true);
    try {
      const operation = `make-default:${term.id}`;
      const key = this.mutationKeys.for(operation, { version: term.version });
      const updated = await makeDefaultTerm(term.id, term.version, this.scope, key);
      this.mutationKeys.clear(operation);
      if (this.destroyed) return;
      this.terms.update((current) =>
        sortTerms(
          current.map((item) => {
            if (item.id === updated.id) return updated;
            if (item.termType === updated.termType && item.side === updated.side && item.isDefault) {
              return { ...item, isDefault: false };
            }
            return item;
          }),
        ),
      );
      this.notify.success(this.transloco.translate('tterms.toasts.madeDefault'));
      this.triggerSilentListRefresh();
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.termModal().openConflictFromRow(term, { kind: 'makeDefault' });
        return;
      }
      this.notify.error(settingsErrorText(error, this.transloco));
    } finally {
      this.setBusy(term.id, false);
    }
  }

  private async runRowToggleActive(term: TradeTerm, nextActive: boolean): Promise<void> {
    this.setBusy(term.id, true);
    try {
      const operation = `update:${term.id}`;
      const patch = { isActive: nextActive };
      const key = this.mutationKeys.for(operation, { version: term.version, patch });
      const updated = await updateTerm(term.id, term.version, patch, this.scope, key);
      this.mutationKeys.clear(operation);
      if (this.destroyed) return;
      this.upsertTerm(updated);
      this.countsReloadTick.update((n) => n + 1);
      this.notify.success(
        this.transloco.translate(updated.isActive ? 'tterms.toasts.activated' : 'tterms.toasts.deactivated'),
      );
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.termModal().openConflictFromRow(term, { kind: 'active', isActive: nextActive });
        return;
      }
      this.notify.error(settingsErrorText(error, this.transloco));
    } finally {
      this.setBusy(term.id, false);
    }
  }

  private async runRowDelete(term: TradeTerm): Promise<void> {
    const confirmed = await this.deleteDialog().open();
    if (!confirmed || this.destroyed) return;

    this.setBusy(term.id, true);
    try {
      const operation = `delete:${term.id}`;
      const key = this.mutationKeys.for(operation, { version: term.version });
      const removed = await deleteTerm(term.id, term.version, this.scope, key);
      this.mutationKeys.clear(operation);
      if (this.destroyed) return;
      this.onTermDeleted(removed.id);
      this.notify.success(this.transloco.translate('tterms.toasts.deleted'));
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.termModal().openConflictFromRow(term, { kind: 'delete' });
        return;
      }
      this.notify.error(settingsErrorText(error, this.transloco));
      if (code === 'TRADE.TERMS.NOT_FOUND') {
        this.onTermDeleted(term.id);
      }
    } finally {
      this.setBusy(term.id, false);
    }
  }

  private async fetchCounts(): Promise<void> {
    const seq = ++this.countsSeq;
    try {
      const result = await countTerms({}, this.scope);
      if (seq !== this.countsSeq || this.destroyed) return;
      this.counts.set(result);
    } catch {
      // List load surfaces page-level failure state if unreachable.
    }
  }

  private async fetchTerms(
    type: TermType,
    side: SideFilter,
    includeInactive: boolean,
    search: string,
    silent: boolean,
  ): Promise<void> {
    const seq = ++this.listSeq;
    if (!silent) {
      this.loading.set(true);
      this.failed.set(false);
    }
    try {
      const trimmedSearch = search.trim();
      // Every page of the type (limit 100 each); `active` absent = active and inactive.
      const items = await listAllTerms(
        {
          type,
          side: side === 'ALL' ? undefined : side,
          active: includeInactive ? undefined : true,
          search: trimmedSearch || undefined,
        },
        this.scope,
      );
      if (seq !== this.listSeq || this.destroyed) return;
      const sorted = sortTerms(items);
      this.terms.set(sorted);
      this.failed.set(false);
      if (side === 'ALL' && !trimmedSearch) {
        const maxOrder = sorted.reduce((max, item) => (item.sortOrder > max ? item.sortOrder : max), 0);
        this.maxOrderByType.update((curr) => ({ ...curr, [type]: maxOrder }));
      }
    } catch {
      if (seq === this.listSeq && !this.destroyed && !silent) {
        this.failed.set(true);
      }
    } finally {
      if (seq === this.listSeq && !this.destroyed && !silent) {
        this.loading.set(false);
      }
    }
  }

  private triggerSilentListRefresh(): void {
    this.silentNextList = true;
    this.listReloadTick.update((n) => n + 1);
  }

  private upsertTerm(term: TradeTerm): void {
    const activeType = this.activeType();
    const sideFilter = this.sideFilter();
    const showInactive = this.showInactive();
    const search = this.debouncedSearch().trim().toLowerCase();

    const matchesFilter =
      term.termType === activeType &&
      (sideFilter === 'ALL' || term.side === sideFilter || term.side === 'BOTH') &&
      (showInactive || term.isActive) &&
      // Same match as the backend search: the code and the en / ar names.
      (!search ||
        term.code.toLowerCase().includes(search) ||
        ['en', 'ar'].some((lang) => (term.localizedNames[lang] ?? '').toLowerCase().includes(search)));

    this.terms.update((current) => {
      const others = current.filter((item) => item.id !== term.id);
      const updatedOthers = term.isDefault
        ? others.map((item) =>
            item.termType === term.termType && item.side === term.side && item.isDefault
              ? { ...item, isDefault: false }
              : item,
          )
        : others;
      return sortTerms(matchesFilter ? [...updatedOthers, term] : updatedOthers);
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
