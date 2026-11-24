import { Component, effect, computed, inject, input, linkedSignal, output, resource, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ApiError } from '../../settings/shared/settings-api';
import { FullState } from '../../../../shared/ui/full-state/full-state';
import { ConflictDialog } from '../../../../shared/ui/conflict-dialog/conflict-dialog';
import { Button } from '../../../../shared/ui/button/button';
import { leadErrorState, leadWriteState } from '../lead-list';
import { RecordBoard } from '../../shared/record/board/record-board';
import { BoardLabels, BoardLane, BoardMoveEvent } from '../../shared/record/board/record-board.model';
import { LeadCard } from '../lead-card/lead-card';
import { LeadDisqualify } from '../lead-disqualify/lead-disqualify';
import { LeadSearchBody } from '../lead-search/lead-search.compile';
import { deleteLead, loadBoard, loadStagePage, moveLead, searchLeads, updateLead } from '../leads.api';
import {
  BoardLane as LeadBoardLane,
  CardColor,
  DueBucket,
  LeadsCapabilities,
  LeadNavContext,
  LeadRow,
  LeadStage,
  dueCounts,
  nameIn,
} from '../leads.model';

const DUE_SEGMENTS: readonly { bucket: DueBucket | 'NONE'; color: string }[] = [
  { bucket: 'OVERDUE', color: 'bg-danger' },
  { bucket: 'TODAY', color: 'bg-warning' },
  { bucket: 'FUTURE', color: 'bg-success' },
  { bucket: 'NONE', color: 'bg-status-none' },
];

const COLLAPSED_KEY = 'crm.leads.board.collapsed';

@Component({
  selector: 'app-lead-board',
  imports: [TranslocoPipe, ConfirmDialog, ConflictDialog, FullState, Button, LeadCard, LeadDisqualify, RecordBoard],
  templateUrl: './lead-board.html',
  host: { class: 'flex shrink-0 flex-col' },
})
export class LeadBoard {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly confirmDialog = viewChild.required(ConfirmDialog);
  private readonly disqualifyDialog = viewChild.required(LeadDisqualify);
  private readonly recordBoard = viewChild.required<RecordBoard<LeadRow>>(RecordBoard);
  protected readonly language = inject(LanguageState).current;

  readonly body = input.required<LeadSearchBody>();
  readonly capabilities = input<LeadsCapabilities | null>(null);
  readonly writeBlocked = output<void>();
  readonly create = output<string>();
  readonly view = output<LeadRow>();
  readonly activities = output<LeadRow>();
  readonly countsChanged = output<void>();

