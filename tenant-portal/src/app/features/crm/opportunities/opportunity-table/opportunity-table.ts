import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ApiError, correlationIdOf } from '../../../../core/api/api-errors';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { opportunitySearchErrorKey } from '../opportunity-search/opportunity-search.compile';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowUp,
  tablerArrowsExchange,
  tablerArrowsRightLeft,
  tablerArrowsSort,
  tablerCalendarPlus,
  tablerMinus,
  tablerStar,
  tablerTarget,
  tablerUserCircle,
} from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Checkbox } from '../../../../shared/ui/checkbox/checkbox';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { PhoneActionSource, PhoneActions } from '../../../../shared/widgets/phone-actions/phone-actions';
import { DUE_BADGE, STARS } from '../../shared/record/card/record-card.model';
import {
  DEFAULT_LIST_PAGE_SIZE,
  DEFAULT_LIST_PAGE_SIZES,
  createListPageSize,
} from '../../shared/record/list/page-size';
import { RecordNavContext } from '../../shared/record/nav/record-nav';
import { listPageSizes, searchOpportunities } from '../opportunities.api';
import {
  CardColor,
  OpportunityCapabilities,
  OpportunityRow,
  OpportunitySearchBody,
  PipelineStageView,
  formatMoney,
  moneyNoCurrencyKey,
  initials,
  opportunityRef,
  stageLabel,
} from '../opportunities.model';
import {
  OpportunityOpenEvent,
  activityDueBucket,
  canDeleteOpportunity,
  canMoveOpportunity,
  canTransferOpportunity,
  canUpdateOpportunity,
  formatShortDate,
  isCloseDateOverdue,
  opportunityActions,
  opportunityContactName,
  opportunityCustomerName,
  opportunityPhone,
  opportunityPhoneSource,
  stageBadgeClass,
} from '../opportunity-card/opportunity-card';
import { opportunityList } from '../opportunity-list';

export interface OpportunitySelectionStore {
  isSelected(id: string): boolean;
  toggle(row: OpportunityRow): void;
  togglePage?: (rows: OpportunityRow[]) => void;
  setRows?: (rows: OpportunityRow[], selected: boolean) => void;
  pageState(ids: readonly string[]): 'none' | 'some' | 'all';
}

export type OpportunityTableColumnId =
  | 'title'
  | 'customer'
  | 'stage'
  | 'amount'
  | 'probability'
  | 'expectedClose'
  | 'owner'
  | 'nextActivity'
  | 'phone'
  | 'rating';

export type OpportunitySortKey = 'title' | 'amount' | 'probabilityPercent' | 'expectedCloseDate';

export interface OpportunityTableColumnDef {
  readonly id: OpportunityTableColumnId;
  readonly sortKey?: OpportunitySortKey;
  readonly defaultDir?: 'ASC' | 'DESC';
  readonly alignEnd?: boolean;
}

export const OPPORTUNITY_TABLE_COLUMNS: readonly OpportunityTableColumnDef[] = [
  { id: 'title', sortKey: 'title', defaultDir: 'ASC' },
  { id: 'customer' },
  { id: 'stage' },
  { id: 'amount', sortKey: 'amount', defaultDir: 'DESC', alignEnd: true },
  { id: 'probability', sortKey: 'probabilityPercent', defaultDir: 'DESC' },
  { id: 'expectedClose', sortKey: 'expectedCloseDate', defaultDir: 'ASC' },
  { id: 'owner' },
  { id: 'nextActivity' },
  { id: 'phone' },
  { id: 'rating' },
];

const TABLE_GRID_COLS =
  'var(--select-col-w) minmax(0,2.2fr) minmax(0,1.6fr) minmax(0,1.1fr) minmax(0,1.4fr) minmax(0,0.8fr) minmax(0,1.1fr) minmax(0,1.3fr) minmax(0,1.1fr) minmax(0,2.1fr) minmax(0,0.8fr) var(--table-head-h)';

