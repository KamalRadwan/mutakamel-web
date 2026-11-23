import { Signal, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../core/notify/notify';
import { ApiError, sharedErrorKeyOf } from '../../../core/api/api-errors';
import { DEFAULT_LIST_PAGE_SIZE } from '../shared/record/list/page-size';
import {
  OPPORTUNITY_ERROR_KEYS,
  deleteOpportunity,
  getOpportunity,
  patchOpportunity,
  searchOpportunities,
} from './opportunities.api';
import {
  CardColor,
  OpportunityRow,
  OpportunitySearchBody,
  Page,
  PipelineStageView,
  WireNode,
} from './opportunities.model';
import { MoveOutcome, OpportunityMoves } from './opportunity-moves/opportunity-moves';

interface RowConflict {
  row: OpportunityRow;
  patch: { importance?: number; cardColor?: CardColor | null };
}

export interface OpportunityListStore {
  readonly query: Signal<OpportunitySearchBody>;
  readonly items: Signal<OpportunityRow[]>;
  readonly total: Signal<number>;
  readonly loading: Signal<boolean>;
  readonly failed: Signal<boolean>;
  readonly error: Signal<unknown>;
  readonly conflict: Signal<RowConflict | null>;
  readonly readOnly: Signal<boolean>;
  resolveConflict(reload: boolean): Promise<void>;
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
  const conflict = linkedSignal<string, RowConflict | null>({
    source: () => body().branchId,
    computation: () => null,
  });
  const readOnly = linkedSignal({ source: () => body().branchId, computation: () => false });
  let resolvingConflict = false;

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

  const pageResource = resource({
    params: () =>
      body().branchId ? { query: query(), page: page(), pageSize: pageSize() } : undefined,
    loader: async ({ params }) => {
      const res = await searchOpportunities(params.query, params.page, params.pageSize);
      if (res.items.length === 0 && params.page > 1) {
        const target = Math.max(1, Math.min(params.page - 1, res.totalPages || 1));
        if (target !== params.page) {
          onPageChange?.(target);
          return searchOpportunities(params.query, target, params.pageSize);
        }
      }
      return res;
    },
  });

  const pageData = linkedSignal<Page<OpportunityRow> | undefined>(() =>
    pageResource.hasValue() ? pageResource.value() : undefined,
  );

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
    if (
      outcome.kind === 'failed' &&
      [
        'CRM_OPPORTUNITIES_DISABLED',
        'CRM_SUBSCRIPTION_READ_ONLY',
        'SEAT_OVER_CAPACITY_READ_ONLY',
      ].includes(outcome.code ?? '')
    )
      readOnly.set(true);
    return outcome;
  }

  function replaceRow(id: string, changes: Partial<OpportunityRow>): void {
    pageData.update((current) =>
      current
        ? {
            ...current,
            items: current.items.map((row) => (row.id === id ? { ...row, ...changes } : row)),
          }
        : current,
    );
  }

  function writeError(error: unknown, fallback: string): void {
    if (error instanceof ApiError) {
      if (
        [
          'CRM_OPPORTUNITIES_DISABLED',
          'CRM_SUBSCRIPTION_READ_ONLY',
          'SEAT_OVER_CAPACITY_READ_ONLY',
        ].includes(error.code)
      )
        readOnly.set(true);
      if (error.status === 401) {
        notify.error(transloco.translate('apiErrors.notSaved'));
        return;
      }
      if (
        error.code === 'CRM_SUBSCRIPTION_READ_ONLY' ||
        error.code === 'SEAT_OVER_CAPACITY_READ_ONLY'
      ) {
        notify.error(transloco.translate('apiErrors.subscription'));
        return;
      }
      if (error.status === 403 && error.code !== 'CRM_OPPORTUNITIES_DISABLED') {
        notify.error(transloco.translate('apiErrors.permission'));
        return;
      }
    }
    const code = error instanceof ApiError ? error.code : '';
    const mapped = OPPORTUNITY_ERROR_KEYS[code];
    const shared = sharedErrorKeyOf(code);
    notify.error(
      transloco.translate(
        mapped?.startsWith('opportunities.') ? mapped : shared ? `apiErrors.${shared}` : fallback,
      ),
    );
  }

  async function updateRow(row: OpportunityRow, patch: RowConflict['patch']): Promise<void> {
    if (readOnly() || conflict()) return;
    replaceRow(row.id, patch);
    try {
      const saved = await patchOpportunity(row.id, { ...patch, expectedUpdatedAt: row.updatedAt });
      replaceRow(row.id, saved);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CRM.OPPORTUNITY.CONCURRENT_UPDATE') {
        conflict.set({ row, patch });
        return;
      }
      replaceRow(row.id, row);
      writeError(
        error,
        patch.importance !== undefined
          ? 'opportunities.card.rateFailed'
          : 'opportunities.card.colorFailed',
      );
    }
  }

  async function resolveConflict(reload: boolean): Promise<void> {
    const pending = conflict();
    if (!pending || resolvingConflict) return;
    resolvingConflict = true;
    try {
      const latest = await getOpportunity(pending.row.id);
      replaceRow(
        pending.row.id,
        reload ? latest : { ...pending.row, ...pending.patch, updatedAt: latest.updatedAt },
      );
    } catch (error) {
      writeError(error, 'opportunities.list.loadFailed');
    } finally {
      conflict.set(null);
      resolvingConflict = false;
    }
  }

  function rate(row: OpportunityRow, importance: number): Promise<void> {
    return updateRow(row, { importance });
  }
  function recolor(row: OpportunityRow, cardColor: CardColor | null): Promise<void> {
    return updateRow(row, { cardColor });
  }

  async function remove(row: OpportunityRow): Promise<boolean> {
    if (readOnly() || conflict()) return false;
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
      writeError(error, 'opportunities.list.deleteFailed');
      return false;
    }
  }

  return {
    query,
    items: computed(() => pageData()?.items ?? []),
    total: computed(() => pageData()?.total ?? 0),
    loading: pageResource.isLoading,
    failed: computed(() => !!pageResource.error()),
    error: pageResource.error,
    conflict,
    readOnly,
    resolveConflict,
    reload: () => pageResource.reload(),
    move,
    rate,
    recolor,
    remove,
  };
}