  private lastLanes: LeadBoardLane[] | undefined;
  private lastBranch = '';
  private readonly board = resource({
    params: () => this.body().branchId ? this.body() : undefined,
    loader: async ({ params }) => {
      if (this.lastBranch !== params.branchId) { this.lastLanes = undefined; this.lastBranch = params.branchId; }
      try {
        const { stages } = await loadBoard(params);
        if (params.branchId === this.body().branchId) this.lastLanes = stages;
        return stages;
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          this.notify.error(this.transloco.translate('leads.search.invalid'));
          return this.lastLanes;
        }
        throw error;
      }
    },
  });

  protected readonly lanes = linkedSignal({
    source: () => ({ value: this.board.value(), branchId: this.body().branchId }),
    computation: ({ value, branchId }, previous): LeadBoardLane[] => value
      ?? (previous?.source.branchId === branchId ? previous.value : []),
  });
  protected readonly writes = leadWriteState(this.capabilities, () => this.refresh(),
    async (id) => (await searchLeads({ branchId: this.body().branchId, filterTree: { field: 'id', operator: 'eq', value: id } }, 1, 1)).items[0],
    (row) => this.patchItem(row));
  protected readonly stages = computed(() => this.lanes().map((lane) => lane.stage));
  protected readonly openCards = signal<Record<string, string>>({});
  protected readonly loadingMore = signal<string | null>(null);
  protected readonly laneErrors = signal<Record<string, boolean>>({});
  protected readonly deletingName = signal('');
  protected readonly loading = this.board.isLoading;
  protected readonly failed = computed(() => !!this.board.error());
  protected readonly errorState = computed(() => leadErrorState(this.transloco, this.board.error()));
  protected readonly collapseStorageKey = COLLAPSED_KEY;
  protected readonly leadId = (lead: LeadRow) => lead.id;
  protected readonly canDragLead = (lead: LeadRow) => this.writes.canUpdate(lead);

  protected readonly boardLanes = computed<BoardLane<LeadRow>[]>(() => {
    this.i18n();
    const lang = this.language();
    const loadingStageId = this.loadingMore();
    const createAllowed = !this.writes.readOnly() && !!this.capabilities()?.leads?.create;
    return this.lanes().map((lane) => {
      const label = nameIn(lane.stage, lang);
      const flag = lane.stage.flag;
      const tone = flag === 'DISQUALIFIED' ? 'danger' : flag === 'CONVERTED' ? 'success' : undefined;
      const dropRule = flag === 'CONVERTED' ? 'deny' : flag === 'DISQUALIFIED' ? 'confirm' : 'allow';
      return {
        id: lane.stage.id,
        label,
        ...(tone ? { tone } : {}),
        total: lane.total,
        items: lane.items,
        hasNext: lane.hasNext,
        loading: loadingStageId === lane.stage.id,
        canCreate: createAllowed && lane.stage.isActive && !tone,
        dropRule,
        ...(dropRule === 'deny'
          ? { denyReason: this.transloco.translate('leads.move.convertRequired', { stage: label }) }
          : {}),
        statusSegments: this.segments(lane).map((segment) => ({
          key: segment.bucket,
          count: segment.count,
          color: segment.color,
        })),
        statusSummary: this.dueSummary(lane),
      };
    });
  });

  protected readonly boardLabels = computed<BoardLabels>(() => {
    this.i18n();
    return {
      add: (stage: string) => this.transloco.translate('leads.board.add', { stage }),
      empty: this.transloco.translate('leads.board.empty'),
      emptyHelp: this.transloco.translate('leads.board.emptyHelp'),
      allShown: this.transloco.translate('leads.board.allShown'),
    };
  });

  constructor() {
    effect(() => { if (this.writes.readOnly()) this.writeBlocked.emit(); });
  }

  refresh(): void {
    this.board.reload();
  }

  hasItem(id: string): boolean {
    return this.lanes().some((lane) => lane.items.some((item) => item.id === id));
  }

  patchItem(row: Partial<LeadRow> & { id: string }): void {
    this.lanes.update((lanes) => {
      const from = lanes.find((lane) => lane.items.some((item) => item.id === row.id));
      if (!from) return lanes;
      const existing = from.items.find((item) => item.id === row.id)!;

      if (row.stageId && row.stageId !== from.stage.id) {
        const to = lanes.find((lane) => lane.stage.id === row.stageId);
        if (to) {
          const moved: LeadRow = { ...existing, ...row, stageId: to.stage.id, stageFlag: to.stage.flag };
          return lanes.map((lane) => {
            if (lane.stage.id === from.stage.id) {
              return { ...lane, items: lane.items.filter((item) => item.id !== row.id), total: Math.max(0, lane.total - 1) };
            }
            if (lane.stage.id === to.stage.id) {
              return { ...lane, items: [moved, ...lane.items], total: lane.total + 1 };
            }
            return lane;
          });
        }
      }

      return lanes.map((lane) =>
        lane.stage.id === from.stage.id
          ? { ...lane, items: lane.items.map((item) => (item.id === row.id ? { ...item, ...row } : item)) }
          : lane,
      );
    });
  }

  navContextFor(leadId: string): LeadNavContext | null {
    const lane = this.lanes().find((item) => item.items.some((lead) => lead.id === leadId));
    if (!lane) return null;
    const stageId = lane.stage.id;
    return {
      ids: lane.items.map((item) => item.id),
      total: lane.total,
      loadMore: lane.hasNext
        ? async () => {
            const current = this.lanes().find((item) => item.stage.id === stageId);
            if (current?.hasNext) {
              await this.loadMore(current);
            }
            const updated = this.lanes().find((item) => item.stage.id === stageId);
            return updated ? updated.items.map((item) => item.id) : [];
          }
        : null,
    };
  }

  protected segments(lane: LeadBoardLane) {
    const counts = dueCounts(lane.items);
    return DUE_SEGMENTS.map(({ bucket, color }) => ({ bucket, count: counts[bucket], color })).filter((segment) => segment.count > 0);
  }

  protected dueSummary(lane: LeadBoardLane) {
    this.i18n();
    const active = this.segments(lane);
    if (!active.length) return this.transloco.translate('leads.due.NONE');
    return active.map((segment) => `${this.transloco.translate('leads.due.' + segment.bucket)} ${segment.count}`).join(' · ');
  }

  protected setExpanded(stageId: string, leadId: string, expanded: boolean) {
    this.openCards.update((current) => {
      if (expanded) return { ...current, [stageId]: leadId };
      if (current[stageId] !== leadId) return current;
      const { [stageId]: _, ...rest } = current;
      return rest;
    });
  }

  protected onLoadMore(stageId: string): void {
    const lane = this.lanes().find((item) => item.stage.id === stageId);
    if (lane) void this.loadMore(lane);
  }

  protected onMove(event: BoardMoveEvent): void {
    void this.move(event.id, event.to);
  }

  protected async loadMore(lane: LeadBoardLane) {
    if (this.loadingMore()) return;
    this.laneErrors.update((errors) => ({ ...errors, [lane.stage.id]: false }));
    this.loadingMore.set(lane.stage.id);
    try {
      const next = await loadStagePage(lane.stage.id, this.body(), lane.page + 1);
      this.lanes.update((lanes) =>
        lanes.map((item) => (item.stage.id === lane.stage.id ? { ...next, items: [...item.items, ...next.items] } : item)),
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === 'LEAD_STAGE_NOT_FOUND') {
        this.refresh();
        return;
      }
      this.laneErrors.update((errors) => ({ ...errors, [lane.stage.id]: true }));
      const key = error instanceof ApiError && error.status === 400 ? 'leads.search.invalid' : 'leads.loadFailed';
      this.notify.error(this.transloco.translate(key));
    } finally {
      this.loadingMore.set(null);
    }
  }

  async rate(lead: LeadRow, rating: number) {
    if (!this.writes.canUpdate(lead)) return;
    const before = this.lanes();
    this.lanes.update((lanes) =>
      lanes.map((lane) => ({
        ...lane,
        items: lane.items.map((item) => (item.id === lead.id ? { ...item, rating } : item)),
      })),
    );
    try {
      const saved = await updateLead(lead.id, { rating }, lead.updatedAt);
      this.lanes.update((lanes) =>
        lanes.map((lane) => ({
          ...lane,
          items: lane.items.map((item) => (item.id === lead.id ? saved : item)),
        })),
      );
      this.countsChanged.emit();
    } catch (error) {
      this.lanes.set(before);
      await this.writes.failure(error, 'leads.rate.failed', { lead, changes: { rating } });
    }
  }

  async recolor(lead: LeadRow, cardColor: CardColor | null) {
    if (!this.writes.canUpdate(lead)) return;
    const before = this.lanes();
    this.lanes.update((lanes) =>
      lanes.map((lane) => ({
        ...lane,
        items: lane.items.map((item) => (item.id === lead.id ? { ...item, cardColor } : item)),
      })),
    );
    try {
      const saved = await updateLead(lead.id, { cardColor }, lead.updatedAt);
      this.lanes.update((lanes) =>
        lanes.map((lane) => ({
          ...lane,
          items: lane.items.map((item) => (item.id === lead.id ? saved : item)),
        })),
      );
    } catch (error) {
      this.lanes.set(before);
      await this.writes.failure(error, 'leads.color.failed', { lead, changes: { cardColor } });
    }
  }

  async remove(lead: LeadRow) {
    if (!this.writes.canDelete(lead)) return;
    this.deletingName.set(lead.displayName);
    if (!(await this.confirmDialog().open())) return;
    const before = this.lanes();
    this.lanes.update((lanes) =>
      lanes.map((lane) =>
        lane.items.some((item) => item.id === lead.id)
          ? { ...lane, items: lane.items.filter((item) => item.id !== lead.id), total: lane.total - 1 }
          : lane,
      ),
    );
    try {
      await deleteLead(lead.id);
      this.countsChanged.emit();
      this.notify.success(this.transloco.translate('leads.delete.done'));
    } catch (error) {
      this.lanes.set(before);
      await this.writes.failure(error, 'leads.delete.failed');
    }
  }

  async move(leadId: string, toStageId: string) {
    const before = this.lanes();
    const from = before.find((lane) => lane.items.some((item) => item.id === leadId));
    const to = before.find((lane) => lane.stage.id === toStageId);
    if (!from || !to || from === to) {
      this.recordBoard().revert(leadId);
      return;
    }

    const stage = nameIn(to.stage, this.language());
    if (to.stage.flag === 'CONVERTED') {
      this.recordBoard().revert(leadId);
      this.notify.warning(this.transloco.translate('leads.move.convertRequired', { stage }));
      return;
    }
    const lead = from.items.find((item) => item.id === leadId)!;
    if (!this.writes.canUpdate(lead)) {
      this.recordBoard().revert(leadId);
      return;
    }
    if (to.stage.flag === 'DISQUALIFIED') {
      await this.disqualify(lead, to.stage, stage);
      return;
    }

    const moved: LeadRow = { ...lead, stageId: to.stage.id, stageFlag: to.stage.flag };
    this.lanes.set(
      before.map((lane) => {
        if (lane === from) return { ...lane, items: lane.items.filter((item) => item.id !== leadId), total: lane.total - 1 };
        if (lane === to) return { ...lane, items: [moved, ...lane.items], total: lane.total + 1 };
        return lane;
      }),
    );

    try {
      const saved = await moveLead(leadId, toStageId);
      this.countsChanged.emit();
      this.lanes.update((lanes) => lanes.map((lane) => ({ ...lane, items: lane.items.map((item) => (item.id === leadId ? saved : item)) })));
      this.notify.success(this.transloco.translate('leads.move.done', { stage }));
    } catch (error) {
      this.lanes.set(before);
      this.recordBoard().revert(leadId);
      await this.writes.failure(error, 'leads.move.failed');
    }
  }

  /**
   * A move into Disqualified asks for the governed reason first. The card stays in its lane while the dialog
   * is open (the board's optimistic drop is undone at once) and moves only when the move is saved.
   */
  private async disqualify(lead: LeadRow, to: LeadStage, stage: string) {
    this.recordBoard().revert(lead.id);
    try {
      const saved = await this.disqualifyDialog().open(lead, to);
      if (saved) {
        this.countsChanged.emit();
        this.patchItem(saved);
        this.notify.success(this.transloco.translate('leads.move.done', { stage }));
      }
    } catch (error) {
      await this.writes.failure(error, 'leads.move.failed');
    }
  }
}
