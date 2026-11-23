import { describe, expect, it } from 'vitest';
import type { AuthMe } from './auth-me';
import { CurrentUser } from './current-user';

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
  workspace: { timezone: 'Pacific/Auckland', defaultLanguage: 'en' },
};

describe('CurrentUser authenticated identity', () => {
  it('has no identity or timezone before /me succeeds', () => {
    const current = new CurrentUser();
    expect(current.user()).toEqual({ displayName: '', email: '' });
    expect(current.userId()).toBe('');
    expect(current.timeZone()).toBe('');
    expect(current.initials()).toBe('');
  });

  it('uses the server identity and workspace timezone and clears them on reset', () => {
    const current = new CurrentUser();
    current.set(PROFILE);
    expect(current.userId()).toBe(PROFILE.id);
    expect(current.timeZone()).toBe('Pacific/Auckland');
    expect(current.initials()).toBe('NS');
    current.reset();
    expect(current.user()).toEqual({ displayName: '', email: '' });
    expect(current.userId()).toBe('');
    expect(current.timeZone()).toBe('');
    expect(current.initials()).toBe('');
  });

  it('updates timezone from a newer /me and never retains a previous user after reset', () => {
    const current = new CurrentUser();
    current.set(PROFILE);
    current.set({ ...PROFILE, workspace: { timezone: 'Asia/Dubai', defaultLanguage: 'ar' } });
    expect(current.timeZone()).toBe('Asia/Dubai');
    current.reset();
    current.set({ ...PROFILE, id: '019af27b-5e00-7000-8000-000000000002', firstName: 'Omar' });
    expect(current.userId()).toBe('019af27b-5e00-7000-8000-000000000002');
    expect(current.initials()).toBe('OS');
    expect(current.timeZone()).toBe('Pacific/Auckland');
  });

  it('does not partially replace a verified user with malformed profile data', () => {
    const current = new CurrentUser();
    current.set(PROFILE);
    const previous = current.user();
    expect(() => current.set({ ...PROFILE, firstName: 'Changed', workspace: { ...PROFILE.workspace, timezone: '' } }))
      .toThrowError('COMMON.GENERIC.INTERNAL_ERROR');
    expect(current.user()).toBe(previous);
  });
});
