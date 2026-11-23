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
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { ApiError, correlationIdOf } from '../../../../core/api/api-errors';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import {
  DEFAULT_LIST_PAGE_SIZE,
  createListPageSize,
} from '../../shared/record/list/page-size';
import { RecordNavContext } from '../../shared/record/nav/record-nav';
import { listPageSizes, loadOpportunityCards } from '../opportunities.api';
import {
  OpportunityCapabilities,
  OpportunityRow,
  OpportunitySearchBody,
  PipelineStageView,
} from '../opportunities.model';
import {
  OpportunityCard,
  OpportunityOpenEvent,
  canDeleteOpportunity,
  canMoveOpportunity,
  canTransferOpportunity,
  canUpdateOpportunity,
  opportunityErrorMessage,
} from '../opportunity-card/opportunity-card';
import { opportunityCardsList } from './opportunity-cards-list';
import { opportunitySearchErrorKey } from '../opportunity-search/opportunity-search.compile';

@Component({
  selector: 'app-opportunity-cards',
  imports: [TranslocoPipe, ConfirmDialog, Pagination, OpportunityCard, FullState, ConflictDialog],
  providers: [provideTranslocoScope('opportunities', { scope: 'record-list', alias: 'recordList' }, { scope: 'opportunity-moves', alias: 'oppMoves' })],
  templateUrl: './opportunity-cards.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8' },
})
export class OpportunityCards {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly confirmDialog = viewChild.required(ConfirmDialog);

  readonly body = input.required<OpportunitySearchBody>();
  readonly pipelineId = input('');
  readonly stages = input.required<PipelineStageView[]>();
  readonly stage = input('all');
  readonly page = model(1);
  readonly pageSize = model(DEFAULT_LIST_PAGE_SIZE);
  readonly capabilities = input<OpportunityCapabilities | null>(null);
  readonly reloadToken = input(0);

  readonly open = output<OpportunityOpenEvent<OpportunityRow>>();
  readonly activities = output<OpportunityRow>();
  readonly transfer = output<OpportunityRow>();
  readonly countsChanged = output<void>();
  readonly searchError = output<unknown>();
  readonly readOnlyChange = output<boolean>();

  protected readonly skeletonCards = [1, 2, 3, 4, 5, 6];
  protected readonly pageSizePref = createListPageSize({
    storageKey: 'opportunities.cards.pageSize',
    sizes: [50, 100],
    defaultSize: 50,
    load: async () => {
      const preference = await listPageSizes();
      const pageSizes = preference.pageSizes.filter((size) => size === 50 || size === 100);
      return { pageSizes: pageSizes.length ? pageSizes : [50, 100], defaultPageSize: preference.defaultPageSize === 100 ? 100 : 50 };
    },
  });
  private syncedInitialPageSize = false;

  private readonly refreshTick = signal(0);
  private readonly listBody = computed<OpportunitySearchBody>(() => {
    this.reloadToken();
    this.refreshTick();
    return { ...this.body() };
  });

  protected readonly list = opportunityCardsList(
    this.pipelineId,
    this.listBody,
    this.stage,
    this.page,
    this.pageSize,
    (nextPage) => this.page.set(nextPage),
    () => this.countsChanged.emit(),
  );
  protected readonly filterError = computed(() => !!opportunitySearchErrorKey(this.list.error()));
  protected readonly forbidden = computed(() => {
    const error = this.list.error();
    return error instanceof ApiError && error.status === 403;
  });
  protected readonly correlationId = computed(() => correlationIdOf(this.list.error()) ?? '');
  protected readonly mismatch = computed(() => {
    const error = this.list.error();
    return error instanceof ApiError && (error.code === 'GW.IDEM.MISMATCH' || error.code.endsWith('_IDEMPOTENCY_MISMATCH'));
  });
  protected readonly failureTitle = computed(() => {
    this.i18n();
    const error = this.list.error();
    return error instanceof ApiError && error.status === 429
      ? opportunityErrorMessage(error, this.transloco, 'opportunities.list.loadFailed')
      : this.transloco.translate(this.mismatch() ? 'apiErrors.idempotencyMismatch' : this.forbidden() ? 'opportunities.page.forbidden' : 'opportunities.list.loadFailed');
  });
  protected retryLoad(): void {
    if (this.mismatch()) { window.location.reload(); return; }
    this.list.reload();
  }

  private readonly patches = linkedSignal({
    source: () => ({
      body: this.body(),
      stage: this.stage(),
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
    let cursor = this.list.nextCursor();

    return {
      ids,
      total: remainingTotal,
      loadMore: cursor
        ? async () => {
            if (!cursor) return [];
            const res = await loadOpportunityCards(this.pipelineId(), { ...query, cursor, limit: limit === 100 ? 100 : 50 });
            cursor = res.pageInfo.nextCursor;
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

  protected onMoveTo(row: OpportunityRow, stageId: string): void {
    const target = this.stages().find((item) => item.id === stageId);
    if (!target || !this.canMove(row)) return;
    void this.list.move(row, target);
  }

  protected onOpen(row: OpportunityRow): void {
    this.open.emit({ row, nav: this.navContext() });
  }

  protected onPageSizeChange(size: number): void {
    if (!this.pageSizePref.sizes().includes(size)) return;
    this.pageSizePref.set(size);
    if (size !== this.pageSize()) {
      this.pageSize.set(size);
    }
  }

  protected async remove(row: OpportunityRow): Promise<void> {
    if (!this.canDelete(row)) return;
    if (await this.confirmDialog().open()) {
      await this.list.remove(row);
    }
  }
}
