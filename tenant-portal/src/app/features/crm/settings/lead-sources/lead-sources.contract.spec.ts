import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import {
  createLeadSource,
  deleteLeadSource,
  listLeadSources,
  reorderLeadSources,
  updateLeadSource,
  uploadLeadSourceIcon,
} from './lead-sources.api';
import { LEAD_SOURCE_ICON_MAX_BYTES, LEAD_SOURCE_NAME_MAX } from './lead-sources.model';

/** Runs the fake timers to completion and returns (or rethrows) the settled result. */
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

async function errorOf(promise: Promise<unknown>): Promise<ApiError | undefined> {
  try {
    await settle(promise);
    return undefined;
  } catch (error) {
    return error instanceof ApiError ? error : undefined;
  }
}

const WEBSITE_ID = '00000000-0000-7000-8000-000000000001'; // seeded, in use
const OFFLINE_ID = '00000000-0000-7000-8000-00000000000c'; // seeded, not in use
const MISSING_ID = '00000000-0000-7000-8000-0000000000ff';

function file(name: string, type: string, size = 16): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('lead sources contract (crm acquisition-sources)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('GET acquisition-sources', () => {
    it('returns a bare array ordered by sortOrder', async () => {
      const list = await settle(listLeadSources());
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      expect(list.map((item) => item.sortOrder)).toEqual(list.map((_, index) => index + 1));
      expect(list[0]).toEqual({
        id: WEBSITE_ID,
        nameAr: expect.any(String),
        nameEn: 'Website',
        isActive: true,
        sortOrder: 1,
        iconUrl: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('POST acquisition-sources', () => {
    it('creates a trimmed, active source at the end with no icon', async () => {
      const before = await settle(listLeadSources());
      const created = await settle(createLeadSource({ nameAr: '  معرض  ', nameEn: '  Trade show  ' }));
      expect(created).toEqual({
        id: expect.any(String),
        nameAr: 'معرض',
        nameEn: 'Trade show',
        isActive: true,
        sortOrder: before.length + 1,
        iconUrl: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      const after = await settle(listLeadSources());
      expect(after.at(-1)?.id).toBe(created.id);
    });

    it('keeps isActive false when asked', async () => {
      const created = await settle(createLeadSource({ nameAr: 'نشرة', nameEn: 'Newsletter', isActive: false }));
      expect(created.isActive).toBe(false);
    });

    it('answers a name already used (any case, either language) with 409 CRM_ACQUISITION_SOURCE_NAME_TAKEN', async () => {
      const en = await errorOf(createLeadSource({ nameAr: 'جديد', nameEn: ' website ' }));
      expect(en?.status).toBe(409);
      expect(en?.code).toBe('CRM_ACQUISITION_SOURCE_NAME_TAKEN');
      expect(en?.details).toBeUndefined();

      const ar = await errorOf(createLeadSource({ nameAr: 'فيسبوك', nameEn: 'Brand new' }));
      expect(ar?.code).toBe('CRM_ACQUISITION_SOURCE_NAME_TAKEN');
    });

    it('rejects a blank or too long name', async () => {
      const blank = await errorOf(createLeadSource({ nameAr: '   ', nameEn: 'Blank' }));
      expect(blank).toBeInstanceOf(ApiError);
      const long = await errorOf(createLeadSource({ nameAr: 'طويل', nameEn: 'x'.repeat(LEAD_SOURCE_NAME_MAX + 1) }));
      expect(long).toBeInstanceOf(ApiError);
    });

    // Backend CreateAcquisitionSourceDto: @IsNotEmpty @MaxLength(120), so the ValidationPipe answers
    // 400 CRM_VALIDATION_FAILED with details keyed by the field.
    it('a blank name is 400 CRM_VALIDATION_FAILED keyed by nameAr', async () => {
      const error = await errorOf(createLeadSource({ nameAr: '   ', nameEn: 'Blank' }));
      expect(error?.status).toBe(400);
      expect(error?.code).toBe('CRM_VALIDATION_FAILED');
      expect(error?.details).toEqual({ nameAr: expect.any(Array) });
    });
  });

  describe('PATCH acquisition-sources/:id', () => {
    it('updates the given fields and keeps the rest', async () => {
      const updated = await settle(updateLeadSource(OFFLINE_ID, { nameEn: ' Offline import ', isActive: false }));
      expect(updated.id).toBe(OFFLINE_ID);
      expect(updated.nameEn).toBe('Offline import');
      expect(updated.nameAr).toBe('بيانات غير متصلة');
      expect(updated.isActive).toBe(false);
    });

    it('allows keeping its own name and rejects another source name', async () => {
      const own = await settle(updateLeadSource(OFFLINE_ID, { nameEn: 'OFFLINE IMPORT' }));
      expect(own.nameEn).toBe('OFFLINE IMPORT');

      const taken = await errorOf(updateLeadSource(OFFLINE_ID, { nameEn: 'Facebook' }));
      expect(taken?.status).toBe(409);
      expect(taken?.code).toBe('CRM_ACQUISITION_SOURCE_NAME_TAKEN');
    });

    it('answers an unknown id with 404 CRM_ACQUISITION_SOURCE_NOT_FOUND', async () => {
      const error = await errorOf(updateLeadSource(MISSING_ID, { isActive: true }));
      expect(error?.status).toBe(404);
      expect(error?.code).toBe('CRM_ACQUISITION_SOURCE_NOT_FOUND');
    });

    // Backend UpdateAcquisitionSourceDto: @IsNotEmpty @MaxLength(120).
    it('a too long name is 400 CRM_VALIDATION_FAILED keyed by nameEn', async () => {
      const error = await errorOf(updateLeadSource(OFFLINE_ID, { nameEn: 'x'.repeat(LEAD_SOURCE_NAME_MAX + 1) }));
      expect(error?.status).toBe(400);
      expect(error?.code).toBe('CRM_VALIDATION_FAILED');
      expect(error?.details).toEqual({ nameEn: expect.any(Array) });
    });
  });

  describe('PATCH acquisition-sources/reorder', () => {
    it('needs a UUID v7 x-idempotency-key at the gateway', async () => {
      const ids = (await settle(listLeadSources())).map((item) => item.id);
      const missing = await errorOf(reorderLeadSources(ids, ''));
      expect(missing?.status).toBe(400);
      expect(missing?.code).toBe('GW.IDEM.MISSING');

      const bad = await errorOf(reorderLeadSources(ids, 'not-a-uuid'));
      expect(bad?.status).toBe(400);
      expect(bad?.code).toBe('GW.IDEM.BAD_VALUE');
    });

    it('returns the whole list in the new order', async () => {
      const ids = (await settle(listLeadSources())).map((item) => item.id);
      const reversed = [...ids].reverse();
      const list = await settle(reorderLeadSources(reversed, newIdempotencyKey()));
      expect(list.map((item) => item.id)).toEqual(reversed);
      expect(list.map((item) => item.sortOrder)).toEqual(reversed.map((_, index) => index + 1));
      expect((await settle(listLeadSources())).map((item) => item.id)).toEqual(reversed);
    });

    it('answers a partial, duplicated or unknown id list with 422 CRM_ACQUISITION_SOURCE_REORDER_INVALID', async () => {
      const ids = (await settle(listLeadSources())).map((item) => item.id);
      const cases = [ids.slice(1), [ids[0], ...ids.slice(0, -1)], [MISSING_ID, ...ids.slice(1)]];
      for (const orderedIds of cases) {
        const error = await errorOf(reorderLeadSources(orderedIds, newIdempotencyKey()));
        expect(error?.status).toBe(422);
        expect(error?.code).toBe('CRM_ACQUISITION_SOURCE_REORDER_INVALID');
      }
    });
  });

  describe('DELETE acquisition-sources/:id', () => {
    it('answers a source used by leads with 409 CRM_ACQUISITION_SOURCE_IN_USE', async () => {
      const error = await errorOf(deleteLeadSource(WEBSITE_ID));
      expect(error?.status).toBe(409);
      expect(error?.code).toBe('CRM_ACQUISITION_SOURCE_IN_USE');
    });

    it('deletes an unused source and renumbers the rest', async () => {
      const result = await settle(deleteLeadSource(OFFLINE_ID));
      expect(result).toBeUndefined();
      const list = await settle(listLeadSources());
      expect(list.some((item) => item.id === OFFLINE_ID)).toBe(false);
      expect(list.map((item) => item.sortOrder)).toEqual(list.map((_, index) => index + 1));
    });

    it('answers an unknown id with 404 CRM_ACQUISITION_SOURCE_NOT_FOUND', async () => {
      const error = await errorOf(deleteLeadSource(OFFLINE_ID));
      expect(error?.status).toBe(404);
      expect(error?.code).toBe('CRM_ACQUISITION_SOURCE_NOT_FOUND');
    });
  });

  describe('POST acquisition-sources/:id/icon', () => {
    it('needs a UUID v7 x-idempotency-key at the gateway', async () => {
      const missing = await errorOf(uploadLeadSourceIcon(WEBSITE_ID, file('a.png', 'image/png'), ''));
      expect(missing?.code).toBe('GW.IDEM.MISSING');
      const bad = await errorOf(uploadLeadSourceIcon(WEBSITE_ID, file('a.png', 'image/png'), 'abc'));
      expect(bad?.code).toBe('GW.IDEM.BAD_VALUE');
    });

    it('stores the icon and returns the bare updated source', async () => {
      const updated = await settle(uploadLeadSourceIcon(WEBSITE_ID, file('logo.png', 'image/png'), newIdempotencyKey()));
      expect(updated.id).toBe(WEBSITE_ID);
      expect(typeof updated.iconUrl).toBe('string');
      expect(updated.iconUrl).not.toBe('');
    });

    it('accepts a file without a type when the extension is known', async () => {
      const updated = await settle(uploadLeadSourceIcon(WEBSITE_ID, file('logo.jpeg', ''), newIdempotencyKey()));
      expect(updated.iconUrl).toBeTruthy();
    });

    it('maps each icon problem to its status and code', async () => {
      const key = () => newIdempotencyKey();
      const cases: [File, number, string][] = [
        [file('empty.png', 'image/png', 0), 400, 'CRM_ACQUISITION_SOURCE_ICON_EMPTY'],
        [file('big.png', 'image/png', LEAD_SOURCE_ICON_MAX_BYTES + 1), 413, 'CRM_ACQUISITION_SOURCE_ICON_TOO_LARGE'],
        [file('icon.svg', 'image/svg+xml'), 415, 'CRM_ACQUISITION_SOURCE_ICON_TYPE_UNSUPPORTED'],
        [file('icon.gif', 'image/png'), 415, 'CRM_ACQUISITION_SOURCE_ICON_EXTENSION_UNSUPPORTED'],
      ];
      for (const [icon, status, code] of cases) {
        const error = await errorOf(uploadLeadSourceIcon(WEBSITE_ID, icon, key()));
        expect(error?.status).toBe(status);
        expect(error?.code).toBe(code);
      }
    });

    it('answers an unknown id with 404 CRM_ACQUISITION_SOURCE_NOT_FOUND', async () => {
      const error = await errorOf(uploadLeadSourceIcon(MISSING_ID, file('a.png', 'image/png'), newIdempotencyKey()));
      expect(error?.status).toBe(404);
      expect(error?.code).toBe('CRM_ACQUISITION_SOURCE_NOT_FOUND');
    });
  });
});
