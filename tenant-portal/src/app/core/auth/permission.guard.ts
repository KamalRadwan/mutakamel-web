import { inject } from '@angular/core';
import { type CanActivateFn, RedirectCommand, Router } from '@angular/router';
import { AuthSession } from './auth-session';
import { hasScopedPermission } from './scoped-permission';

export function requirePermission(
  keys: string | readonly string[],
  options: { any?: boolean; scoped?: boolean } = {},
): CanActivateFn {
  return async () => {
    const session = inject(AuthSession);
    const router = inject(Router);
    const status = await session.ensureLoaded();
    // The parent guard owns sign-in redirects and the shell's load-failure view.
    if (status !== 'signed-in') return true;

    const permissions = typeof keys === 'string' ? [keys] : keys;
    const hasPermission = (key: string) => options.scoped === true
      ? hasScopedPermission(session.me()?.permissions ?? [], key)
      : session.hasPermission(key);
    const allowed =
      options.any === true
        ? permissions.some(hasPermission)
        : permissions.every(hasPermission);
    return allowed
      ? true
      : new RedirectCommand(router.parseUrl('/forbidden'), { skipLocationChange: true });
  };
}
