import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import { getSeatUsage, listSeatHolders, switchToDerived } from './seats.api';
import { setFakeMigrationShort, setFakeSeatMode } from './seats.fake';
import { seatErrorMessage, seatShortfallDetails } from './seat-errors';

const BACKEND_OVER_CAPACITY_CAUSES = ['GRACE_EXPIRED', 'SEAT_SWAPPED', 'INVOLUNTARY_REDUCTION'];

describe('seats api follows the Core seats backend', () => {
  it('usage modules carry the backend kind', async () => {
    const usage = await getSeatUsage();
    expect(usage.modules.length).toBeGreaterThan(0);
    for (const mod of usage.modules) {
      expect(['ROLE_DERIVED', 'ENABLED_FLAG']).toContain(mod.kind);
    }
  });

  it('read-only holders use a backend cause', async () => {
    const usage = await getSeatUsage();
    for (const mod of usage.modules) {
      const page = await listSeatHolders(mod.moduleKey, { page: 1, limit: 100 });
      for (const holder of page.data.filter((h) => h.accessState === 'OVER_CAPACITY')) {
        expect(BACKEND_OVER_CAPACITY_CAUSES).toContain(holder.cause);
      }
    }
  });
});

describe('seat holders arrive as a Core page', () => {
  it('returns { data, meta } with the envelope counters', async () => {
    const usage = await getSeatUsage();
    const key = usage.modules[0].moduleKey;
    const all = await listSeatHolders(key, { page: 1, limit: 100 });
    const page = await listSeatHolders(key, { page: 1, limit: 1 });
    expect(Object.keys(page).sort()).toEqual(['data', 'meta']);
    expect(page.data.length).toBe(Math.min(1, all.meta.total));
    expect(page.meta).toEqual({
      page: 1,
      limit: 1,
      total: all.meta.total,
      totalPages: Math.max(1, all.meta.total),
      hasNext: all.meta.total > 1,
      hasPrev: false,
    });
  });
});

describe('seat shortfall details (parallel string arrays)', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    key === 'seats.errors.capacityGeneric'
      ? 'Not enough seats.'
      : key === 'seats.errors.SEAT_CAPACITY_INSUFFICIENT'
        ? `${params?.['module']}: needs ${params?.['needed']}, free ${params?.['free']}.`
        : key;

  afterEach(() => {
    setFakeMigrationShort(false);
    setFakeSeatMode('DERIVED');
  });

  it('SEAT_CAPACITY_INSUFFICIENT with details names each module', () => {
    const error = new ApiError(422, 'SEAT_CAPACITY_INSUFFICIENT', {
      moduleKey: ['crm', 'trade'],
      needed: ['3', '1'],
      free: ['1', '0'],
      capacity: ['5', '0'],
      userModuleKey: ['crm', 'crm', 'crm', 'trade'],
      userIds: ['user-1', 'user-2', 'user-3', 'user-4'],
      userNames: ['User One', 'User Two', 'User Three', 'User Four'],
    });
    expect(seatShortfallDetails(error)).toEqual([
      { moduleKey: 'crm', needed: 3, free: 1, capacity: 5, used: null, usedAfter: null, shortfall: null },
      { moduleKey: 'trade', needed: 1, free: 0, capacity: 0, used: null, usedAfter: null, shortfall: null },
    ]);
    expect(seatErrorMessage(t, error)).toBe('crm: needs 3, free 1. trade: needs 1, free 0.');
  });

  it('SEAT_CAPACITY_INSUFFICIENT without details falls back to the generic text', () => {
    const error = new ApiError(422, 'SEAT_CAPACITY_INSUFFICIENT');
    expect(seatShortfallDetails(error)).toEqual([]);
    expect(seatErrorMessage(t, error)).toBe('Not enough seats.');
  });

  it('the fake SEAT_MIGRATION_NOT_READY sends exactly the parallel string arrays', async () => {
    setFakeSeatMode('MANUAL');
    setFakeMigrationShort(true);
    const error = await switchToDerived({}, '019a7c20-0002-7000-8000-000000000099').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: 'SEAT_MIGRATION_NOT_READY' });
    const details = (error as ApiError).details ?? {};
    expect(Object.keys(details).sort()).toEqual([
      'capacity',
      'free',
      'moduleKey',
      'needed',
      'shortfall',
      'used',
      'usedAfter',
      'userIds',
      'userModuleKey',
      'userNames',
    ]);
    for (const value of Object.values(details)) {
      expect(Array.isArray(value) && value.every((item) => typeof item === 'string')).toBe(true);
    }
    const modules = (details['moduleKey'] as string[]).length;
    for (const key of ['needed', 'free', 'capacity', 'used', 'usedAfter', 'shortfall']) {
      expect((details[key] as string[]).length).toBe(modules);
    }
    expect(seatShortfallDetails(error).length).toBeGreaterThan(0);
  });

  it('reads the migration-only used, usedAfter and shortfall arrays by module index', () => {
    const error = new ApiError(409, 'SEAT_MIGRATION_NOT_READY', {
      moduleKey: ['crm'],
      needed: ['3'],
      free: ['1'],
      capacity: ['5'],
      userModuleKey: ['crm', 'crm', 'crm'],
      userIds: ['user-1', 'user-2', 'user-3'],
      userNames: ['User One', 'User Two', 'User Three'],
      used: ['4'],
      usedAfter: ['7'],
      shortfall: ['2'],
    });
    expect(seatShortfallDetails(error)).toEqual([
      { moduleKey: 'crm', needed: 3, free: 1, capacity: 5, used: 4, usedAfter: 7, shortfall: 2 },
    ]);
  });
});
