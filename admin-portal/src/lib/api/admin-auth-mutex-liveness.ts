/**
 * Liveness for the persisted auth mutex used where `navigator.locks` is
 * unavailable.
 *
 * A holder of that mutex rewrites its record every twenty seconds, pushing
 * `expiresAt` forward. The long active lease behind that renewal — thirteen
 * hours — exists so a suspended tab whose callback is still outstanding is
 * not overtaken while the browser has simply stopped running its timers.
 *
 * That lease is also what a tab leaves behind when it is closed or killed
 * mid-callback: the `finally` that would have removed the record never runs,
 * and the record sits in this origin's storage claiming the mutex until it
 * expires. Reopening the browser does not clear it. Every later sign-in waits
 * behind a tab that no longer exists, for as long as thirteen hours.
 *
 * The record cannot say whether its writer is alive, but a waiter can watch
 * whether it is still being renewed. A holder that has not renewed for far
 * longer than its own renewal period — allowing generously for a background
 * tab's throttled timers — is treated as abandoned and retired, and the
 * waiter takes the mutex.
 *
 * This does not weaken the fencing that lease was protecting. Taking the
 * mutex writes a newer auth intent, so a suspended holder that later wakes
 * and resumes fails its intent check and is refused with
 * `409 AUTH_SESSION_CHANGED` before it can mutate a cookie, exactly as an
 * overtaken waiter already is. What the wait bounds is how long a dead tab
 * may keep an administrator out of the portal.
 */

/**
 * How long a holder may go without renewing before a waiter retires it.
 *
 * The renewal period is twenty seconds. Chrome throttles a background tab's
 * timers to roughly one per minute after five minutes hidden, so three
 * minutes of complete silence is well clear of a living holder while
 * remaining a wait an operator can sit through.
 */
export const ADMIN_AUTH_MUTEX_ORPHAN_GRACE_MS = 3 * 60_000;

export interface AdminAuthMutexLeaseObservation {
  /** The holder's `expiresAt` when this waiter last saw it change. */
  observedExpiresAt: number;
  /** When that value was first observed, or last seen to advance. */
  observedAt: number;
}

/**
 * Folds one poll of a holder's record into what this waiter has seen so far.
 * A changed `expiresAt` is a renewal, which restarts the silence.
 */
export function observeAdminAuthMutexLease(
  previous: AdminAuthMutexLeaseObservation | undefined,
  expiresAt: number,
  now: number,
): AdminAuthMutexLeaseObservation {
  if (!previous || previous.observedExpiresAt !== expiresAt) {
    return { observedExpiresAt: expiresAt, observedAt: now };
  }
  return previous;
}

export function isAbandonedAdminAuthMutexLease(
  observation: AdminAuthMutexLeaseObservation,
  now: number,
  graceMs: number = ADMIN_AUTH_MUTEX_ORPHAN_GRACE_MS,
): boolean {
  return now - observation.observedAt >= graceMs;
}
