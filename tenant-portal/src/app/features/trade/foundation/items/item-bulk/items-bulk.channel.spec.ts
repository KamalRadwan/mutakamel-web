import { ItemSelection } from './item-selection';
import { ITEM_BULK_SELECTION_LIMIT, toItemBulkFilter } from './item-bulk.model';

describe('item bulk selection sent to the Trade backend', () => {
  it('includes the selected POS channel and removes stale channels for other purposes', () => {
    expect(toItemBulkFilter({ purpose: 'POS', search: 'a' }, ' channel-id ')).toEqual({
      purpose: 'POS', search: 'a', channelId: 'channel-id',
    });
    expect(toItemBulkFilter({ purpose: 'SALES', channelId: 'stale' }, 'channel-id')).toEqual({ purpose: 'SALES' });
    expect(toItemBulkFilter({ purpose: 'POS' }, '  ')).toEqual({ purpose: 'POS' });
  });

  it('snapshots the exact QUERY DTO, preserving booleans, arrays and excluded ids', () => {
    const selection = new ItemSelection();
    const filter = toItemBulkFilter({ purpose: 'POS', categoryIds: ['category-id'],
      includeSubcategories: true, hasImage: false, scope: 'COMPANY' }, 'channel-id');
    selection.selectAllMatching(filter, 3);
    filter.categoryIds?.push('later-change');
    selection.toggle({ id: 'excluded-id' });
    expect(selection.count()).toBe(2);
    expect(selection.snapshot()).toEqual({ kind: 'QUERY', query: {
      purpose: 'POS', categoryIds: ['category-id'], includeSubcategories: true,
      hasImage: false, scope: 'COMPANY', channelId: 'channel-id',
    }, excludedIds: ['excluded-id'] });
    const snapshot = selection.snapshot();
    if (snapshot.kind === 'QUERY') snapshot.excludedIds?.push('another-id');
    expect(selection.count()).toBe(2);
  });

  it('clears QUERY selection when its channel changes', () => {
    const selection = new ItemSelection();
    selection.selectAllMatching(toItemBulkFilter({ purpose: 'POS' }, 'channel-1'), 5);
    selection.onFilterChange(toItemBulkFilter({ purpose: 'POS' }, 'channel-2'));
    expect(selection.mode()).toBe('ids');
    expect(selection.count()).toBe(0);
  });

  it('keeps explicit ids unique and preserves their order', () => {
    const selection = new ItemSelection();
    selection.replaceWith([{ id: 'item-1' }, { id: 'item-2' }, { id: 'item-1' }]);
    expect(selection.snapshot()).toEqual({ kind: 'IDS', ids: ['item-1', 'item-2'] });
  });

  it('does not select an empty or oversized query', () => {
    const selection = new ItemSelection();
    selection.selectAllMatching({}, 0);
    expect(selection.count()).toBe(0);
    selection.selectAllMatching({}, ITEM_BULK_SELECTION_LIMIT + 1);
    expect(selection.count()).toBe(0);
    selection.selectAllMatching({}, ITEM_BULK_SELECTION_LIMIT);
    expect(selection.count()).toBe(ITEM_BULK_SELECTION_LIMIT);
  });
});
