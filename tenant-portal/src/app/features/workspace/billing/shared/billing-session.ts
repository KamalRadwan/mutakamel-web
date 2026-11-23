import { inject, Service } from '@angular/core';
import { AuthSession } from '../../../../core/auth/auth-session';

@Service()
export class BillingSession {
  private readonly session = inject(AuthSession);

  isOwner(): boolean {
    return this.session.me()?.isTenantOwner === true;
  }
}
