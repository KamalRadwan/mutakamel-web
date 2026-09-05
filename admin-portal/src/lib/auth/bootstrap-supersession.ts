/**
 * A bootstrap `/auth/me` answers a question about whatever session existed
 * when it was sent. That question can stop being the current one while the
 * request is still out: `/login` is a public route rendered *during*
 * bootstrap, so an operator can finish signing in — committing new session
 * metadata and a new profile — before the cold check they started with ever
 * comes back.
 *
 * Nothing about the late answer describes the session the operator now has.
 * It may be a `401` for the session that was missing, a `409
 * AUTH_SESSION_CHANGED` raised by the client's own epoch fence once it
 * notices the newly stored metadata, or a `200` carrying the profile of
 * whoever was signed in before. Applying any of them overwrites a sign-in
 * that succeeded.
 *
 * So the provider counts the points at which it commits authoritative session
 * state locally, the bootstrap captures that count when it starts, and a
 * result whose count no longer matches is dropped rather than written.
 */
export interface AdminBootstrapWindow {
  /** The session-commit count read when the bootstrap request went out. */
  commitAtRequest: number;
  /** The session-commit count now that the bootstrap has settled. */
  currentCommit: number;
}

export function isSupersededAdminBootstrap({
  commitAtRequest,
  currentCommit,
}: AdminBootstrapWindow): boolean {
  return commitAtRequest !== currentCommit;
}
