import { inject } from '@angular/core';
import { type CanActivateFn, RedirectCommand, Router } from '@angular/router';
import { AuthSession } from '../../../../core/auth/auth-session';

export const requireOwner: CanActivateFn = async () => {
  const session = inject(AuthSession);
  const router = inject(Router);
  const status = await session.ensureLoaded();
  // The parent guard owns sign-in redirects and the shell's load-failure view.
  if (status !== 'signed-in') return true;
  return session.me()?.isTenantOwner === true
    ? true
    : new RedirectCommand(router.parseUrl('/forbidden'), { skipLocationChange: true });
};
