import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthSession, DEFAULT_SIGNED_IN_URL, safeReturnUrl } from './auth-session';

/** Ensures the session is bootstrapped before entering the authenticated app layout. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  const status = session.status() === 'failed' ? 'failed' : await session.ensureLoaded();
  if (status === 'signed-in') return true;
  // The layout renders its standalone retry state with no protected outlet.
  if (status === 'failed') return true;
  const returnUrl = safeReturnUrl(state.url);
  return returnUrl
    ? router.createUrlTree(['/login'], { queryParams: { returnUrl } })
    : router.createUrlTree(['/login']);
};

/** Checks for existing access before showing /login in a fresh tab. */
export const guestGuard: CanActivateFn = async (route) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  if (await session.ensureLoaded('guest') !== 'signed-in') {
    return true;
  }
  const target = safeReturnUrl(route.queryParams['returnUrl']) ?? DEFAULT_SIGNED_IN_URL;
  return router.parseUrl(target);
};