@Component({
  selector: 'app-opportunity-table',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Checkbox, ConfirmDialog, Pagination, PhoneActions, FullState, ConflictDialog],
  providers: [
    provideTranslocoScope('opportunities', { scope: 'record-list', alias: 'recordList' }),
    provideIcons({
      tablerTarget,
      tablerArrowUp,
      tablerArrowDown,
      tablerArrowsSort,
      tablerMinus,
      tablerStar,
      tablerStarFill,
      tablerCalendarPlus,
      tablerArrowsExchange,
      tablerArrowsRightLeft,
      tablerUserCircle,
    }),
  ],
  templateUrl: './opportunity-table.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8' },
})
export class OpportunityTable {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly confirmDialog = viewChild.required(ConfirmDialog);
  private readonly headerCheckboxEl = viewChild('pageCb', { read: ElementRef<HTMLElement> });
  protected readonly language = inject(LanguageState).current;

  readonly body = input.required<OpportunitySearchBody>();
  readonly stages = input.required<PipelineStageView[]>();
  readonly stage = input('all');
  readonly page = model(1);
  readonly pageSize = model(DEFAULT_LIST_PAGE_SIZE);
  readonly capabilities = input<OpportunityCapabilities | null>(null);
  readonly selection = input<OpportunitySelectionStore | null>(null);
  readonly sort = model<string | null>(null);
  readonly reloadToken = input(0);

  readonly open = output<OpportunityOpenEvent<OpportunityRow>>();
  readonly activities = output<OpportunityRow>();
  readonly transfer = output<OpportunityRow>();
  readonly countsChanged = output<void>();
  readonly searchError = output<unknown>();
  readonly readOnlyChange = output<boolean>();

  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  protected readonly columns = OPPORTUNITY_TABLE_COLUMNS;
  protected readonly gridCols = TABLE_GRID_COLS;
  protected readonly stars = STARS;
  protected readonly initials = initials;
  protected readonly opportunityRef = opportunityRef;

  protected readonly pageSizePref = createListPageSize({
    storageKey: 'opportunities.table.pageSize',
    sizes: DEFAULT_LIST_PAGE_SIZES,
    defaultSize: DEFAULT_LIST_PAGE_SIZE,
    load: listPageSizes,
  });
  protected readonly pageSizes = this.pageSizePref.sizes;
  private syncedInitialPageSize = false;
  private lastClickedId: string | null = null;
  private lastShiftKey = false;

  private readonly refreshTick = signal(0);
  private readonly activeSort = computed(() => this.sort() ?? this.body().sort ?? null);

  private readonly listBody = computed<OpportunitySearchBody>(() => {
    this.reloadToken();
    this.refreshTick();
    const base = this.body();
    const currentSort = this.activeSort();
    return {
      ...base,
      ...(currentSort ? { sort: currentSort } : {}),
    };
  });

  readonly list = opportunityList(
    this.listBody,
    this.stage,
    this.page,
    this.pageSize,
    (nextPage) => this.page.set(nextPage),
    () => this.countsChanged.emit(),
  );

  private readonly patches = linkedSignal({
    source: () => ({
      body: this.body(),
      stage: this.stage(),
      sort: this.sort(),
      reloadToken: this.reloadToken(),
      tick: this.refreshTick(),
    }),
    computation: () => ({}) as Record<string, Partial<OpportunityRow>>,
  });

  readonly items = computed<OpportunityRow[]>(() => {
    const patchMap = this.patches();
    const activeStage = this.stage();
    return this.list
      .items()
      .map((item) => {
        const patch = patchMap[item.id];
        if (!patch) return item;
        if (patch.updatedAt && item.updatedAt > patch.updatedAt) return item;
        return { ...item, ...patch };
      })
      .filter((item) => !activeStage || activeStage === 'all' || item.stageId === activeStage);
  });

  private readonly filteredOutCount = computed(() => {
    const patchMap = this.patches();
    const activeStage = this.stage();
    if (!activeStage || activeStage === 'all') return 0;
    let removed = 0;
    for (const item of this.list.items()) {
      const patch = patchMap[item.id];
      if (!patch) continue;
      if (patch.updatedAt && item.updatedAt > patch.updatedAt) continue;
      if ((patch.stageId ?? item.stageId) !== activeStage) removed++;
    }
    return removed;
  });

  readonly totalCount = linkedSignal<{ total: number; loading: boolean; filteredOut: number }, number>({
    source: () => ({
      total: this.list.total(),
      loading: this.list.loading(),
      filteredOut: this.filteredOutCount(),
    }),
    computation: ({ total, loading, filteredOut }, previous) =>
      loading && total === 0 ? (previous?.value ?? 0) : Math.max(0, total - filteredOut),
  });

  protected readonly currentPageIds = computed<string[]>(() => this.items().map((item) => item.id));

