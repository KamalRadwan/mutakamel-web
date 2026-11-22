import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadSearchBody } from '../lead-search/lead-search.compile';
import { LeadRow } from '../leads.model';
import { SELECTION_LIMIT, SelectedRow } from './lead-bulk.model';
import { LeadSelection, toSelectedRow } from './lead-selection';

function row(id: string): SelectedRow {
  return { id, displayName: `Lead ${id}`, ownerUserId: 'u1', stageId: 'stage-new', stageFlag: 'NEW', status: 'OPEN' };
}

const BODY_A: LeadSearchBody = { branchId: 'b1', search: 'acme' };
const BODY_B: LeadSearchBody = { branchId: 'b1', search: 'globex' };

describe('toSelectedRow', () => {
  it('maps a lead row and keeps a null owner when unassigned', () => {
    const lead = {
      id: 'l1',
      displayName: 'Acme',
      owner: null,
      stageId: 's1',
      stageFlag: 'QUALIFIED',
      status: 'OPEN',
      updatedAt: '2026-11-21T10:00:00.000Z',
    } as unknown as LeadRow;

    expect(toSelectedRow(lead)).toEqual({
      id: 'l1',
      displayName: 'Acme',
      ownerUserId: null,
      stageId: 's1',
      stageFlag: 'QUALIFIED',
      status: 'OPEN',
      updatedAt: '2026-11-21T10:00:00.000Z',
    });
  });

  it('takes the owner user id from the owner object', () => {
    const lead = { id: 'l1', displayName: 'A', owner: { userId: 'u9', firstName: null, lastName: null } } as unknown as LeadRow;

    expect(toSelectedRow(lead).ownerUserId).toBe('u9');
  });
});

