import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import {
  deleteAvatar,
  getAvatar,
  getMe,
  getMyProfile,
  updateMyName,
  updateMyProfile,
  uploadAvatar,
} from './preferences.api';
import { resetPreferencesFake } from './preferences.fake';
import { AVATAR_MAX_BYTES } from './preferences.model';

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

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

function image(name: string, type: string, size = 10): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('preferences fake (backend contract)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetPreferencesFake();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('PATCH users/me', () => {
    it('returns the user view (no hasAvatar) with trimmed names', async () => {
      const user = await settle(updateMyName({ firstName: '  Sara ' }));
      expect(user.firstName).toBe('Sara');
      expect(user.status).toBe('ACTIVE');
      expect('hasAvatar' in user).toBe(false);
      expect((await settle(getMe())).firstName).toBe('Sara');
    });

    it('rejects a blank or too long name with 400 CORE_VALIDATION_FAILED keyed by field', async () => {
      const error = await failure(updateMyName({ firstName: '   ', lastName: 'x'.repeat(81) }));
      expect([error.status, error.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
      expect(error.details).toEqual({ firstName: ['is_not_empty'], lastName: ['max_length'] });
    });
  });

  describe('PUT users/me/profile', () => {
    it('keeps updatedAt when nothing changed and merges extensions', async () => {
      const before = await settle(getMyProfile());
      const same = await settle(updateMyProfile({ themeKey: before.themeKey }));
      expect(same.updatedAt).toBe(before.updatedAt);
      const next = await settle(updateMyProfile({ extensions: { startPage: 'home' } }));
      expect(next.extensions).toEqual({ startPage: 'home' });
      expect(next.updatedAt).not.toBe(before.updatedAt);
    });

    it('accepts an empty themeKey like the DTO and rejects one over 64 characters', async () => {
      await expect(settle(updateMyProfile({ themeKey: '' }))).resolves.toMatchObject({ themeKey: '' });
      const error = await failure(updateMyProfile({ themeKey: 'x'.repeat(65) }));
      expect([error.status, error.code, error.details]).toEqual([400, 'CORE_VALIDATION_FAILED', { themeKey: ['max_length'] }]);
    });

    it('rejects an unsupported language with 400', async () => {
      const error = await failure(updateMyProfile({ language: 'fr' as 'en' }));
      expect(error.details).toEqual({ language: ['is_in'] });
    });

    it('rejects extensions over 16 KB with 422 PROFILE_EXTENSIONS_TOO_LARGE', async () => {
      const error = await failure(updateMyProfile({ extensions: { blob: 'x'.repeat(17 * 1024) } }));
      expect([error.status, error.code]).toEqual([422, 'PROFILE_EXTENSIONS_TOO_LARGE']);
    });
  });

  describe('profile/avatar', () => {
    it('stores, serves and removes the avatar', async () => {
      await settle(uploadAvatar(image('me.png', 'image/png')));
      expect((await settle(getMe())).hasAvatar).toBe(true);
      expect((await settle(getAvatar())).size).toBe(10);
      await settle(deleteAvatar());
      expect((await settle(getMe())).hasAvatar).toBe(false);
    });

    it('answers 404 PARTY_IMAGE_NOT_FOUND for get and delete without an avatar', async () => {
      const get = await failure(getAvatar());
      const del = await failure(deleteAvatar());
      expect([get.status, get.code]).toEqual([404, 'PARTY_IMAGE_NOT_FOUND']);
      expect([del.status, del.code]).toEqual([404, 'PARTY_IMAGE_NOT_FOUND']);
    });

    it('rejects a wrong type or mismatched extension with 415 PARTY_IMAGE_INVALID', async () => {
      const gif = await failure(uploadAvatar(image('me.gif', 'image/gif')));
      const mismatch = await failure(uploadAvatar(image('me.jpg', 'image/png')));
      expect([gif.status, gif.code]).toEqual([415, 'PARTY_IMAGE_INVALID']);
      expect([mismatch.status, mismatch.code]).toEqual([415, 'PARTY_IMAGE_INVALID']);
    });

    it('rejects a file over 2 MB with 413 PARTY_IMAGE_TOO_LARGE', async () => {
      const error = await failure(uploadAvatar(image('me.webp', 'image/webp', AVATAR_MAX_BYTES + 1)));
      expect([error.status, error.code]).toEqual([413, 'PARTY_IMAGE_TOO_LARGE']);
    });
  });
});
