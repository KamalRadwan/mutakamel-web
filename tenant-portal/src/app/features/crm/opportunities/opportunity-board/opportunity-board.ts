import {
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Button } from '../../../../shared/ui/button/button';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ApiError, errorCodeOf } from '../../settings/shared/settings-api';
import { RecordBoard } from '../../shared/record/board/record-board';
import {
  BoardLabels,
  BoardLane,
  BoardLaneTone,
  BoardMoveEvent,
} from '../../shared/record/board/record-board.model';
import { isDraggedRecord } from '../../shared/record/board/record-drag';
import { RecordNavContext } from '../../shared/record/nav/record-nav';
import { deleteOpportunity, getOpportunity, loadBoard, loadStagePage, patchOpportunity } from '../opportunities.api';
import {
  ActivitySummary,
  BOARD_LIMIT,
  BoardStage,
  CardColor,
  OpportunityBoardRow,
  OpportunityCapabilities,
  OpportunityRow,
  OpportunitySearchBody,
  PipelineStageView,
  PipelineView,
  formatMoney,
  isClosed,
  moneyNoCurrencyKey,
  stageLabel,
} from '../opportunities.model';
import { OpportunityMoves } from '../opportunity-moves/opportunity-moves';
import { isTerminalFlag, stageTone } from '../opportunity-stage-tone';
import {
  OpportunityCard,
  OpportunityOpenEvent,
  boardRowToOpportunityRow,
  canCreateOpportunity,
  canDeleteOpportunity,
  canMoveOpportunity,
  canTransferOpportunity,
  canUpdateOpportunity,
  isConflictError,
  opportunityErrorMessage,
  opportunityRowToBoardRow,
} from '../opportunity-card/opportunity-card';

const COLLAPSED_KEY = 'crm.opportunities.board.collapsed';
const MAX_VISIBLE_CURRENCIES = 2;

const DUE_SEGMENT_COLORS: readonly { key: keyof Omit<ActivitySummary, 'totalCount'>; dueKey: string; color: string }[] = [
  { key: 'overdueCount', dueKey: 'OVERDUE', color: 'bg-danger' },
  { key: 'todayCount', dueKey: 'TODAY', color: 'bg-warning' },
  { key: 'futureCount', dueKey: 'FUTURE', color: 'bg-success' },
  { key: 'noOpenCount', dueKey: 'NONE', color: 'bg-status-none' },
];

interface CurrencyDisplayItem {
  key: string;
  text: string;
  ariaLabel: string;
}

interface LaneTotalsDisplay {
  visible: CurrencyDisplayItem[];
  extraCount: number;
  allTitle: string;
}

@Component({
  selector: 'app-opportunity-board',
  imports: [TranslocoPipe, Button, ConfirmDialog, RecordBoard, OpportunityCard],
  providers: [provideTranslocoScope('opportunities', { scope: 'record-list', alias: 'recordList' })],
  templateUrl: './opportunity-board.html',
  host: { class: 'flex shrink-0 flex-col' },
})
export class OpportunityBoard {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly recordListLoaded = toSignal(
    this.transloco.selectTranslate('due.NONE', undefined, {
      scope: 'record-list',
      alias: 'recordList',
    }),
  );
  private readonly destroyRef = inject(DestroyRef);
  private readonly moves = inject(OpportunityMoves, { optional: true });
  private readonly confirmDialog = viewChild.required(ConfirmDialog);
  private readonly recordBoard = viewChild<RecordBoard<OpportunityBoardRow>>(RecordBoard);
  protected readonly language = inject(LanguageState).current;

  readonly pipeline = input.required<PipelineView>();
  readonly body = input.required<OpportunitySearchBody>();
  readonly capabilities = input<OpportunityCapabilities | null>(null);
  readonly reloadToken = input(0);

  readonly create = output<string>();
  readonly open = output<OpportunityOpenEvent<OpportunityRow>>();
  readonly activities = output<OpportunityRow>();
  readonly transfer = output<OpportunityRow>();
  readonly changed = output<void>();

