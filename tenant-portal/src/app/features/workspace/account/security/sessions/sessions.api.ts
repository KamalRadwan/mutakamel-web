import { fakeListSessions, fakeLogoutAll, fakeRevokeSession } from './sessions.fake';
import { SessionList } from './sessions.model';

// Real browser base: /api/tenant/core/v1 (envelope { data }). Self-service. Responses are private, no-store.
// Writes use the credentialed CSRF channel and are never auto-retried.

/** GET /auth/sessions?historyPage=n — all active (current first) on every page + 50 ended per page; 400 CORE_VALIDATION_FAILED */
export function listSessions(historyPage = 1): Promise<SessionList> {
  return fakeListSessions(historyPage);
}

/** DELETE /auth/sessions/:id → 204 (also when already ended or not owned), endReason DEVICE_REVOKED; 400 COMMON.VALIDATION.UUID_V7_INVALID; current id → cookies cleared = signed out */
export function revokeSession(id: string): Promise<void> {
  return fakeRevokeSession(id);
}

/** POST /auth/logout-all → 204; ends EVERY session incl. this one */
export function logoutAll(): Promise<void> {
  return fakeLogoutAll();
}
