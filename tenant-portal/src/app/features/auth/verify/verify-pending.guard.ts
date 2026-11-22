import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { MfaPending } from '../shared/mfa-pending';

/** Allows `/verify` only when an unexpired in-memory MFA challenge is active. */
export const verifyPendingGuard: CanActivateFn = () => {
  const pending = inject(MfaPending).current();
  const router = inject(Router);
  if (pending && pending.receivedAt + pending.step.expiresIn * 1000 > Date.now()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { verify: 'expired' } });
};
