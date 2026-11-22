import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { getBranding, updateBranding, uploadBrandingIcon, uploadBrandingLogo } from './branding.api';
import { FAKE_BRANDING_FAIL_NEXT } from './branding.fake';
import { brandingErrorKey } from './branding.model';

/*
 * branding.api.ts over branding.fake.ts: GET/PUT/POST all answer the single branding record
 * (Core's envelope `data`, never a page). Validation is CORE_VALIDATION_FAILED keyed by field;
 * uploads answer the BRANDING_FILE_* codes and the idempotency codes of Core's interceptor.
 */

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

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

const BRANDING_KEYS = [
  'appName',
  'createdAt',
  'fontFamily',
  'hasIcon',
  'hasLogo',
  'iconUrl',
  'id',
  'loginHtml',
  'logoUrl',
  'primaryColor',
  'secondaryColor',
  'tabTitle',
  'updatedAt',
];

function png(bytes = 16, name = 'logo.png', type = 'image/png'): File {
  return new File([new Uint8Array(bytes).fill(7)], name, { type });
}

describe('branding api (fake)', () => {
  let imageSize = { width: 200, height: 100 };
  let urlCounter = 0;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    vi.useFakeTimers();
    imageSize = { width: 200, height: 100 };
    vi.stubGlobal('createImageBitmap', async () => ({ ...imageSize, close: () => undefined }));
    URL.createObjectURL = vi.fn(() => `blob:fake-${++urlCounter}`);
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    FAKE_BRANDING_FAIL_NEXT.code = null;
    FAKE_BRANDING_FAIL_NEXT.status = 500;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('getBranding', () => {
    it('returns the single normalised record', async () => {
      const branding = await settle(getBranding());
      expect(Object.keys(branding).sort()).toEqual(BRANDING_KEYS);
      expect(branding).toMatchObject({ primaryColor: '#2563eb', secondaryColor: null, hasLogo: false, hasIcon: false });
    });

    it('throws the queued FAIL_NEXT code once', async () => {
      FAKE_BRANDING_FAIL_NEXT.code = 'BRANDING_STATE_UNAVAILABLE';
      FAKE_BRANDING_FAIL_NEXT.status = 503;
      const error = await errorOf(getBranding());
      expect([error.status, error.code]).toEqual([503, 'BRANDING_STATE_UNAVAILABLE']);
      expect(brandingErrorKey(error)).toBe('wsBranding.errors.BRANDING_STATE_UNAVAILABLE');
      await expect(settle(getBranding())).resolves.toBeTruthy();
    });
  });

  describe('updateBranding', () => {
    it('writes the given fields and leaves the rest', async () => {
      const updated = await settle(updateBranding({ secondaryColor: '#111', appName: 'Delta' }, newIdempotencyKey()));
      expect(updated).toMatchObject({ secondaryColor: '#111', appName: 'Delta', primaryColor: '#2563eb' });
      expect((await settle(getBranding())).appName).toBe('Delta');
    });

    it('clears a field with null', async () => {
      const updated = await settle(updateBranding({ loginHtml: null }, newIdempotencyKey()));
      expect(updated.loginHtml).toBeNull();
    });

    it('answers 400 CORE_VALIDATION_FAILED keyed by field', async () => {
      const colour = await errorOf(updateBranding({ primaryColor: 'blue' }, newIdempotencyKey()));
      expect([colour.status, colour.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
      expect(colour.details).toEqual({ primaryColor: ['primaryColor must be a hexadecimal color'] });

      const name = await errorOf(updateBranding({ appName: 'x'.repeat(121) }, newIdempotencyKey()));
      expect(name.details).toEqual({ appName: ['appName must be shorter than or equal to 120 characters'] });

      const html = await errorOf(updateBranding({ loginHtml: 'x'.repeat(20_001) }, newIdempotencyKey()));
      expect(Object.keys(html.details ?? {})).toEqual(['loginHtml']);
    });

    it('answers 400 INVALID_IDEMPOTENCY_KEY without a key', async () => {
      const error = await errorOf(updateBranding({ appName: 'X' }, ''));
      expect([error.status, error.code]).toEqual([400, 'INVALID_IDEMPOTENCY_KEY']);
    });
  });

  describe('uploads', () => {
    it('uploads a logo and returns the branding record with logoUrl', async () => {
      const branding = await settle(uploadBrandingLogo(png(), newIdempotencyKey()));
      expect(Object.keys(branding).sort()).toEqual(BRANDING_KEYS);
      expect(branding.hasLogo).toBe(true);
      expect(branding.logoUrl).toMatch(/^blob:fake-/);
    });

    it('replaces the previous blob url when a new icon is uploaded', async () => {
      const first = await settle(uploadBrandingIcon(png(8, 'icon.png'), newIdempotencyKey()));
      const second = await settle(uploadBrandingIcon(png(9, 'icon.png'), newIdempotencyKey()));
      expect(second.iconUrl).not.toBe(first.iconUrl);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(first.iconUrl);
    });

    it('replays the same key and file, and answers 422 IDEMPOTENCY_BODY_MISMATCH for another file', async () => {
      const key = newIdempotencyKey();
      const first = await settle(uploadBrandingLogo(png(20), key));
      const replay = await settle(uploadBrandingLogo(png(20), key));
      expect(replay.logoUrl).toBe(first.logoUrl);
      const mismatch = await errorOf(uploadBrandingLogo(png(21), key));
      expect([mismatch.status, mismatch.code]).toEqual([422, 'IDEMPOTENCY_BODY_MISMATCH']);
    });

    it('answers 400 INVALID_IDEMPOTENCY_KEY for a non-UUIDv7 key', async () => {
      const error = await errorOf(uploadBrandingLogo(png(), 'abc'));
      expect([error.status, error.code]).toEqual([400, 'INVALID_IDEMPOTENCY_KEY']);
    });

    it('answers the file codes with their status', async () => {
      const type = await errorOf(uploadBrandingLogo(png(10, 'a.gif', 'image/gif'), newIdempotencyKey()));
      expect([type.status, type.code]).toEqual([415, 'BRANDING_FILE_TYPE_UNSUPPORTED']);

      const big = await errorOf(uploadBrandingIcon(png(512 * 1024 + 1, 'big.png'), newIdempotencyKey()));
      expect([big.status, big.code]).toEqual([413, 'BRANDING_FILE_TOO_LARGE']);

      const empty = await errorOf(uploadBrandingLogo(png(0), newIdempotencyKey()));
      expect([empty.status, empty.code]).toEqual([400, 'BRANDING_FILE_INVALID']);

      imageSize = { width: 2000, height: 10 };
      const edge = await errorOf(uploadBrandingIcon(png(10, 'wide.png'), newIdempotencyKey()));
      expect([edge.status, edge.code]).toEqual([400, 'BRANDING_FILE_INVALID']);
    });

    it('answers BRANDING_STORAGE_UNAVAILABLE as 503 after the file checks', async () => {
      FAKE_BRANDING_FAIL_NEXT.code = 'BRANDING_STORAGE_UNAVAILABLE';
      const error = await errorOf(uploadBrandingLogo(png(), newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([503, 'BRANDING_STORAGE_UNAVAILABLE']);
      expect(FAKE_BRANDING_FAIL_NEXT.code).toBeNull();
    });
  });
});
