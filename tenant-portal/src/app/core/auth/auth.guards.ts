import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthSession, safeReturnUrl } from './auth-session';

/** Ensures the session is bootstrapped before entering the authenticated app layout. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  const status = await session.ensureLoaded();
  if (status === 'signed-in' || status === 'failed') {
    return true;
  }
  const returnUrl = safeReturnUrl(state.url);
  return returnUrl
    ? router.createUrlTree(['/login'], { queryParams: { returnUrl } })
    : router.createUrlTree(['/login']);
};

/** Keeps already signed-in users out of /login using in-memory state only (no network call). */
export const guestGuard: CanActivateFn = (route) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  if (session.status() !== 'signed-in') {
    return true;
  }
  const target = safeReturnUrl(route.queryParams['returnUrl']) ?? '/';
  return router.parseUrl(target);
};
