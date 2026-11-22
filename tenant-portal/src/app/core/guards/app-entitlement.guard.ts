import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthSession } from '../auth/auth-session';

export function requireApp(appId: string): CanActivateFn {
  return async () => {
    const session = inject(AuthSession);
    const router = inject(Router);
    const status = await session.ensureLoaded();
    // The parent guard owns sign-in redirects and the shell's load-failure view.
    if (status !== 'signed-in') return true;

    const subscribed = session
      .me()
      ?.seats.some(
        (seat) =>
          seat.moduleKey === appId &&
          (seat.accessState === 'ACTIVE' || seat.accessState === 'OVER_CAPACITY'),
      );
    return subscribed ? true : router.createUrlTree(['/workspace']);
  };
}