  protected readonly pageState = computed<'none' | 'some' | 'all'>(() => {
    const sel = this.selection();
    const ids = this.currentPageIds();
    return sel && ids.length > 0 ? sel.pageState(ids) : 'none';
  });

  protected readonly hovered = signal<{ opportunityId: string; value: number } | null>(null);

  protected readonly phoneSources = computed<Record<string, PhoneActionSource>>(() => {
    const map: Record<string, PhoneActionSource> = {};
    for (const row of this.items()) {
      map[row.id] = opportunityPhoneSource(row);
    }
    return map;
  });

  constructor() {
    effect(() => this.searchError.emit(this.list.error()));
    effect(() => this.readOnlyChange.emit(this.list.readOnly()));
    let lastPage = this.page();
    effect(() => {
      const current = this.page();
      if (current === lastPage) return;
      lastPage = current;
      this.host.nativeElement.closest('main')?.scrollTo({ top: 0 });
    });

    effect(() => {
      const state = this.pageState();
      const input = this.headerCheckboxEl()?.nativeElement.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement | null;
      if (input) {
        input.indeterminate = state === 'some';
      }
    });

    effect(() => {
      const sizes = this.pageSizePref.sizes();
      const preferred = this.pageSizePref.size();
      const current = this.pageSize();
      untracked(() => {
        if (!this.syncedInitialPageSize) {
          this.syncedInitialPageSize = true;
          if (current === DEFAULT_LIST_PAGE_SIZE && preferred !== current && sizes.includes(preferred)) {
            this.pageSize.set(preferred);
          } else if (!sizes.includes(current)) {
            this.pageSize.set(preferred);
          }
          return;
        }
        if (!sizes.includes(current)) {
          this.pageSize.set(preferred);
        }
      });
    });
  }

  refresh(): void {
    this.patches.set({});
    this.refreshTick.update((n) => n + 1);
  }

  hasItem(id: string): boolean {
    return this.items().some((item) => item.id === id);
  }

  patchItem(row: Partial<OpportunityRow> & { id: string }): void {
    this.patches.update((current) => ({ ...current, [row.id]: { ...current[row.id], ...row } }));
  }

  navContext(): RecordNavContext {
    const ids = this.items().map((item) => item.id);
    const currentPage = this.page();
    const limit = this.pageSize();
    const totalMatching = this.totalCount();
    const remainingTotal = Math.max(ids.length, totalMatching - (currentPage - 1) * limit);
    const query = this.list.query();
    let nextPage = currentPage + 1;
    let hasMore = ids.length < remainingTotal;

    return {
      ids,
      total: remainingTotal,
      loadMore: hasMore
        ? async () => {
            if (!hasMore) return [];
            const res = await searchOpportunities(query, nextPage, limit);
            hasMore = res.hasNext;
            nextPage += 1;
            return res.items.map((item) => item.id);
          }
        : null,
    };
  }

  protected canUpdate(row: OpportunityRow): boolean {
    return !this.list.readOnly() && !this.list.conflict() && canUpdateOpportunity(this.capabilities(), row);
  }

  protected canDelete(row: OpportunityRow): boolean {
    return !this.list.readOnly() && !this.list.conflict() && canDeleteOpportunity(this.capabilities(), row);
  }

  protected canMove(row: OpportunityRow): boolean {
    return !this.list.readOnly() && !this.list.conflict() && canMoveOpportunity(this.capabilities(), row);
  }

  protected canTransfer(row: OpportunityRow): boolean {
    return !this.list.readOnly() && !this.list.conflict() && canTransferOpportunity(this.capabilities(), row);
  }

  protected sortField(): OpportunitySortKey | null {
    const active = this.activeSort();
    if (!active) return null;
    const field = active.split(':')[0]?.trim();
    if (
      field === 'title' ||
      field === 'amount' ||
      field === 'probabilityPercent' ||
      field === 'expectedCloseDate'
    ) {
      return field;
    }
    return null;
  }

  protected sortDir(): 'ASC' | 'DESC' | null {
    const active = this.activeSort();
    if (!active) return null;
    const rawDir = active.split(':')[1]?.trim().toUpperCase();
    return rawDir === 'ASC' ? 'ASC' : rawDir === 'DESC' ? 'DESC' : null;
  }

