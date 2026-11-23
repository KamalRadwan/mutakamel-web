import { describe, expect, it } from 'vitest';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import { actorDisplayName } from './actor';

describe('actorDisplayName', () => {
  it('uses the authenticated user instead of a lookup for that user', () => {
    const me = { ...FAKE_TENANT_ME, firstName: 'Session', lastName: 'User' };
    expect(actorDisplayName(me.id, me, { ...me, firstName: 'Old' }, '—')).toBe('Session User');
  });

  it('uses only the matching Workspace user and falls back to its email for an empty name', () => {
    const user = { id: 'publisher', firstName: 'Mona', lastName: 'Saleh', email: 'mona@example.test' };
    expect(actorDisplayName(user.id, null, user, '—')).toBe('Mona Saleh');
    expect(actorDisplayName(user.id, null, { ...user, firstName: '', lastName: '' }, '—')).toBe(user.email);
    expect(actorDisplayName('another-user', null, user, '—')).toBe('—');
  });

  it('uses the caller’s empty label for missing or unresolved identities', () => {
    expect(actorDisplayName(null, null, undefined, '—')).toBe('—');
    expect(actorDisplayName('unknown', null, undefined, 'غير متاح')).toBe('غير متاح');
  });
});
