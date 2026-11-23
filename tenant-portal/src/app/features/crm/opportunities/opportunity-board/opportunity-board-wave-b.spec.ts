import { Signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { moveOpportunityStage } from '../opportunities.api';
import { BoardStage, OpportunityRow, PipelineStageView } from '../opportunities.model';
import { OpportunityMoves } from '../opportunity-moves/opportunity-moves';
import { configureListTest, settleList } from '../opportunities-page/opportunities-list-test-support';
import { OpportunityBoard } from './opportunity-board';

interface BoardState {
  boardStages: Signal<BoardStage[]>;
  moveCard(id: string, from: string, to: string): Promise<void>;
  loadMore(lane: BoardStage): Promise<void>;
  reloadLanes(ids: string[]): Promise<void>;
}

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('%s / %s', (lang, theme) => {
  describe('OpportunityBoard', () => {
    let context: ReturnType<typeof configureListTest>;
    let fixture: ComponentFixture<OpportunityBoard>;
    let state: BoardState;
    let move: ReturnType<typeof vi.fn<OpportunityMoves['move']>>;
    beforeEach(async () => {
      move = vi.fn<OpportunityMoves['move']>();
      context = configureListTest(lang, theme, { move });
      const first = context.transport.boardResponse.stages[0];
      context.transport.boardResponse.stages.push({ ...structuredClone(first),
        stage: { ...first.stage, id: 'next', nameEn: 'Next', nameAr: 'التالية', rank: 3 }, items: [],
      });
      fixture = TestBed.createComponent(OpportunityBoard);
      fixture.componentRef.setInput('pipeline', context.transport.boardResponse.pipeline);
      fixture.componentRef.setInput('body', { branchId: context.transport.row.branchId });
      fixture.componentRef.setInput('capabilities', context.transport.caps);
      state = fixture.componentInstance as unknown as BoardState;
      await settleList(() => fixture.detectChanges());
    });
    afterEach(async () => { fixture.destroy(); await context.dispose(); });

    it('loads lanes', () => {
      expect(state.boardStages()).toHaveLength(3);
      expect(state.boardStages()[0].items[0].title).toBe(context.transport.row.title);
      expect(state.boardStages()[0].summary.amountsByCurrency).toEqual([{ currencyCode: 'KWD', amount: '12400.00000000' }]);
      expect(state.boardStages()[0].activitySummary.noOpenCount).toBe(2);
      const sent = context.transport.recordedWrites().find((call) => call.path.endsWith('/board'))!;
      expect(sent.body).toMatchObject({ branchId: context.transport.row.branchId, limitPerStage: 50 });
      expect(sent.options.key).toMatch(/^[\da-f-]{14}7[\da-f-]{21}$/);
      expect(sent.options.scope).toBeUndefined();
      expect(document.documentElement.dir).toBe(lang === 'ar' ? 'rtl' : 'ltr');
    });

    it('bad cursor', async () => {
      context.transport.writeErrors.push(new ApiError(400, 'OPPORTUNITY_BOARD_CURSOR_INVALID'));
      await state.loadMore(state.boardStages()[0]);
      const calls = context.transport.recordedWrites().filter((call) => call.path.endsWith('/stages/new/opportunities'));
      expect(calls.map((call) => call.body)).toEqual([
        { branchId: context.transport.row.branchId, limit: 50, cursor: 'more-new' },
        { branchId: context.transport.row.branchId, limit: 50 },
      ]);
      expect(state.boardStages()[0].items.map((row) => row.id)).toEqual([context.transport.row.id]);
    });

    it('keeps lane cards and offers a lane Retry after a failure', async () => {
      const original = state.boardStages()[0].items[0];
      context.transport.writeErrors.push(new ApiError(503, 'SERVER_ERROR', undefined, { correlationId: 'lane-503' }));
      await state.loadMore(state.boardStages()[0]);
      fixture.detectChanges();
      expect(state.boardStages()[0].items[0]).toEqual(original);
      expect(fixture.nativeElement.textContent).toContain('lane-503');
      await state.reloadLanes(['new']);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('lane-503');
    });

    it('stale drag', async () => {
      const row = state.boardStages()[0].items[0];
      move.mockImplementation(async (loaded: OpportunityRow, stage: PipelineStageView) => {
        try { await moveOpportunityStage(loaded.id, { stageId: stage.id, expectedUpdatedAt: loaded.updatedAt }); }
        catch (error) { return { kind: 'failed', code: (error as ApiError).code }; }
        return { kind: 'cancelled' };
      });
      context.transport.writeErrorsByPath.set(`/opportunities/${row.id}/stage`, new ApiError(409, 'CRM.OPPORTUNITY.STALE_MOVE'));
      await state.moveCard(row.id, 'new', 'next');
      expect(state.boardStages()[0].items[0].id).toBe(row.id);
      expect(context.transport.recordedReads().some((call) => call.path === `/opportunities/${row.id}`)).toBe(true);
      const sent = context.transport.recordedWrites().find((call) => call.path.endsWith('/stage'))!;
      expect(sent.body).toEqual({ stageId: 'next', expectedUpdatedAt: row.updatedAt });
      expect(sent.options.key).toBeTruthy();
      expect(sent.options.scope).toBeUndefined();
      expect(context.transport.recordedWrites().some((call) => call.path.endsWith('/stages/new/opportunities'))).toBe(true);
    });

    it('routes filter tree errors to the search builder', async () => {
      const errors = vi.fn();
      fixture.componentInstance.searchError.subscribe(errors);
      const error = new ApiError(400, 'INVALID_OPERATOR_VALUE', { path: ['filterTree.children.0'], field: ['amount'] });
      context.transport.writeErrorsByPath.set('/pipelines/pipeline/board', error);
      fixture.componentInstance.refresh();
      await settleList(() => fixture.detectChanges());
      expect(errors).toHaveBeenCalledWith(error);
      expect(fixture.nativeElement.querySelector('ui-full-state')).toBeNull();
    });
  });
});