  protected ariaSort(key: OpportunitySortKey | undefined): 'ascending' | 'descending' | 'none' | null {
    if (!key) return null;
    if (this.sortField() !== key) return 'none';
    return this.sortDir() === 'ASC' ? 'ascending' : 'descending';
  }

  protected sortIcon(key: OpportunitySortKey): string {
    if (this.sortField() !== key) return 'tablerArrowsSort';
    return this.sortDir() === 'ASC' ? 'tablerArrowUp' : 'tablerArrowDown';
  }

  protected toggleSort(col: OpportunityTableColumnDef): void {
    if (!col.sortKey) return;
    const key = col.sortKey;
    const initialDir = col.defaultDir ?? 'ASC';
    const oppositeDir = initialDir === 'ASC' ? 'DESC' : 'ASC';

    if (this.sortField() !== key) {
      this.sort.set(`${key}:${initialDir}`);
    } else if (this.sortDir() === initialDir) {
      this.sort.set(`${key}:${oppositeDir}`);
    } else {
      this.sort.set(null);
    }

    if (this.page() !== 1) {
      this.page.set(1);
    }
  }

  protected customerName(row: OpportunityRow): string | null {
    return opportunityCustomerName(row);
  }

  protected contactName(row: OpportunityRow): string | null {
    return opportunityContactName(row);
  }

  protected stageName(row: OpportunityRow): string {
    const found = this.stages().find((item) => item.id === row.stageId);
    return found ? stageLabel(found, this.language()) : '';
  }

  protected stageBadge(row: OpportunityRow): string {
    return stageBadgeClass(row.stageFlag);
  }

  protected retryLoad(): void {
    if (this.mismatch()) window.location.reload();
    else this.list.reload();
  }

  protected readonly filterError = computed(() => opportunitySearchErrorKey(this.list.error()) !== null);
  protected readonly forbidden = computed(() => this.list.error() instanceof ApiError && (this.list.error() as ApiError).status === 403);
  protected readonly correlationId = computed(() => correlationIdOf(this.list.error()) ?? '');
  protected readonly mismatch = computed(() => {
    const error = this.list.error();
    return error instanceof ApiError && (error.code === 'GW.IDEM.MISMATCH' || error.code.endsWith('_IDEMPOTENCY_MISMATCH'));
  });
  protected readonly failureTitle = computed(() => {
    this.i18n();
    if (this.mismatch()) return this.transloco.translate('apiErrors.idempotencyMismatch');
    const error = this.list.error();
    if (error instanceof ApiError && error.status === 429) {
      const seconds = error.details?.['retryAfterSeconds'];
      return Array.isArray(seconds) && seconds[0]
        ? this.transloco.translate('apiErrors.rateLimitedIn', { seconds: seconds[0] })
        : this.transloco.translate('apiErrors.rateLimited');
    }
    return this.transloco.translate(this.forbidden() ? 'opportunities.page.forbidden' : 'opportunities.list.loadFailed');
  });

  protected amountText(row: OpportunityRow): string | null {
    if (row.amount === null) return null;
    this.i18n();
    const formatted = formatMoney(row.amount, row.currencyCode, this.language());
    if (formatted === '—') return null;
    const noCurrencyKey = moneyNoCurrencyKey(row.amount, row.currencyCode);
    return noCurrencyKey ? `${formatted} ${this.transloco.translate(noCurrencyKey)}` : formatted;
  }

  protected closeDateText(row: OpportunityRow): string | null {
    return formatShortDate(row.expectedCloseDate, this.language());
  }

  protected closeDateOverdue(row: OpportunityRow): boolean {
    return isCloseDateOverdue(row);
  }

  protected dueKey(row: OpportunityRow): 'OVERDUE' | 'TODAY' | 'FUTURE' | 'NONE' {
    return activityDueBucket(row.activityState) ?? 'NONE';
  }

  protected dueClass(row: OpportunityRow): string {
    return DUE_BADGE[this.dueKey(row)];
  }

  protected phone(row: OpportunityRow): string | null {
    return opportunityPhone(row);
  }

  protected phoneSource(row: OpportunityRow): PhoneActionSource {
    return this.phoneSources()[row.id] ?? opportunityPhoneSource(row);
  }

  protected ratingValue(row: OpportunityRow): number {
    const current = this.hovered();
    return current?.opportunityId === row.id ? current.value : row.importance;
  }

  protected rate(row: OpportunityRow, star: number): void {
    if (!this.canUpdate(row)) return;
    this.hovered.set(null);
    void this.list.rate(row, star === row.importance ? 0 : star);
  }