describe('LeadSelection (ids mode)', () => {
  let selection: LeadSelection;
  beforeEach(() => (selection = new LeadSelection()));

  it('starts empty in ids mode', () => {
    expect(selection.mode()).toBe('ids');
    expect(selection.count()).toBe(0);
  });

  it('toggles a row on and off', () => {
    selection.toggle(row('a'));
    expect(selection.isSelected('a')).toBe(true);
    expect(selection.count()).toBe(1);

    selection.toggle(row('a'));
    expect(selection.isSelected('a')).toBe(false);
    expect(selection.count()).toBe(0);
  });

  it('selects and deselects a page of rows in one call', () => {
    selection.setRows([row('a'), row('b'), row('c')], true);
    selection.setRows([row('b')], false);

    expect(selection.snapshot()).toEqual({ kind: 'IDS', ids: ['a', 'c'] });
  });

  it('reports none, some and all for a page', () => {
    selection.setRows([row('a')], true);

    expect(selection.pageState([])).toBe('none');
    expect(selection.pageState(['x', 'y'])).toBe('none');
    expect(selection.pageState(['a', 'y'])).toBe('some');
    expect(selection.pageState(['a'])).toBe('all');
  });

  it('counts selected rows hidden by the current filter', () => {
    selection.setRows([row('a'), row('b'), row('c')], true);

    expect(selection.hiddenCount(new Set(['a']))).toBe(2);
    expect(selection.hiddenCount(null)).toBe(0);
  });

  it('replaceWith swaps the whole selection', () => {
    selection.setRows([row('a')], true);
    selection.replaceWith([row('x'), row('y')]);

    expect(selection.snapshot()).toEqual({ kind: 'IDS', ids: ['x', 'y'] });
  });

  it('clear empties the selection', () => {
    selection.setRows([row('a')], true);
    selection.clear();

    expect(selection.count()).toBe(0);
  });

  it('resolve returns the selected rows without calling the server', async () => {
    selection.setRows([row('a'), row('b')], true);

    expect((await selection.resolve()).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('LeadSelection (all matching mode)', () => {
  let selection: LeadSelection;
  beforeEach(() => (selection = new LeadSelection()));

  it('enters all mode with the matching total and drops picked ids', () => {
    selection.toggle(row('a'));
    selection.selectAllMatching(BODY_A, 250);

    expect(selection.mode()).toBe('all');
    expect(selection.allTotal()).toBe(250);
    expect(selection.count()).toBe(250);
    expect(selection.isSelected('anything')).toBe(true);
  });

  it('ignores a zero total', () => {
    selection.selectAllMatching(BODY_A, 0);

    expect(selection.mode()).toBe('ids');
  });

  it('ignores a total above the selection limit', () => {
    selection.selectAllMatching(BODY_A, SELECTION_LIMIT + 1);

    expect(selection.mode()).toBe('ids');
  });

  it('accepts exactly the selection limit', () => {
    selection.selectAllMatching(BODY_A, SELECTION_LIMIT);

    expect(selection.count()).toBe(SELECTION_LIMIT);
  });

  it('toggling a row excludes it and lowers the count', () => {
    selection.selectAllMatching(BODY_A, 10);
    selection.toggle(row('a'));

    expect(selection.isSelected('a')).toBe(false);
    expect(selection.count()).toBe(9);
  });

  it('toggling an excluded row again re-includes it', () => {
    selection.selectAllMatching(BODY_A, 10);
    selection.toggle(row('a'));
    selection.toggle(row('a'));

    expect(selection.count()).toBe(10);
  });

  it('never reports a negative count when more rows are excluded than the total', () => {
    selection.selectAllMatching(BODY_A, 1);
    selection.setRows([row('a'), row('b')], false);

    expect(selection.count()).toBe(0);
  });

  it('snapshots as a QUERY with a cloned body and excluded ids', () => {
    selection.selectAllMatching(BODY_A, 10, { by: 'name' });
    selection.toggle(row('a'));

    expect(selection.snapshot()).toEqual({
      kind: 'QUERY',
      query: { search: BODY_A, sort: { by: 'name' } },
      excludedIds: ['a'],
    });
  });

  it('omits sort from the QUERY snapshot when none was given', () => {
    selection.selectAllMatching(BODY_A, 10);

    expect(selection.snapshot()).toEqual({ kind: 'QUERY', query: { search: BODY_A }, excludedIds: [] });
  });

  it('does not report hidden rows in all mode', () => {
    selection.selectAllMatching(BODY_A, 10);

    expect(selection.hiddenCount(new Set(['a']))).toBe(0);
  });

  it('keeps all mode when the same filter is re-applied', () => {
    selection.selectAllMatching(BODY_A, 10);
    selection.onBodyChange({ ...BODY_A });

    expect(selection.mode()).toBe('all');
  });

  it('falls back to ids mode when the filter changes', () => {
    selection.selectAllMatching(BODY_A, 10);
    selection.onBodyChange(BODY_B);

    expect(selection.mode()).toBe('ids');
  });

  it('clear leaves all mode', () => {
    selection.selectAllMatching(BODY_A, 10);
    selection.clear();

    expect(selection.mode()).toBe('ids');
    expect(selection.count()).toBe(0);
  });
});

describe('LeadSelection.resolve in all mode', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function settle<T>(promise: Promise<T>): Promise<T> {
    const guarded = promise.then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    await vi.runAllTimersAsync();
    const result = await guarded;
    if (!result.ok) throw result.error;
    return result.value;
  }

  it('fetches matching rows from the server and drops excluded ones', async () => {
    const selection = new LeadSelection();
    selection.selectAllMatching({ branchId: 'b1' }, 5);
    const everyone = await settle(selection.resolve());
    expect(everyone.length).toBeGreaterThan(1);

    selection.toggle(row(everyone[0].id));
    const remaining = await settle(selection.resolve());

    expect(remaining.map((r) => r.id)).not.toContain(everyone[0].id);
    expect(remaining).toHaveLength(everyone.length - 1);
  });
});
