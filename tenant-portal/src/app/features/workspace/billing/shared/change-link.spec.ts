import { describe, expect, it } from 'vitest';
import { CHANGE_PLAN_PATH, ChangePrefill, changeLink, parseChangePrefill } from './change-link';

describe('changeLink', () => {
  it('builds the app query', () => {
    expect(changeLink({ kind: 'app', applicationId: 'a1', tierId: 't1' })).toEqual({
      path: CHANGE_PLAN_PATH,
      queryParams: { add: 'app:a1:t1' },
    });
  });

  it('builds the seats query', () => {
    expect(changeLink({ kind: 'seats', itemId: 'i1' }).queryParams.add).toBe('seats:i1');
  });
});

describe('parseChangePrefill', () => {
  it('round-trips every prefill kind through changeLink', () => {
    const prefills: ChangePrefill[] = [
      { kind: 'app', applicationId: 'a1', tierId: 't1' },
      { kind: 'tier', itemId: 'i1', tierId: 't2' },
      { kind: 'addon', addonId: 'ad', definitionVersionId: 'dv', parentItemId: 'pi' },
      { kind: 'seats', itemId: 'i9' },
    ];
    for (const p of prefills) {
      expect(parseChangePrefill(changeLink(p).queryParams.add)).toEqual(p);
    }
  });

  it('returns null for null or empty input', () => {
    expect(parseChangePrefill(null)).toBeNull();
    expect(parseChangePrefill('')).toBeNull();
  });

  it('returns null for an unknown kind', () => {
    expect(parseChangePrefill('plan:a:b')).toBeNull();
  });

  it('returns null when the app segment count is wrong', () => {
    expect(parseChangePrefill('app:a1')).toBeNull();
    expect(parseChangePrefill('app:a1:t1:x')).toBeNull();
    expect(parseChangePrefill('app::t1')).toBeNull();
  });

  it('allows a tier prefill without a tier id', () => {
    expect(parseChangePrefill('tier:i1')).toEqual({ kind: 'tier', itemId: 'i1', tierId: '' });
  });

  it('rejects a tier prefill without an item id', () => {
    expect(parseChangePrefill('tier:')).toBeNull();
  });

  it('rejects an addon prefill with missing parts', () => {
    expect(parseChangePrefill('addon:a:b')).toBeNull();
    expect(parseChangePrefill('addon:a::c')).toBeNull();
  });

  it('rejects a seats prefill with extra or empty parts', () => {
    expect(parseChangePrefill('seats:')).toBeNull();
    expect(parseChangePrefill('seats:a:b')).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(parseChangePrefill('  seats:i1  ')).toEqual({ kind: 'seats', itemId: 'i1' });
  });
});
