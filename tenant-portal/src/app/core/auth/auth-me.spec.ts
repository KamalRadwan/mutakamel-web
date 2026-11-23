import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/api-errors';
import { type AuthMe, userFromMe } from './auth-me';

const PROFILE: AuthMe = {
  id: '019af27b-5e00-7000-8000-000000000001',
  email: 'noura@example.com',
  firstName: 'Noura',
  lastName: 'Saleh',
  hasAvatar: false,
  isTenantOwner: false,
  mfaEnabled: false,
  mfaUpdatedAt: null,
  status: 'ACTIVE',
  workspace: { timezone: 'Asia/Riyadh', defaultLanguage: 'ar' },
};

describe('userFromMe (GET /tenant/auth/me)', () => {
  it('builds the display name from firstName and lastName', () => {
    expect(userFromMe(PROFILE)).toEqual({
      id: PROFILE.id,
      displayName: 'Noura Saleh',
      email: PROFILE.email,
      timeZone: 'Asia/Riyadh',
    });
  });

  it.each(['UTC', 'Pacific/Auckland', 'America/New_York'])('keeps the server timezone %s', (timezone) => {
    expect(userFromMe({ ...PROFILE, workspace: { ...PROFILE.workspace, timezone } }).timeZone).toBe(timezone);
  });

  it('trims the composed display name when one name is empty', () => {
    expect(userFromMe({ ...PROFILE, firstName: '' }).displayName).toBe('Saleh');
    expect(userFromMe({ ...PROFILE, lastName: '' }).displayName).toBe('Noura');
  });

  it.each([
    null,
    {},
    { ...PROFILE, id: '' },
    { ...PROFILE, id: ' ' },
    { ...PROFILE, email: null },
    { ...PROFILE, firstName: null },
    { ...PROFILE, lastName: null },
    { ...PROFILE, workspace: undefined },
    { ...PROFILE, workspace: null },
    { ...PROFILE, workspace: { timezone: '' } },
    { ...PROFILE, workspace: { timezone: ' ' } },
    { ...PROFILE, workspace: { timezone: 2 } },
    { ...PROFILE, workspace: { timezone: 'Invalid/Zone' } },
  ])('rejects malformed identity or timezone without fabricating a user (%j)', (body) => {
    expect(() => userFromMe(body as AuthMe)).toThrowError(ApiError);
    expect(() => userFromMe(body as AuthMe)).toThrowError('COMMON.GENERIC.INTERNAL_ERROR');
  });
});
