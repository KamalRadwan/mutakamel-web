import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthSession } from '../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../core/auth/auth-session.fake';
import type { SessionStatus, TenantMe } from '../../core/auth/auth-session.model';
import { ScopeState } from '../../core/scope/scope';
import { TenantScopeState } from '../../core/scope/tenant-scope';
import { ScopeSwitcher } from './scope-switcher';

class EmptyLoader {
  getTranslation() {
    return of({});
  }
}

const companyId = 'tenant-company';
const branchId = 'tenant-branch';

function snapshot(
  companies = [companyId],
  branches = [branchId],
  scope?: Partial<TenantMe['accessScope']>,
): TenantMe {
  return {
    ...FAKE_TENANT_ME,
    id: 'switcher-test-user',
    isTenantOwner: false,
    permissions: [],
    permissionScopes: {},
    accessibleCompanies: companies,
    accessibleBranches: branches,
    accessibleBranchCompanies: branches.map((id) => ({ branchId: id, companyId })),
    accessScope: { ...FAKE_TENANT_ME.accessScope, ...scope },
  };
}

describe('Company and branch switcher availability', () => {
  const me = signal<TenantMe | null>(null);
  const status = signal<SessionStatus>('signed-in');

  beforeEach(() => {
    sessionStorage.removeItem('tenant-staff-scope:switcher-test-user');
    localStorage.removeItem('tenant-staff-scope:switcher-test-user');
    status.set('signed-in');
    me.set(snapshot());
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: EmptyLoader,
        }),
        { provide: AuthSession, useValue: { status, me } },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.removeItem('tenant-staff-scope:switcher-test-user');
    localStorage.removeItem('tenant-staff-scope:switcher-test-user');
  });

  function render(url = '/') {
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue(url);
    const fixture = TestBed.createComponent(ScopeSwitcher);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it.each(['/', '/workspace/staff/users'])('hides the only complete company and branch on %s and keeps the default context', (url) => {
    const host = render(url);
    expect(host.classList.contains('hidden')).toBe(true);
    expect(host.querySelector('button, ng-icon')).toBeNull();
    expect(TestBed.inject(TenantScopeState).selection()).toEqual({ companyId, branchId });
  });

  it.each([
    ['two companies', [companyId, 'second-company'], [branchId]],
    ['two branches', [companyId], [branchId, 'second-branch']],
  ])('shows the existing unavailable state when there are %s but no readable names', (_case, companies, branches) => {
    me.set(snapshot(companies, branches));
    const host = render();
    expect(host.classList.contains('hidden')).toBe(false);
    expect(host.querySelector('button, [role="menu"]')).toBeNull();
    expect(host.querySelector('[aria-disabled="true"]')).not.toBeNull();
    expect(host.querySelector('[aria-disabled="true"]')?.getAttribute('title')).toBe('scope.namesUnavailable');
    expect(TestBed.inject(ScopeState).companies()).toEqual([]);
  });

  it.each([
    { mode: 'EXPLICIT' } as const,
    { branchesTruncated: true },
    { companiesTruncated: true },
  ])('keeps visibility when the server cannot prove one tenant-wide choice (%j)', (accessScope) => {
    me.set(snapshot([companyId], [branchId], accessScope));
    const host = render('/workspace/staff/users');
    expect(host.classList.contains('hidden')).toBe(false);
    expect(host.querySelector('button')).toBeNull();
    expect(TestBed.inject(ScopeState).companies()).toEqual([]);
  });

  it.each([false, true])('honors the tenant-wide flag %s for a restricted 1+1 projection', (multiple) => {
    me.set({
      ...snapshot([companyId], [branchId], { mode: 'EXPLICIT' }),
      hasMultipleOrganizationScopes: multiple,
    });
    const host = render();
    expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('[aria-disabled="true"]') !== null).toBe(multiple);
    expect(TestBed.inject(TenantScopeState).selection()).toEqual({ companyId, branchId });
  });

  it('hides the control while the session is pending', () => {
    status.set('loading');
    expect(render().querySelector('button, ng-icon')).toBeNull();
  });

  it.each(['/workspace/home', '/workspace/staff/users'])('shows a noninteractive indicator on %s when the tenant has alternatives and the user has no scope', (url) => {
    me.set({ ...snapshot([], [], { mode: 'EXPLICIT' }), hasMultipleOrganizationScopes: true });
    const host = render(url);
    expect(host.classList.contains('hidden')).toBe(false);
    expect(host.querySelector('[aria-disabled="true"] ng-icon')).not.toBeNull();
    expect(host.querySelector('button, [role="menu"]')).toBeNull();
    expect(TestBed.inject(TenantScopeState).selection()).toBeNull();
  });

  it.each([undefined, false])('hides the control with no accessible context and tenant-wide flag %s', (multiple) => {
    me.set({ ...snapshot([], []), hasMultipleOrganizationScopes: multiple });
    const host = render();
    expect(host.classList.contains('hidden')).toBe(true);
    expect(host.querySelector('button, ng-icon')).toBeNull();
  });
});
