import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TenantMe } from '../../../core/auth/auth-session.model';
import { FAKE_TENANT_ME } from '../../../core/auth/auth-session.fake';
import { ScopeState } from '../../../core/scope/scope';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { actorLabel, hasPolicyGrant, POLICY_PERMISSIONS } from './policy.registry';

describe('policy permissions and actor labels', () => {
  const me = signal<TenantMe | null>(null);
  beforeEach(() => {
    me.set(null);
    TestBed.configureTestingModule({ providers: [{ provide: TenantScopeState, useValue: {
      me, selection: signal({ companyId: 'c1', branchId: 'b1' }),
      branchesFor: () => ['b1'], showScopeSwitcher: signal(false),
    } }] });
  });
  afterEach(() => TestBed.resetTestingModule());

  function grant(key: string, tenantWide: boolean, branchIds: string[]) {
    me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: [key],
      permissionScopes: { [key]: { tenantWide, companyIds: [], branchIds } },
      accessibleBranchCompanies: [{ companyId: 'c1', branchId: 'b1' }],
    });
  }
  function allowed(key: string) {
    return hasPolicyGrant(TestBed.inject(Injector), TestBed.inject(ScopeState), key);
  }

  it('requires a tenant-wide publish grant', () => {
    grant(POLICY_PERMISSIONS.publish, false, ['b1']);
    expect(allowed(POLICY_PERMISSIONS.publish)).toBe(false);
    grant(POLICY_PERMISSIONS.publish, true, []);
    expect(allowed(POLICY_PERMISSIONS.publish)).toBe(true);
  });

  it.each([POLICY_PERMISSIONS.read, POLICY_PERMISSIONS.manage, POLICY_PERMISSIONS.test, POLICY_PERMISSIONS.approve])('requires a grant in the selected branch for %s', (key) => {
    expect(allowed(key)).toBe(false);
    grant(key, false, ['b2']);
    expect(allowed(key)).toBe(false);
    grant(key, false, ['b1']);
    expect(allowed(key)).toBe(true);
  });

  it('formats the authenticated actor from first and last names, with email fallback', () => {
    const actor = { ...FAKE_TENANT_ME, firstName: 'Salma', lastName: 'Ali' };
    expect(actorLabel(actor.id, actor, 'en')).toBe('Salma Ali');
    expect(actorLabel(actor.id, { ...actor, firstName: '', lastName: '' }, 'en')).toBe(actor.email);
  });
});