  protected readonly skeletonLanes = [1, 2, 3, 4];
  protected readonly skeletonCards = [1, 2, 3];
  protected readonly collapseStorageKey = COLLAPSED_KEY;
  protected readonly itemId = (row: OpportunityBoardRow) => row.id;

  private readonly refreshTick = signal(0);
  private readonly draggingFromLaneId = signal<string | null>(null);
  private lastBoardPipelineId: string | null = null;
  private lastStages: BoardStage[] | undefined;

  private readonly boardResource = resource({
    params: () => ({
      pipelineId: this.pipeline().id,
      body: this.body(),
      reloadToken: this.reloadToken(),
      tick: this.refreshTick(),
    }),
    loader: async ({ params }) => {
      try {
        const res = await loadBoard(params.pipelineId, {
          ...params.body,
          limitPerStage: BOARD_LIMIT,
        });
        this.lastBoardPipelineId = params.pipelineId;
        this.lastStages = res.stages;
        return { pipelineId: params.pipelineId, stages: res.stages };
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          this.notify.error(this.transloco.translate('opportunities.list.invalidSearch'));
          if (this.lastBoardPipelineId === params.pipelineId && this.lastStages) {
            return { pipelineId: params.pipelineId, stages: this.lastStages };
          }
        }
        throw error;
      }
    },
  });

  protected readonly boardStages = linkedSignal<
    { pipelineId: string; loaded: { pipelineId: string; stages: BoardStage[] } | undefined },
    BoardStage[]
  >({
    source: () => ({ pipelineId: this.pipeline().id, loaded: this.boardResource.value() }),
    computation: ({ pipelineId, loaded }, previous) => {
      if (loaded && loaded.pipelineId === pipelineId) {
        return loaded.stages;
      }
      if (previous && this.lastBoardPipelineId === pipelineId) {
        return previous.value;
      }
      return [];
    },
  });

  protected readonly stages = computed<PipelineStageView[]>(() => {
    const fromBoard = this.boardStages().map((lane) => lane.stage);
    return fromBoard.length > 0 ? fromBoard : this.pipeline().stages;
  });

  protected readonly openCards = signal<Record<string, string>>({});
  protected readonly loadingMore = signal<string | null>(null);
  protected readonly loading = this.boardResource.isLoading;
  protected readonly failed = computed(() => !!this.boardResource.error());
  protected readonly totalItems = computed(() =>
    this.boardStages().reduce((sum, lane) => sum + lane.summary.totalCount, 0),
  );

  protected retryLoad(): void {
    this.boardResource.reload();
  }

  protected readonly canDragItem = (row: OpportunityBoardRow): boolean =>
    canMoveOpportunity(this.capabilities(), row);

  protected readonly laneTotals = computed<Record<string, LaneTotalsDisplay>>(() => {
    this.i18n();
    const lang = this.language();
    const map: Record<string, LaneTotalsDisplay> = {};
    for (const lane of this.boardStages()) {
      const formatted = lane.summary.amountsByCurrency.map((entry) => {
        const money = formatMoney(entry.amount, entry.currencyCode, lang);
        const noCurrencyKey = moneyNoCurrencyKey(entry.amount, entry.currencyCode);
        const text = noCurrencyKey ? `${money} ${this.transloco.translate(noCurrencyKey)}` : money;
        return {
          key: entry.currencyCode || 'UNSPECIFIED',
          text,
          ariaLabel: this.transloco.translate('opportunities.board.total', { amount: text }),
        };
      });
      map[lane.stage.id] = {
        visible: formatted.slice(0, MAX_VISIBLE_CURRENCIES),
        extraCount: Math.max(0, formatted.length - MAX_VISIBLE_CURRENCIES),
        allTitle: formatted.map((item) => item.text).join('\n'),
      };
    }
    return map;
  });

  protected readonly boardLanes = computed<BoardLane<OpportunityBoardRow>[]>(() => {
    this.i18n();
    const lang = this.language();
    const loadingStageId = this.loadingMore();
    const canCreate = canCreateOpportunity(this.capabilities());
    const fromLaneId = this.draggingFromLaneId();
    const fromStage = fromLaneId ? this.boardStages().find((item) => item.stage.id === fromLaneId)?.stage : null;
    const draggingFromTerminal = fromStage ? isTerminalFlag(fromStage.flag) : false;

    return this.boardStages().map((lane) => {
      const label = stageLabel(lane.stage, lang);
      const mappedTone = stageTone(lane.stage.flag);
      const tone: BoardLaneTone | undefined = mappedTone === 'neutral' ? undefined : mappedTone;
      const dropRule = !lane.stage.isActive
        ? 'deny'
        : isTerminalFlag(lane.stage.flag) || draggingFromTerminal
          ? 'confirm'
          : 'allow';
      const activeSegments = this.segments(lane.activitySummary);

      return {
        id: lane.stage.id,
        label,
        ...(tone ? { tone } : {}),
        total: lane.summary.totalCount,
        items: lane.items,
        hasNext: lane.pageInfo.hasMore,
        loading: loadingStageId === lane.stage.id,
        canCreate: lane.stage.isActive && !isTerminalFlag(lane.stage.flag) && canCreate,
        dropRule,
        ...(dropRule === 'deny'
          ? { denyReason: this.transloco.translate('opportunities.board.inactive') }
          : {}),
        statusSegments: activeSegments.map((segment) => ({
          key: segment.dueKey,
          count: segment.count,
          color: segment.color,
        })),
        statusSummary: this.dueSummary(activeSegments),
      };
    });
  });

  protected readonly boardLabels = computed<BoardLabels>(() => {
    this.i18n();
    return {
      add: (stage: string) => this.transloco.translate('opportunities.board.add', { stage }),
      empty: this.transloco.translate('opportunities.board.empty'),
      emptyHelp: this.transloco.translate('opportunities.board.emptyHelp'),
      allShown: this.transloco.translate('opportunities.board.allShown'),
    };
  });

  constructor() {
    afterNextRender(() => {
      const stopMonitor = monitorForElements({
        canMonitor: ({ source }) => isDraggedRecord(source.data),
        onDragStart: ({ source }) => {
          if (isDraggedRecord(source.data)) {
            this.draggingFromLaneId.set(source.data.fromLaneId);
          }
        },
        onDrop: () => this.draggingFromLaneId.set(null),
      });
      this.destroyRef.onDestroy(stopMonitor);
    });
  }

  refresh(): void {
    this.refreshTick.update((n) => n + 1);
  }

  hasItem(id: string): boolean {
    return this.boardStages().some((lane) => lane.items.some((item) => item.id === id));
  }

  patchItem(row: Partial<OpportunityRow> & { id: string }): void {
    this.boardStages.update((lanes) => {
      const fromLane = lanes.find((lane) => lane.items.some((item) => item.id === row.id));
      if (!fromLane) return lanes;
      const existing = fromLane.items.find((item) => item.id === row.id)!;

      const {
        customerPhone: _customerPhone,
        customerEmail: _customerEmail,
        customerCountry: _customerCountry,
        customerCity: _customerCity,
        primaryContact,
        leadSourceName: _leadSourceName,
        leadSourceIconUrl: _leadSourceIconUrl,
        ...boardPatch
      } = row;

      const updated: OpportunityBoardRow = {
        ...existing,
        ...boardPatch,
        contactDisplayName:
          primaryContact !== undefined ? (primaryContact?.displayName ?? null) : existing.contactDisplayName,
      };

      if (row.stageId && row.stageId !== fromLane.stage.id) {
        const toLane = lanes.find((lane) => lane.stage.id === row.stageId);
        if (toLane) {
          const moved: OpportunityBoardRow = {
            ...updated,
            stageId: toLane.stage.id,
            stageFlag: toLane.stage.flag,
          };
          return lanes.map((lane) => {
            if (lane.stage.id === fromLane.stage.id) {
              return {
                ...lane,
                items: lane.items.filter((item) => item.id !== row.id),
                summary: { ...lane.summary, totalCount: Math.max(0, lane.summary.totalCount - 1) },
              };
            }
            if (lane.stage.id === toLane.stage.id) {
              return {
                ...lane,
                items: [moved, ...lane.items],
                summary: { ...lane.summary, totalCount: lane.summary.totalCount + 1 },
              };
            }
            return lane;
          });
        }
      }

      return lanes.map((lane) =>
        lane.stage.id === fromLane.stage.id
          ? {
              ...lane,
              items: lane.items.map((item) => (item.id === row.id ? updated : item)),
            }
          : lane,
      );
    });
  }

  navContextFor(opportunityId: string): RecordNavContext | null {
    const lane = this.boardStages().find((item) => item.items.some((entry) => entry.id === opportunityId));
    if (!lane) return null;
    const stageId = lane.stage.id;
    return {
      ids: lane.items.map((item) => item.id),
      total: lane.summary.totalCount,
      loadMore: lane.pageInfo.hasMore
        ? async () => {
            const current = this.boardStages().find((item) => item.stage.id === stageId);
            if (current?.pageInfo.hasMore) {
              await this.loadMore(current);
            }
            const updated = this.boardStages().find((item) => item.stage.id === stageId);
            return updated ? updated.items.map((item) => item.id) : [];
          }
        : null,
    };
  }

  protected canUpdate(row: OpportunityBoardRow): boolean {
    return canUpdateOpportunity(this.capabilities(), row);
  }

  protected canDelete(row: OpportunityBoardRow): boolean {
    return canDeleteOpportunity(this.capabilities(), row);
  }

  protected canMove(row: OpportunityBoardRow): boolean {
    return canMoveOpportunity(this.capabilities(), row);
  }

  protected canTransfer(row: OpportunityBoardRow): boolean {
    return canTransferOpportunity(this.capabilities(), row);
  }

  protected setExpanded(stageId: string, opportunityId: string, expanded: boolean): void {
    this.openCards.update((current) => {
      if (expanded) return { ...current, [stageId]: opportunityId };
      if (current[stageId] !== opportunityId) return current;
      const { [stageId]: _removed, ...rest } = current;
      return rest;
    });
  }

  protected async onOpenCard(row: OpportunityBoardRow): Promise<void> {
    const nav = this.navContextFor(row.id) ?? { ids: [row.id], total: 1, loadMore: null };
    const full = await this.fetchFullRow(row);
    if (full) this.open.emit({ row: full, nav });
  }

  protected onActivitiesCard(row: OpportunityBoardRow): void {
    this.activities.emit(boardRowToOpportunityRow(row));
  }

  protected async onTransferCard(row: OpportunityBoardRow): Promise<void> {
    const full = await this.fetchFullRow(row);
    if (full) this.transfer.emit(full);
  }

  // Board rows lack customer contact and lead-source fields; hosts get the full record.
  private async fetchFullRow(row: OpportunityBoardRow): Promise<OpportunityRow | null> {
    try {
      return await getOpportunity(row.id);
    } catch (error) {
      this.notify.error(opportunityErrorMessage(error, this.transloco, 'opportunities.board.openFailed'));
      return null;
    }
  }

  protected onLoadMore(stageId: string): void {
    const lane = this.boardStages().find((item) => item.stage.id === stageId);
    if (lane) void this.loadMore(lane);
  }

  protected onBoardMove(event: BoardMoveEvent): void {
    void this.moveCard(event.id, event.from, event.to);
  }

  protected onCardMoveTo(row: OpportunityBoardRow, toStageId: string): void {
    void this.moveCard(row.id, row.stageId, toStageId);
  }

  protected async loadMore(lane: BoardStage): Promise<void> {
    const cursor = lane.pageInfo.nextCursor;
    if (!cursor) return;
    const pipelineId = this.pipeline().id;
    const body = this.body();
    this.loadingMore.set(lane.stage.id);
    try {
      const next = await loadStagePage(pipelineId, lane.stage.id, {
        ...body,
        limit: BOARD_LIMIT,
        cursor,
      });
      if (this.pipeline().id !== pipelineId) return;
      this.boardStages.update((lanes) =>
        lanes.map((item) => {
          if (item.stage.id !== lane.stage.id) return item;
          const existingIds = new Set(item.items.map((entry) => entry.id));
          const appended = next.items.filter((entry) => !existingIds.has(entry.id));
          return {
            ...item,
            items: [...item.items, ...appended],
            summary: next.summary,
            activitySummary: next.activitySummary,
            pageInfo: next.pageInfo,
          };
        }),
      );
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 400 &&
        errorCodeOf(error) === 'OPPORTUNITY_BOARD_CURSOR_INVALID'
      ) {
        void this.reloadLanes([lane.stage.id]);
        return;
      }
      const message =
        error instanceof ApiError && error.status === 400
          ? this.transloco.translate('opportunities.list.invalidSearch')
          : opportunityErrorMessage(error, this.transloco, 'opportunities.list.loadFailed');
      this.notify.error(message);
    } finally {
      this.loadingMore.set(null);
    }
  }

  protected async moveCard(id: string, fromStageId: string, toStageId: string): Promise<void> {
    const board = this.recordBoard();
    const lanes = this.boardStages();
    const fromLane = lanes.find((lane) => lane.stage.id === fromStageId);
    const toLane = lanes.find((lane) => lane.stage.id === toStageId);
    const item = fromLane?.items.find((entry) => entry.id === id);

    if (!fromLane || !toLane || !item || fromStageId === toStageId || !toLane.stage.isActive) {
      board?.revert(id);
      return;
    }

    if (!this.canMove(item) || !this.moves) {
      board?.revert(id);
      return;
    }

    // A Won/Lost close or a reopen asks first: the card stays in its lane while that dialog is open and moves
    // only when the move is saved. A plain pipeline move shows at once and reverts on failure.
    const row = boardRowToOpportunityRow(item);
    const needsDialog = isTerminalFlag(toLane.stage.flag) || isTerminalFlag(fromLane.stage.flag) || isClosed(row);
    if (needsDialog) board?.revert(id);
    else board?.applyMove(id, fromStageId, toStageId);
    const outcome = await this.moves.move(row, toLane.stage);

    if (outcome.kind === 'moved') {
      const movedRow = opportunityRowToBoardRow(outcome.row, item.contactDisplayName);
      this.boardStages.update((currentLanes) =>
        currentLanes.map((lane) => {
          if (lane.stage.id === fromStageId) {
            return {
              ...lane,
              items: lane.items.filter((entry) => entry.id !== id),
              summary: { ...lane.summary, totalCount: Math.max(0, lane.summary.totalCount - 1) },
            };
          }
          if (lane.stage.id === toStageId) {
            return {
              ...lane,
              items: [movedRow, ...lane.items.filter((entry) => entry.id !== id)],
              summary: { ...lane.summary, totalCount: lane.summary.totalCount + 1 },
            };
          }
          return lane;
        }),
      );
      board?.revert(id);
      this.changed.emit();
      void this.reloadLanes([fromStageId, toStageId]);
      return;
    }

    board?.revert(id);
    if (outcome.kind === 'failed' && outcome.code === 'CRM.OPPORTUNITY.STALE_MOVE') {
      void this.reloadLanes([fromStageId]);
    }
  }

  protected async rate(row: OpportunityBoardRow, importance: number): Promise<void> {
    if (!this.canUpdate(row)) return;
    const prevImportance = row.importance;
    this.patchBoardRow(row.id, { importance });

    try {
      const saved = await patchOpportunity(row.id, {
        importance,
        expectedUpdatedAt: row.updatedAt,
      });
      this.replaceBoardRow(row.id, opportunityRowToBoardRow(saved, row.contactDisplayName));
    } catch (error) {
      this.patchBoardRow(row.id, { importance: prevImportance });
      if (isConflictError(error)) {
        this.notify.error(this.transloco.translate('opportunities.board.refreshed'));
        void this.reloadLanes([row.stageId]);
        return;
      }
      this.notify.error(opportunityErrorMessage(error, this.transloco, 'opportunities.card.rateFailed'));
    }
  }

  protected async recolor(row: OpportunityBoardRow, cardColor: CardColor | null): Promise<void> {
    if (!this.canUpdate(row)) return;
    const prevColor = row.cardColor;
    this.patchBoardRow(row.id, { cardColor });

    try {
      const saved = await patchOpportunity(row.id, {
        cardColor,
        expectedUpdatedAt: row.updatedAt,
      });
      this.replaceBoardRow(row.id, opportunityRowToBoardRow(saved, row.contactDisplayName));
    } catch (error) {
      this.patchBoardRow(row.id, { cardColor: prevColor });
      if (isConflictError(error)) {
        this.notify.error(this.transloco.translate('opportunities.board.refreshed'));
        void this.reloadLanes([row.stageId]);
        return;
      }
      this.notify.error(opportunityErrorMessage(error, this.transloco, 'opportunities.card.colorFailed'));
    }
  }

  protected async remove(row: OpportunityBoardRow): Promise<void> {
    if (!this.canDelete(row)) return;
    if (!(await this.confirmDialog().open())) return;

    const before = this.boardStages();
    this.boardStages.update((lanes) =>
      lanes.map((lane) =>
        lane.items.some((item) => item.id === row.id)
          ? {
              ...lane,
              items: lane.items.filter((item) => item.id !== row.id),
              summary: { ...lane.summary, totalCount: Math.max(0, lane.summary.totalCount - 1) },
            }
          : lane,
      ),
    );

    try {
      await deleteOpportunity(row.id);
      this.notify.success(this.transloco.translate('opportunities.list.deleted'));
      this.changed.emit();
      void this.reloadLanes([row.stageId]);
    } catch (error) {
      this.boardStages.set(before);
      this.notify.error(opportunityErrorMessage(error, this.transloco, 'opportunities.list.deleteFailed'));
    }
  }

  private async reloadLanes(stageIds: readonly string[]): Promise<void> {
    const pipelineId = this.pipeline().id;
    const body = this.body();
    const targetIds = new Set(stageIds);
    try {
      const res = await loadBoard(pipelineId, {
        ...body,
        limitPerStage: BOARD_LIMIT,
      });
      if (this.pipeline().id !== pipelineId || this.body() !== body) return;
      const freshById = new Map(res.stages.map((lane) => [lane.stage.id, lane]));
      this.boardStages.update((current) =>
        current.flatMap((lane) => {
          if (!targetIds.has(lane.stage.id)) return [lane];
          const fresh = freshById.get(lane.stage.id);
          return fresh ? [fresh] : [];
        }),
      );
    } catch {
      // Background lane sum refresh failed silently; existing lane items remain usable.
    }
  }

  private patchBoardRow(id: string, patch: Partial<OpportunityBoardRow>): void {
    this.boardStages.update((lanes) =>
      lanes.map((lane) => ({
        ...lane,
        items: lane.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      })),
    );
  }

  private replaceBoardRow(id: string, replacement: OpportunityBoardRow): void {
    this.boardStages.update((lanes) =>
      lanes.map((lane) => ({
        ...lane,
        items: lane.items.map((item) => (item.id === id ? replacement : item)),
      })),
    );
  }

  private segments(summary: ActivitySummary) {
    return DUE_SEGMENT_COLORS.map((seg) => ({
      dueKey: seg.dueKey,
      count: summary[seg.key],
      color: seg.color,
    })).filter((seg) => seg.count > 0);
  }

  private dueSummary(active: readonly { dueKey: string; count: number }[]): string {
    this.i18n();
    this.recordListLoaded();
    if (!active.length) return this.transloco.translate('recordList.due.NONE');
    return active
      .map((seg) => `${this.transloco.translate(`recordList.due.${seg.dueKey}`)} ${seg.count}`)
      .join(' · ');
  }
}
