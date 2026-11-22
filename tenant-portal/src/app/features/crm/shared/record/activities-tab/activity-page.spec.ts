/** Core's envelope delivers ActivityPageDto as { data: items, meta: { ..., hasNext, hasPrev } }. */
import { describe, expect, it } from 'vitest';
import { hasNextPage } from './activity-page';

describe('hasNextPage', () => {
  it('reads the next-page flag from the envelope meta', () => {
    expect(hasNextPage({ meta: { hasNext: true } })).toBe(true);
    expect(hasNextPage({ meta: { hasNext: false } })).toBe(false);
  });
});