  protected actions(row: OpportunityRow) {
    this.i18n();
    return opportunityActions(
      row,
      this.stages().filter((stage) => stage.pipelineId === row.pipelineId),
      this.language(),
      {
        canUpdate: this.canUpdate(row),
        canDelete: this.canDelete(row),
        canMove: this.canMove(row),
        canTransfer: this.canTransfer(row),
      },
      (key) => this.transloco.translate(key),
    );
  }

  protected act(row: OpportunityRow, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.emitOpen(row);
        break;
      case 'move': {
        if (!selection.value || !this.canMove(row)) break;
        const target = this.stages().find((item) => item.id === selection.value && item.pipelineId === row.pipelineId);
        if (target) void this.list.move(row, target);
        break;
      }
      case 'transfer':
        this.transfer.emit(row);
        break;
      case 'color':
        if (this.canUpdate(row)) {
          void this.list.recolor(row, (selection.value as CardColor | null) ?? null);
        }
        break;
      case 'activities':
        this.activities.emit(row);
        break;
      case 'delete':
        void this.remove(row);
        break;
    }
  }

  protected emitOpen(row: OpportunityRow): void {
    this.open.emit({ row, nav: this.navContext() });
  }

  protected onPageSizeChange(size: number): void {
    if (!this.pageSizes().includes(size)) return;
    this.pageSizePref.set(size);
    if (size !== this.pageSize()) {
      this.pageSize.set(size);
      this.page.set(1);
    }
  }

  protected isSelected(id: string): boolean {
    return this.selection()?.isSelected(id) ?? false;
  }

  protected togglePage(cb?: Checkbox): void {
    const sel = this.selection();
    const rows = this.items();
    if (!sel || rows.length === 0) {
      cb?.checked.set(false);
      return;
    }
    if (sel.togglePage) {
      sel.togglePage(rows);
    } else if (sel.setRows) {
      sel.setRows(rows, this.pageState() !== 'all');
    } else {
      const selectAll = this.pageState() !== 'all';
      for (const row of rows) {
        if (sel.isSelected(row.id) !== selectAll) {
          sel.toggle(row);
        }
      }
    }
    cb?.checked.set(this.pageState() === 'all');
  }

  protected onRowCheckboxClick(event: MouseEvent): void {
    this.lastShiftKey = event.shiftKey;
    event.stopPropagation();
  }

  protected onRowCheckedChange(row: OpportunityRow, cb?: Checkbox): void {
    const shift = this.lastShiftKey;
    this.lastShiftKey = false;
    this.applyRowSelection(row, shift);
    cb?.checked.set(this.isSelected(row.id));
  }

  protected onSelectCellClick(event: MouseEvent, row: OpportunityRow, cb?: Checkbox): void {
    event.stopPropagation();
    if (!this.selection()) return;
    this.applyRowSelection(row, event.shiftKey);
    cb?.checked.set(this.isSelected(row.id));
  }

  protected onRowKeydown(event: KeyboardEvent, row: OpportunityRow): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === ' ' || event.code === 'Space') {
      if (!this.selection()) return;
      event.preventDefault();
      this.applyRowSelection(row, event.shiftKey);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.emitOpen(row);
    }
  }

  private applyRowSelection(row: OpportunityRow, shiftKey: boolean): void {
    const sel = this.selection();
    if (!sel) return;
    const rows = this.items();
    if (shiftKey && this.lastClickedId) {
      const startIndex = rows.findIndex((item) => item.id === this.lastClickedId);
      const endIndex = rows.findIndex((item) => item.id === row.id);
      if (startIndex !== -1 && endIndex !== -1) {
        const from = Math.min(startIndex, endIndex);
        const to = Math.max(startIndex, endIndex);
        const range = rows.slice(from, to + 1);
        if (sel.setRows) {
          sel.setRows(range, true);
        } else {
          for (const item of range) {
            if (!sel.isSelected(item.id)) sel.toggle(item);
          }
        }
        this.lastClickedId = row.id;
        return;
      }
    }
    sel.toggle(row);
    this.lastClickedId = row.id;
  }

  protected async remove(row: OpportunityRow): Promise<void> {
    if (!this.canDelete(row)) return;
    if (await this.confirmDialog().open()) {
      await this.list.remove(row);
    }
  }
}
