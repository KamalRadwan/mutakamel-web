import { describe, expect, it } from 'vitest';
import { mySeatStatesFromMe, seatHolderFromCore, webphoneSeatHolder, webphoneSeatHoldersPage } from './seats.model';
import type { CoreSeatHolder, WebphoneSeatHolder } from './seats.model';

const holder: CoreSeatHolder = { userId: 'u1', name: 'One', email: 'one@example.test', status: 'INVITED',
  grantedAt: '2026-11-21T00:00:00Z', accessState: 'ACTIVE', cause: null,
  roles: [{ roleId: 'r1', roleName: 'Sales', scope: { target: 'TENANT', companyId: null, branchId: null } }] };
const phone: WebphoneSeatHolder = { userId: 'u1', name: 'One', extension: '101', enabledAt: null, accessState: 'OVER_CAPACITY' };

describe('seat contract adapters', () => {
  it.each(['INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'])('preserves backend user status %s', status => {
    expect(seatHolderFromCore({ ...holder, status })).toEqual({ ...holder, status });
  });

  it.each([{ status: 'UNKNOWN' }, { accessState: 'BLOCKED' }])('rejects unsupported holder enums %j', fields => {
    expect(() => seatHolderFromCore({ ...holder, ...fields })).toThrow('COMMON.GENERIC.INTERNAL_ERROR');
  });

  it('keeps missing Webphone grant time empty and uses real user identity', () => {
    expect(webphoneSeatHolder(phone, { email: holder.email, status: 'INVITED' })).toEqual({
      userId: 'u1', name: 'One', email: holder.email, status: 'INVITED', grantedAt: '',
      accessState: 'OVER_CAPACITY', cause: null, roles: [], extension: '101', enabledAt: null,
    });
  });

  it.each([0, 3])('derives Webphone page counters for total %s', total => {
    expect(webphoneSeatHoldersPage({ data: [], meta: { page: 1, limit: 2, total } }, []).meta).toEqual({
      page: 1, limit: 2, total, totalPages: Math.ceil(total / 2), hasNext: total > 2, hasPrev: false,
    });
  });

  it.each([{ page: 0, limit: 2, total: 1 }, { page: 1, limit: 0, total: 1 }, { page: 1, limit: 2, total: -1 }])('rejects malformed page metadata %j', meta => {
    expect(() => webphoneSeatHoldersPage({ data: [], meta }, [])).toThrow('COMMON.GENERIC.INTERNAL_ERROR');
  });

  it('accepts an authenticated user with no seats', () => {
    expect(mySeatStatesFromMe({ seats: [] })).toEqual([]);
  });
});
