import { Signal, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../core/notify/notify';
import { ApiError } from '../settings/shared/settings-api';
import { DEFAULT_LIST_PAGE_SIZE } from '../shared/record/list/page-size';
import { deleteOpportunity, patchOpportunity, searchOpportunities } from './opportunities.api';
import {
  CardColor,
  OpportunityRow,
  OpportunitySearchBody,
  Page,
  PipelineStageView,
  WireNode,
} from './opportunities.model';
import { isConflictError, opportunityErrorMessage } from './opportunity-card/opportunity-card';
import { MoveOutcome, OpportunityMoves } from './opportunity-moves/opportunity-moves';

export interface OpportunityListStore {
  readonly query: Signal<OpportunitySearchBody>;
  readonly items: Signal<OpportunityRow[]>;
  readonly total: Signal<number>;
  readonly loading: Signal<boolean>;
  readonly failed: Signal<boolean>;
  reload(): void;
  move(row: OpportunityRow, stage: PipelineStageView): Promise<MoveOutcome>;
  rate(row: OpportunityRow, importance: number): Promise<void>;
  recolor(row: OpportunityRow, cardColor: CardColor | null): Promise<void>;
  remove(row: OpportunityRow): Promise<boolean>;
}

/** Paged opportunity list store for Cards and Table views: offset paging per search and stage, plus row actions. */
export function opportunityList(
  body: Signal<OpportunitySearchBody>,
  stageId: Signal<string> = signal('all'),
  page: Signal<number> = signal(1),
  pageSize: Signal<number> = signal(DEFAULT_LIST_PAGE_SIZE),
  onPageChange?: (page: number) => void,
  onChanged?: () => void,
): OpportunityListStore {
  const notify = inject(Notify);
  const transloco = inject(TranslocoService);
  const moves = inject(OpportunityMoves, { optional: true });

  const query = computed<OpportunitySearchBody>(() => {
    const base = body();
    const activeStage = stageId();
    if (!activeStage || activeStage === 'all') return base;
    const stageLeaf: WireNode = { field: 'stageId', operator: 'eq', value: activeStage };
    const filterTree: WireNode = base.filterTree
      ? { op: 'AND', children: [base.filterTree, stageLeaf] }
      : stageLeaf;
    return { ...base, filterTree };
  });

  let lastPage: Page<OpportunityRow> | undefined;
  const pageResource = resource({
    params: () => ({ query: query(), page: page(), pageSize: pageSize() }),
    loader: async ({ params }) => {
      try {
        const res = await searchOpportunities(params.query, params.page, params.pageSize);
        if (res.items.length === 0 && params.page > 1) {
          const target = Math.max(1, Math.min(params.page - 1, res.totalPages || 1));
          if (target !== params.page) {
            onPageChange?.(target);
            const fallback = await searchOpportunities(params.query, target, params.pageSize);
            lastPage = fallback;
            return fallback;
          }
        }
        lastPage = res;
        return res;
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          notify.error(transloco.translate('opportunities.list.invalidSearch'));
          return lastPage;
        }
        throw error;
      }
    },
  });

  const pageData = linkedSignal<Page<OpportunityRow> | undefined>(() => pageResource.value());

  async function move(row: OpportunityRow, stage: PipelineStageView): Promise<MoveOutcome> {
    if (!moves || row.stageId === stage.id) {
      return { kind: 'cancelled' };
    }
    const outcome = await moves.move(row, stage);
    if (outcome.kind === 'moved') {
      onChanged?.();
      pageResource.reload();
    } else if (outcome.kind === 'failed' && outcome.code === 'CRM.OPPORTUNITY.STALE_MOVE') {
      pageResource.reload();
    }
    return outcome;
  }

  async function rate(row: OpportunityRow, importance: number): Promise<void> {
    const prevImportance = row.importance;
    pageData.update((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === row.id ? { ...item, importance } : item)),
          }
        : current,
    );

    try {
      const saved = await patchOpportunity(row.id, {
        importance,
        expectedUpdatedAt: row.updatedAt,
      });
      pageData.update((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) => (item.id === row.id ? saved : item)),
            }
          : current,
      );
    } catch (error) {
      pageData.update((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === row.id ? { ...item, importance: prevImportance } : item,
              ),
            }
          : current,
      );
      if (isConflictError(error)) {
        notify.error(transloco.translate('opportunities.list.refreshed'));
        pageResource.reload();
        return;
      }
      notify.error(opportunityErrorMessage(error, transloco, 'opportunities.card.rateFailed'));
    }
  }

  async function recolor(row: OpportunityRow, cardColor: CardColor | null): Promise<void> {
    const prevColor = row.cardColor;
    pageData.update((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === row.id ? { ...item, cardColor } : item)),
          }
        : current,
    );

    try {
      const saved = await patchOpportunity(row.id, {
        cardColor,
        expectedUpdatedAt: row.updatedAt,
      });
      pageData.update((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) => (item.id === row.id ? saved : item)),
            }
          : current,
      );
    } catch (error) {
      pageData.update((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === row.id ? { ...item, cardColor: prevColor } : item,
              ),
            }
          : current,
      );
      if (isConflictError(error)) {
        notify.error(transloco.translate('opportunities.list.refreshed'));
        pageResource.reload();
        return;
      }
      notify.error(opportunityErrorMessage(error, transloco, 'opportunities.card.colorFailed'));
    }
  }

  async function remove(row: OpportunityRow): Promise<boolean> {
    const before = pageData();
    pageData.update((current) =>
      current
        ? {
            ...current,
            items: current.items.filter((item) => item.id !== row.id),
            total: Math.max(0, current.total - 1),
          }
        : current,
    );

    try {
      await deleteOpportunity(row.id);
      onChanged?.();
      notify.success(transloco.translate('opportunities.list.deleted'));
      pageResource.reload();
      return true;
    } catch (error) {
      pageData.set(before);
      notify.error(opportunityErrorMessage(error, transloco, 'opportunities.list.deleteFailed'));
      return false;
    }
  }

  return {
    query,
    items: computed(() => pageData()?.items ?? []),
    total: computed(() => pageData()?.total ?? 0),
    loading: pageResource.isLoading,
    failed: computed(() => !!pageResource.error()),
    reload: () => pageResource.reload(),
    move,
    rate,
    recolor,
    remove,
  };
}
