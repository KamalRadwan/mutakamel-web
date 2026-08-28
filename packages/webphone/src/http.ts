/**
 * The subset of a portal HTTP client the WebPhone needs. Each portal injects
 * its own client so the shared package never picks an auth or session mode.
 */

export type WebphoneRequestOptions = {
  /** The Gateway route explicitly does not participate in idempotency. */
  skipAutoIdempotency?: boolean;
  /** Refresh may repair the session, but this request is never replayed. */
  nonReplayable?: boolean;
  cache?: RequestCache;
};

export interface WebphoneHttpClient {
  get<T>(url: string): Promise<{ data: T }>;
  post<T>(
    url: string,
    body?: unknown,
    options?: WebphoneRequestOptions,
  ): Promise<{ data: T }>;
}
