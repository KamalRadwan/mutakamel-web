import { describe, expect, it } from 'vitest';
import { userFromMe } from './auth-me';
import { FAKE_ME, FAKE_TIME_ZONE, FAKE_USER, FAKE_USER_ID } from './current-user.fake';

describe('userFromMe (GET /tenant/auth/me)', () => {
  it('builds the display name from firstName and lastName', () => {
    expect(userFromMe({ ...FAKE_ME, firstName: 'Noura', lastName: 'Saleh' })).toEqual({
      id: FAKE_ME.id,
      displayName: 'Noura Saleh',
      email: FAKE_ME.email,
    });
  });

  it('keeps the fake user the shape other features read', () => {
    expect(FAKE_USER).toEqual({ id: FAKE_USER_ID, displayName: 'Kamal Radwan', email: 'owner@mutakamel.io', timeZone: FAKE_TIME_ZONE });
  });
});
