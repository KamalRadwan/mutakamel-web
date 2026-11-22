import { Service } from '@angular/core';
import { FAKE_BILLING_OWNER, setFakeBillingOwner } from '../billing.fake';

@Service()
export class BillingSession {
  // Later reads the active user session's isTenantOwner flag.
  isOwner(): boolean {
    return FAKE_BILLING_OWNER;
  }

  setOwner(value: boolean): void {
    setFakeBillingOwner(value);
  }
}
