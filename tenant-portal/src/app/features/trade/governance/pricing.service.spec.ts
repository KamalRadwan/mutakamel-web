import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { FAKE_TENANT_ME } from '../../../core/auth/auth-session.fake';
import { ScopeState } from '../../../core/scope/scope';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { hasPricingGrant } from './pricing.service';

describe('pricing permission levels', () => {
  afterEach(() => TestBed.resetTestingModule());
  it.each(['trade.policy.publish', 'trade.configuration.manage'])('%s requires a tenant-wide grant', (key) => {
    const me = signal({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: [key], permissionScopes: {
      [key]: { tenantWide: false, companyIds: ['c1'], branchIds: ['b1'] },
    } });
    TestBed.configureTestingModule({ providers: [{ provide: TenantScopeState, useValue: { me } }] });
    const scope = { company: () => ({ id: 'c1', branches: [{ id: 'b1' }] }), branch: () => ({ id: 'b1' }) } as unknown as ScopeState;
    const injector = TestBed.inject(Injector);
    expect(hasPricingGrant(injector, scope, key)).toBe(false);
    me.update((value) => ({ ...value, permissionScopes: { [key]: { tenantWide: true, companyIds: [], branchIds: [] } } }));
    expect(hasPricingGrant(injector, scope, key)).toBe(true);
  });
});
