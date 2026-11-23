import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SALES_PIPELINE_ID, fakeListPipelines, fakeLoadBoard } from '../opportunities.fake';
import { configureListTest } from '../opportunities-page/opportunities-list-test-support';
import { OpportunityBoardRow, OpportunityCapabilities, OpportunityRow, PipelineView } from '../opportunities.model';
import { boardRowToOpportunityRow } from '../opportunity-card/opportunity-card';
import { MoveOutcome, OpportunityMoves } from '../opportunity-moves/opportunity-moves';
import { OpportunityBoard } from './opportunity-board';

/*
 * The transport stub serves the existing fixtures. A drop is simulated through the record board's own drop
 * handler, and OpportunityMoves is stubbed so the spec controls when the Won/Lost close dialog confirms or
 * cancels.
 */

// Protected members are reached through this view on purpose: the spec drives the board state directly.
type Internals = Record<string, any>;
type Lane = { id: string; items: OpportunityBoardRow[] };

const FROM = 'ps-sales-1';
const NEXT = 'ps-sales-2';
const WON = 'ps-sales-6';
const LOST = 'ps-sales-7';

const CAPABILITIES = { move: { scope: 'all', ownerUserIds: null } } as unknown as OpportunityCapabilities;

let fixture: ComponentFixture<OpportunityBoard>;
let c: Internals;
let moveSpy: ReturnType<typeof vi.fn<OpportunityMoves['move']>>;
let context: ReturnType<typeof configureListTest>;

async function flush(): Promise<void> {
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(2000);
  fixture.detectChanges();
}

/** Lane ids as the record board shows them, optimistic moves included. */
function shownLaneOf(id: string): string | undefined {
  const lanes = c['recordBoard']()['displayLanes']() as Lane[];
  return lanes.find((lane) => lane.items.some((item) => item.id === id))?.id;
}

function laneOf(id: string): string | undefined {
  return (c['boardStages']() as { stage: { id: string }; items: OpportunityBoardRow[] }[]).find((lane) =>
    lane.items.some((item) => item.id === id),
  )?.stage.id;
}

/** Drops the first card of the first lane on `to` with a move outcome that settles when the spec says so. */
function dropOn(to: string) {
  const row = (c['boardStages']() as { stage: { id: string }; items: OpportunityBoardRow[] }[]).find(
    (lane) => lane.stage.id === FROM,
  )!.items[0];
  let settle!: (outcome: MoveOutcome) => void;
  moveSpy.mockReturnValue(new Promise<MoveOutcome>((resolve) => (settle = resolve)));
  const board = c['recordBoard']();
  const target = (board['displayLanes']() as Lane[]).find((lane) => lane.id === to)!;
  board['onDropped'](target, { recordId: row.id, fromLaneId: FROM, height: 40 });
  fixture.detectChanges();
  return { row, settle };
}

function savedIn(row: OpportunityBoardRow, stageId: string, flag: 'WON' | 'LOST'): MoveOutcome {
  const saved: OpportunityRow = { ...boardRowToOpportunityRow(row), stageId, stageFlag: flag, status: flag };
  return { kind: 'moved', row: saved };
}

/** Lets the settled outcome run, without reaching the background lane reload (fake delay 250 ms+). */
async function settled(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  fixture.detectChanges();
}

beforeEach(async () => {
  moveSpy = vi.fn<OpportunityMoves['move']>();
  context = configureListTest('en', 'light', { move: moveSpy });
  const loading = fakeListPipelines();
  await vi.advanceTimersByTimeAsync(2000);
  const pipeline = (await loading).find((item) => item.id === SALES_PIPELINE_ID) as PipelineView;
  const loadingBoard = fakeLoadBoard(pipeline.id, { branchId: 'b1', limitPerStage: 50 });
  await vi.advanceTimersByTimeAsync(2000);
  context.transport.boardResponse = await loadingBoard;

  fixture = TestBed.createComponent(OpportunityBoard);
  fixture.componentRef.setInput('pipeline', pipeline);
  fixture.componentRef.setInput('body', { branchId: 'b1' });
  fixture.componentRef.setInput('capabilities', CAPABILITIES);
  c = fixture.componentInstance as unknown as Internals;
  await flush();
});

afterEach(async () => {
  fixture.destroy();
  await context.dispose();
});

describe('opportunity board: drop on Won / Lost', () => {
  it('keeps the card in its lane while the close dialog is open, and nothing moves on cancel', async () => {
    const { row, settle } = dropOn(WON);

    expect(moveSpy).toHaveBeenCalledOnce();
    expect(shownLaneOf(row.id)).toBe(FROM);

    settle({ kind: 'cancelled' });
    await settled();

    expect(shownLaneOf(row.id)).toBe(FROM);
    expect(laneOf(row.id)).toBe(FROM);
  });

  it('moves nothing when the close fails', async () => {
    const { row, settle } = dropOn(LOST);

    settle({ kind: 'failed', code: null });
    await settled();

    expect(shownLaneOf(row.id)).toBe(FROM);
    expect(laneOf(row.id)).toBe(FROM);
  });

  it('moves the card into Lost only after the close dialog confirms', async () => {
    const { row, settle } = dropOn(LOST);
    expect(shownLaneOf(row.id)).toBe(FROM);

    context.transport.boardResponse.stages = context.transport.boardResponse.stages.map((lane) => ({
      ...lane,
      items: lane.stage.id === LOST ? [{ ...row, stageId: LOST, stageFlag: 'LOST', status: 'LOST' }]
        : lane.items.filter((item) => item.id !== row.id),
    }));
    settle(savedIn(row, LOST, 'LOST'));
    await settled();

    expect(laneOf(row.id)).toBe(LOST);
    expect(shownLaneOf(row.id)).toBe(LOST);
  });
});

describe('opportunity board: pipeline move', () => {
  it('shows a plain stage move at once and reverts it when the move fails', async () => {
    const { row, settle } = dropOn(NEXT);

    expect(shownLaneOf(row.id)).toBe(NEXT);

    settle({ kind: 'failed', code: null });
    await settled();

    expect(shownLaneOf(row.id)).toBe(FROM);
  });
});
