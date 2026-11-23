import { Component, ElementRef, computed, effect, inject, input, linkedSignal, model, output, signal, untracked, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { DEFAULT_LIST_PAGE_SIZE, createListPageSize } from '../../shared/record/list/page-size';
import { listPageSizes } from '../lead-bulk/lead-bulk.api';
import { FALLBACK_PAGE_SIZES } from '../lead-bulk/lead-bulk.model';
import { LeadCard } from '../lead-card/lead-card';
import { LeadDisqualify } from '../lead-disqualify/lead-disqualify';
import { leadList } from '../lead-list';
import { LeadSearchBody } from '../lead-search/lead-search.compile';
import { LeadNavContext, LeadRow, LeadStage, LeadsCapabilities } from '../leads.model';

@Component({
  selector: 'app-lead-cards',
  imports: [TranslocoPipe, ConfirmDialog, ConflictDialog, FullState, Pagination, LeadCard, LeadDisqualify],
  templateUrl: './lead-cards.html',
  host: { class: 'flex flex-1 shrink-0 flex-col gap-8' },
})
export class LeadCards {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly confirmDialog = viewChild.required(ConfirmDialog);
  private readonly disqualifyDialog = viewChild(LeadDisqualify);

  readonly body = input.required<LeadSearchBody>();
  readonly capabilities = input<LeadsCapabilities | null>(null);
  readonly writeBlocked = output<void>();
  readonly stages = input.required<LeadStage[]>();
  readonly stage = input('all');
  readonly page = model(1);
  readonly pageSize = model(DEFAULT_LIST_PAGE_SIZE);
  readonly view = output<LeadRow>();
  readonly activities = output<LeadRow>();
  readonly countsChanged = output<void>();

  protected readonly skeletonCards = [1, 2, 3, 4, 5, 6];
  protected readonly pageSizePref = createListPageSize({
    storageKey: 'leads.cards.pageSize',
    sizes: FALLBACK_PAGE_SIZES,
    defaultSize: DEFAULT_LIST_PAGE_SIZE,
    load: listPageSizes,
  });
  private syncedInitialPageSize = false;

  private readonly refreshTick = signal(0);
  private readonly listBody = computed<LeadSearchBody>(() => {
    this.refreshTick();
    return { ...this.body() };
  });

  protected readonly list = leadList(
    this.listBody,
    this.stages,
    this.stage,
    this.page,
    this.pageSize,
    (nextPage) => this.page.set(nextPage),
    () => this.countsChanged.emit(),
    this.disqualifyDialog,
    this.capabilities,
  );

  private readonly patches = linkedSignal({
    source: () => ({ body: this.body(), stage: this.stage(), tick: this.refreshTick() }),
    computation: () => ({}) as Record<string, Partial<LeadRow>>,
  });

  protected readonly items = computed(() => {
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

  protected readonly totalCount = linkedSignal<{ total: number; loading: boolean; filteredOut: number }, number>({
    source: () => ({
      total: this.list.total(),
      loading: this.list.loading(),
      filteredOut: this.filteredOutCount(),
    }),
    computation: ({ total, loading, filteredOut }, previous) =>
      loading && total === 0 ? (previous?.value ?? 0) : Math.max(0, total - filteredOut),
  });

  protected readonly deletingName = signal('');

  constructor() {
    effect(() => { if (this.list.writes.readOnly()) this.writeBlocked.emit(); });
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

  patchItem(row: Partial<LeadRow> & { id: string }): void {
    this.patches.update((current) => ({ ...current, [row.id]: { ...current[row.id], ...row } }));
  }

  navContext(): LeadNavContext {
    const ids = this.items().map((item) => item.id);
    return {
      ids,
      total: ids.length,
      loadMore: null,
    };
  }

  protected onPageSizeChange(size: number): void {
    if (!this.pageSizePref.sizes().includes(size)) return;
    this.pageSizePref.set(size);
    if (size !== this.pageSize()) {
      this.pageSize.set(size);
    }
  }

  protected async remove(lead: LeadRow) {
    this.deletingName.set(lead.displayName);
    if (await this.confirmDialog().open()) await this.list.remove(lead);
  }
}
