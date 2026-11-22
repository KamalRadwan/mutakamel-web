import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
  type RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthSession } from '../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../core/auth/auth-session.fake';
import type {
  SessionStatus,
  TenantMe,
  TenantPermissionScope,
} from '../../../core/auth/auth-session.model';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { StaffReadAccess, staffReadGuard } from './staff-read-access';
import { staffRoutes } from './staff.routes';

const pages = [
  ['organization', 'org.company.read'],
  ['companies', 'org.company.read'],
  ['branches', 'org.branch.read'],
  ['departments', 'org.department.read'],
  ['teams', 'org.team.read'],
  ['users', 'users.user.read'],
  ['roles', 'roles.role.read'],
] as const;
const company = '019f0000-0000-7000-8000-000000000001';
const branchA = '019f0000-0000-7000-8000-000000000002';
const branchB = '019f0000-0000-7000-8000-000000000003';
const tenant = { tenantWide: true, companyIds: [], branchIds: [] };

describe('Staff route and menu permissions', () => {
  const me = signal<TenantMe | null>(null);
  const status = signal<SessionStatus>('signed-in');
  let access: StaffReadAccess;
  let router: Router;
  function grant(permission: string, scope: TenantPermissionScope = tenant) {
    me.set({
      ...FAKE_TENANT_ME,
      id: 'guard-test-user',
      isTenantOwner: false,
      permissions: [permission],
      permissionScopes: { [permission]: scope },
      accessibleCompanies: [company],
      accessibleBranches: [branchA, branchB],
      accessibleBranchCompanies: [
        { companyId: company, branchId: branchA },
        { companyId: company, branchId: branchB },
      ],
    });
  }
  beforeEach(() => {
    status.set('signed-in');
    me.set(null);
    sessionStorage.removeItem('tenant-staff-scope:guard-test-user');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthSession, useValue: { me, status } }],
    });
    access = TestBed.inject(StaffReadAccess);
    router = TestBed.inject(Router);
  });
  afterEach(() => sessionStorage.removeItem('tenant-staff-scope:guard-test-user'));

  function guard(path: string, query: Record<string, string> = {}) {
    const route = staffRoutes[0].children!.find((r) => r.path === path)!;
    expect(route.canActivate).toContain(staffReadGuard);
    expect(route.runGuardsAndResolvers).toBe('paramsOrQueryParamsChange');
    return TestBed.runInInjectionContext(() =>
      staffReadGuard(
        { routeConfig: route, queryParamMap: convertToParamMap(query) } as ActivatedRouteSnapshot,
        { url: '/workspace/staff/' + path } as RouterStateSnapshot,
      ),
    );
  }

  it.each(pages)('applies the same read key to the %s direct route and navigation', (path, key) => {
    grant(key);
    expect(guard(path)).toBe(true);
    expect(access.availablePages().map((page) => page.id)).toEqual(
      pages.filter(([, k]) => k === key).map(([p]) => p),
    );
    const allowed = path === 'users' ? 'roles' : 'users';
    grant(allowed === 'roles' ? 'roles.role.read' : 'users.user.read');
    const denied = guard(path);
    expect(denied).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(denied as UrlTree)).toBe('/workspace/staff/' + allowed);
    expect(status()).toBe('signed-in');
  });

  it('keeps a scoped list reachable even when the selected branch differs, and rejects a deep link outside that grant', () => {
    grant('org.branch.read', { tenantWide: false, companyIds: [], branchIds: [branchA] });
    TestBed.inject(TenantScopeState).selectBranch(branchB);
    expect(TestBed.inject(TenantScopeState).selection()?.branchId).toBe(branchB);
    expect(guard('branches')).toBe(true);
    expect(access.availablePages().map((page) => page.id)).toEqual(['branches']);
    expect(guard('branches', { open: branchA })).toBe(true);
    expect(guard('branches', { open: branchB })).toBeInstanceOf(UrlTree);
    expect(guard('branches', { branchId: branchB })).toBeInstanceOf(UrlTree);
  });

  it('shows no Staff pages or allowed record targets while identity is unresolved', () => {
    grant('users.user.read');
    status.set('loading');
    expect(access.availablePages()).toEqual([]);
    expect(access.allows('users')).toBe(false);
  });
});
