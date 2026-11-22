import { type AuthMe, userFromMe } from './auth-me';

export const FAKE_USER_ID = 'u1';
export const FAKE_TIME_ZONE = 'Africa/Cairo';

/** GET /tenant/auth/me identity fields. The id stays 'u1' because other feature fakes match it. */
export const FAKE_ME: AuthMe = {
  id: FAKE_USER_ID,
  email: 'owner@mutakamel.io',
  firstName: 'Kamal',
  lastName: 'Radwan',
  hasAvatar: false,
  isTenantOwner: true,
  mfaEnabled: false,
  mfaUpdatedAt: null,
  status: 'ACTIVE',
};

// FAKE-ONLY: /me has no time zone; the real source is still open.
export const FAKE_USER = userFromMe(FAKE_ME, FAKE_TIME_ZONE);
