import { ApiError } from '../../../core/api/api-errors';
import { notificationsErrorMessage } from './notifications.api';

describe('notification write error text', () => {
  it('uses scoped 401 text before the generic session-expiry text', () => {
    const t = (key: string) => (key === 'wsNotif.errors.notSaved' ? 'Not saved. Try again.' : key);
    expect(
      notificationsErrorMessage(new ApiError(401, 'GW.AUTH.UNAUTHORIZED'), 'wsNotif', t, 'write'),
    ).toBe('Not saved. Try again.');
  });

  it('falls back to core error messages for gateway conflicts and server failures', () => {
    const t = (key: string) => (key === 'apiErrors.idempotency' ? 'Try again.' : key);
    expect(
      notificationsErrorMessage(new ApiError(409, 'GW.IDEM.IN_FLIGHT'), 'wsNotif', t, 'write'),
    ).toBe('Try again.');
  });
});
