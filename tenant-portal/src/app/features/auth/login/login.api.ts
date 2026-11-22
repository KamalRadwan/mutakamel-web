import { fakeLogin } from './login.fake';
import { LoginBody, LoginResult } from './login.model';

/**
 * POST /tenant/auth/login → the `data` part of the Core envelope.
 * - `remember` is sent as the header `x-auth-remember: 1`, never in the body or the URL.
 * - Credentials go in the JSON body only; never log the body.
 * - No x-idempotency-key: the gateway row is PUBLIC and not idempotent. Never retry automatically.
 * - Errors: 400 CORE_VALIDATION_FAILED, 401 INVALID_CREDENTIALS, 403 SUBSCRIPTION_PAST_DUE,
 *   404 TENANT_NOT_RESOLVABLE, 409 AUTH_SESSION_LIMIT_REACHED, 429 AUTH_LOGIN_THROTTLED / AUTH_MFA_THROTTLED
 *   (details.retryAfterSeconds), 429 COMMON.GENERIC.RATE_LIMITED (Retry-After only),
 *   503 PLATFORM_MAINTENANCE / AUTH_MFA_UNAVAILABLE.
 */
export function login(body: LoginBody, remember: boolean): Promise<LoginResult> {
  return fakeLogin(body, remember);
}
