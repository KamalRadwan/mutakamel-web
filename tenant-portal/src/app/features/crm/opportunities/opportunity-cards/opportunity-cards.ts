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
import { TranslocoPipe } from '@jsverse/transloco';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import {
  DEFAULT_LIST_PAGE_SIZE,
  DEFAULT_LIST_PAGE_SIZES,
  createListPageSize,
} from '../../shared/record/list/page-size';
import { RecordNavContext } from '../../shared/record/nav/record-nav';
import { listPageSizes, searchOpportunities } from '../opportunities.api';
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
} from '../opportunity-card/opportunity-card';
import { opportunityList } from '../opportunity-list';

@Component({
  selector: 'app-opportunity-cards',
  imports: [TranslocoPipe, ConfirmDialog, Pagination, OpportunityCard],
  templateUrl: './opportunity-cards.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8' },
})
export class OpportunityCards {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly confirmDialog = viewChild.required(ConfirmDialog);

  readonly body = input.required<OpportunitySearchBody>();
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

  protected readonly skeletonCards = [1, 2, 3, 4, 5, 6];
  protected readonly pageSizePref = createListPageSize({
    storageKey: 'opportunities.cards.pageSize',
    sizes: DEFAULT_LIST_PAGE_SIZES,
    defaultSize: DEFAULT_LIST_PAGE_SIZE,
    load: listPageSizes,
  });
  private syncedInitialPageSize = false;

  private readonly refreshTick = signal(0);
  private readonly listBody = computed<OpportunitySearchBody>(() => {
    this.reloadToken();
    this.refreshTick();
    return { ...this.body() };
  });

  protected readonly list = opportunityList(
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
    return canUpdateOpportunity(this.capabilities(), row);
  }

  protected canDelete(row: OpportunityRow): boolean {
    return canDeleteOpportunity(this.capabilities(), row);
  }

  protected canMove(row: OpportunityRow): boolean {
    return canMoveOpportunity(this.capabilities(), row);
  }

  protected canTransfer(row: OpportunityRow): boolean {
    return canTransferOpportunity(this.capabilities(), row);
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
