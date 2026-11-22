import { describe, expect, it } from 'vitest';
import { LeadMoveError, LeadRow, canMove, dueCounts, initials, nameIn, ownerName } from './leads.model';

function lead(overrides: Partial<LeadRow>): LeadRow {
  return { id: 'l1', owner: null, nextActivity: null, status: 'OPEN', ...overrides } as LeadRow;
}

describe('dueCounts', () => {
  it('counts each bucket and puts leads without an activity under NONE', () => {
    const at = '2026-11-21T10:00:00.000Z';
    const counts = dueCounts([
      lead({ nextActivity: { activityAt: at, bucket: 'OVERDUE' } }),
      lead({ nextActivity: { activityAt: at, bucket: 'OVERDUE' } }),
      lead({ nextActivity: { activityAt: at, bucket: 'TODAY' } }),
      lead({ nextActivity: { activityAt: at, bucket: 'FUTURE' } }),
      lead({}),
    ]);

    expect(counts).toEqual({ OVERDUE: 2, TODAY: 1, FUTURE: 1, NONE: 1 });
  });

  it('returns zeros for no leads', () => {
    expect(dueCounts([])).toEqual({ OVERDUE: 0, TODAY: 0, FUTURE: 0, NONE: 0 });
  });
});

describe('ownerName', () => {
  it('joins first and last name', () => {
    expect(ownerName(lead({ owner: { userId: 'u1', firstName: 'Kamal', lastName: 'Radwan' } }))).toBe('Kamal Radwan');
  });

  it('skips a missing part and handles no owner', () => {
    expect(ownerName(lead({ owner: { userId: 'u1', firstName: 'Kamal', lastName: null } }))).toBe('Kamal');
    expect(ownerName(lead({}))).toBe('');
  });
});

describe('initials', () => {
  it('uses the first two words, upper-cased', () => {
    expect(initials('kamal radwan')).toBe('KR');
    expect(initials('Mary Jane Watson')).toBe('MJ');
  });

  it('ignores extra spaces and handles an empty name', () => {
    expect(initials('  Omar   Fathy ')).toBe('OF');
    expect(initials('')).toBe('');
  });
});

describe('canMove', () => {
  it('blocks only converted leads', () => {
    expect(canMove(lead({ status: 'CONVERTED' }))).toBe(false);
    expect(canMove(lead({ status: 'OPEN' }))).toBe(true);
    expect(canMove(lead({ status: 'DISQUALIFIED' }))).toBe(true);
  });
});

describe('nameIn', () => {
  it('picks the Arabic or English name', () => {
    const item = { nameEn: 'New', nameAr: 'جديد' };

    expect(nameIn(item, 'ar')).toBe('جديد');
    expect(nameIn(item, 'en')).toBe('New');
  });
});

describe('LeadMoveError', () => {
  it('carries the code as code and message', () => {
    const error = new LeadMoveError('CRM_REASON_REQUIRED');

    expect(error.code).toBe('CRM_REASON_REQUIRED');
    expect(error.message).toBe('CRM_REASON_REQUIRED');
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(422);
  });
});
