import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import orgAr from '../../../../../../public/i18n/staff-organization/ar.json';
import orgEn from '../../../../../../public/i18n/staff-organization/en.json';
import staffAr from '../../../../../../public/i18n/staff/ar.json';
import staffEn from '../../../../../../public/i18n/staff/en.json';
import { AuthSession } from '../../../../core/auth/auth-session';
import type { SessionStatus, TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { RouteError } from '../../../../shared/ui/route-error/route-error';
import { OrganizationReadApi } from '../shared/organization-read.api';
import { StaffSession } from '../shared/staff-session';
import type { OrgTreeNode } from '../shared/staff.model';
import { OrgChart } from './org-chart/org-chart';
import { OrganizationPage } from './organization-page';
import type { OrgViewNode } from './organization.model';
import { TreeColumns } from './tree-columns/tree-columns';
import { TreeRows } from './tree-rows/tree-rows';

const endpoint = '/api/tenant/core/v1/organization/tree';
const tenantWide = { tenantWide: true, companyIds: [], branchIds: [] };
const readScopes = {
  'org.company.read': tenantWide,
  'org.branch.read': tenantWide,
  'org.department.read': tenantWide,
  'org.team.read': tenantWide,
};

function node(id: string, children: OrgTreeNode[] = [], name = id): OrgTreeNode {
  return { id, code: id, name, status: 'ACTIVE', children };
}

class TestLoader {
  getTranslation(path: string) {
    if (path === 'staff-organization/en') return of(orgEn);
    if (path === 'staff-organization/ar') return of(orgAr);
    if (path === 'staff/en') return of(staffEn);
    if (path === 'staff/ar') return of(staffAr);
    return of({});
  }
}

describe('Organization API tree', () => {
  let languageBefore: { stored: string | null; lang: string; dir: string };
  const me = signal<TenantMe | null>(null);
  const status = signal<SessionStatus>('loading');
  let http: HttpTestingController;
  let fixture: ComponentFixture<OrganizationPage>;

  beforeEach(() => {
    languageBefore = { stored: localStorage.getItem('lang'), lang: document.documentElement.lang, dir: document.documentElement.dir };
    me.set(null);
    status.set('loading');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        provideTransloco({
          config: {
            availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true,
            missingHandler: { logMissingKey: false },
          },
          loader: TestLoader,
        }),
        { provide: AuthSession, useValue: { me, status, ensureLoaded: async () => status() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(LanguageState).current.set('en');
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
    TestBed.inject(DOCUMENT).documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
    if (languageBefore.stored === null) localStorage.removeItem('lang');
    else localStorage.setItem('lang', languageBefore.stored);
    document.documentElement.lang = languageBefore.lang;
    document.documentElement.dir = languageBefore.dir;
  });

  function signIn(permissionScopes: TenantMe['permissionScopes'] = readScopes, id = 'actor'): void {
    me.set({
      id, email: 'actor@example.test', firstName: 'Staff', lastName: 'Reader', hasAvatar: false,
      isTenantOwner: false, mfaEnabled: false, mfaUpdatedAt: null, status: 'ACTIVE',
      accessibleCompanies: ['c1', 'c2', 'c3', 'c4', 'inactive'],
      accessibleBranches: ['b1', 'b2'],
      accessibleBranchCompanies: [{ branchId: 'b1', companyId: 'c1' }, { branchId: 'b2', companyId: 'c1' }],
      permissions: Object.keys(permissionScopes), permissionScopes, seats: [], teamMemberships: [],
      accessScope: {
        mode: 'FULL', companiesTruncated: false, branchesTruncated: false,
        teamMembershipsTruncated: false, teamMembershipsTotal: 0,
      },
      featureEntitlements: {},
    });
    status.set('signed-in');
  }

  function create(): void {
    fixture = TestBed.createComponent(OrganizationPage);
    fixture.detectChanges();
  }

  async function request() {
    let pending: TestRequest | undefined;
    await vi.waitFor(() => {
      fixture.detectChanges();
      pending = http.expectOne({ method: 'GET', url: endpoint });
    });
    expect(pending!.request.params.keys()).toEqual([]);
    expect(pending!.request.withCredentials).toBe(true);
    return pending!;
  }

  async function render(tree: OrgTreeNode[] = [node('c1')]): Promise<void> {
    (await request()).flush({ success: true, data: tree });
    await settled();
  }

  async function settled(): Promise<void> {
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).toBeNull();
      expect((button(orgEn.reload) ?? button(orgAr.reload))?.disabled ?? false).toBe(false);
    });
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>]
      .find((item) => item.textContent?.trim() === label || item.getAttribute('aria-label') === label);
  }

  function rows(): TreeRows {
    return fixture.debugElement.query(By.directive(TreeRows)).componentInstance;
  }

  async function fail(statusCode: number, errorCode: string, details?: Record<string, unknown>): Promise<void> {
    (await request()).flush({ errorCode, details, correlationId: 'private-correlation' }, {
      status: statusCode, statusText: 'Service error',
    });
    await settled();
    expect(fixture.nativeElement.textContent).not.toContain('private-correlation');
  }

  it.each(['en', 'ar'] as const)('renders the API tree sorted by name then code (en and ar): %s', async (language) => {
    signIn();
    TestBed.inject(LanguageState).current.set(language);
    create();
    await render([
      node('c4', [], 'Zulu'), node('c2', [], 'باء'), node('c1', [], 'ألف'), node('c3', [], 'باء'),
      { ...node('inactive'), status: 'INACTIVE' },
    ]);
    const expected = language === 'ar' ? ['c1', 'c2', 'c3', 'c4'] : ['c4', 'c1', 'c2', 'c3'];
    for (const view of ['rows', 'columns', 'chart']) {
      fixture.componentRef.setInput('view', view);
      fixture.detectChanges();
      const component = view === 'rows' ? TreeRows : view === 'columns' ? TreeColumns : OrgChart;
      const tree = fixture.debugElement.query(By.directive(component)).componentInstance.tree() as OrgViewNode[];
      expect(tree.map(({ id }) => id)).toEqual(expected);
    }
    expect(fixture.nativeElement.textContent).toContain(
      (language === 'ar' ? orgAr : orgEn).summary
        .replace('{{c}}', '4').replace('{{b}}', '0').replace('{{d}}', '0').replace('{{t}}', '0'),
    );
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('[role="switch"]');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    const chart: OrgChart = fixture.debugElement.query(By.directive(OrgChart)).componentInstance;
    expect(chart.tree().map(({ id }) => id)).toContain('inactive');
  });

  it('re-sorts the existing tree when the language changes without a request', async () => {
    signIn();
    create();
    await render([node('c1', [], 'Zulu'), node('c2', [], 'ألف')]);
    expect(rows().tree().map(({ id }) => id)).toEqual(['c1', 'c2']);
    TestBed.inject(LanguageState).current.set('ar');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows().tree().map(({ id }) => id)).toEqual(['c2', 'c1']);
    http.expectNone(endpoint);
  });

  it('shows branches from company-read scope and disables Open without org.branch.read', async () => {
    signIn({ 'org.company.read': tenantWide });
    create();
    await render([node('c1', [node('b1')])]);
    const branch = rows().tree()[0].children[0];
    expect(fixture.nativeElement.querySelector('[data-node-id="b1"]')).not.toBeNull();
    expect(rows().actionsFor()(branch).find(({ id }) => id === 'open')).toMatchObject({
      disabled: true, reason: staffEn.protected.scope,
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    rows().action.emit({ node: branch, action: 'open' });
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(orgEn.hiddenByPermission);
  });

  it.each([false, true])('gates View users by users.user.read (allowed=%s)', async (allowed) => {
    signIn({ ...readScopes, ...(allowed ? {
      'users.user.read': { tenantWide: false, companyIds: [], branchIds: ['b1'] },
    } : {}) });
    create();
    await render([node('c1', [node('b1'), node('b2')])]);
    const [first, second] = rows().tree()[0].children;
    const action = rows().actionsFor()(first).find(({ id }) => id === 'viewUsers');
    expect(action?.disabled).toBe(!allowed);
    expect(action?.reason).toBe(allowed ? undefined : staffEn.protected.scope);
    expect(rows().actionsFor()(second).find(({ id }) => id === 'viewUsers')).toMatchObject({
      disabled: true, reason: staffEn.protected.scope,
    });
  });

  it.each([
    ['en', 'light', orgEn], ['en', 'dark', orgEn], ['ar', 'light', orgAr], ['ar', 'dark', orgAr],
  ] as const)('shows the scoped empty state for [] (%s/%s)', async (language, theme, labels) => {
    signIn();
    TestBed.inject(LanguageState).current.set(language);
    TestBed.inject(DOCUMENT).documentElement.setAttribute('data-theme', theme);
    create();
    await render([]);
    expect(fixture.nativeElement.textContent).toContain(labels.emptyScoped);
    expect(button(labels.addCompany)).toBeUndefined();
  });

  it('shows Add company in the empty state for a tenant-wide manager', async () => {
    signIn({ ...readScopes, 'org.company.manage': tenantWide });
    create();
    await render([]);
    expect(fixture.nativeElement.textContent).toContain(orgEn.empty);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    button(orgEn.addCompany)!.click();
    expect(navigate).toHaveBeenCalledWith(['/workspace/staff/companies'], { queryParams: { new: 1 } });
  });

  it('shows no results when the search matches nothing', async () => {
    signIn();
    create();
    await render();
    const search: HTMLInputElement = fixture.nativeElement.querySelector('input[type="text"]');
    search.value = 'absent';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(staffEn.list.empty);
    expect(fixture.nativeElement.querySelector('app-org-tree-rows')).toBeNull();
    http.expectNone(endpoint);
  });

  it('shows no results when inactive filtering hides every node', async () => {
    signIn();
    create();
    await render([{ ...node('c1', [node('b1')]), status: 'INACTIVE' }]);
    expect(fixture.nativeElement.textContent).toContain(staffEn.list.empty);
    expect(fixture.nativeElement.textContent).not.toContain(orgEn.emptyScoped);
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('[role="switch"]');
    toggle.click();
    fixture.detectChanges();
    expect(rows().tree()[0].children[0].id).toBe('b1');
    http.expectNone(endpoint);
  });

  it.each(['companies', 'branches', 'departments', 'teams'] as const)(
    'shows the too-large view with the level and limit from details (%s)', async (kind) => {
      signIn();
      create();
      await fail(422, 'ORG_TREE_TOO_LARGE', { nodeKind: [kind], limit: ['5123'] });
      expect(fixture.nativeElement.textContent).toContain(orgEn.tooLargeKind[kind].replace('{{limit}}', '5123'));
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      button(orgEn.openCompanies)!.click();
      expect(navigate).toHaveBeenCalledWith(['/workspace/staff/companies']);
      TestBed.inject(LanguageState).current.set('ar');
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(orgAr.tooLargeKind[kind].replace('{{limit}}', '5123'));
    },
  );

  it.each([undefined, { nodeKind: ['unknown'], limit: ['5000'] }])(
    'falls back to the generic too-large text without nodeKind (%j)', async (details) => {
      signIn();
      create();
      await fail(422, 'ORG_TREE_TOO_LARGE', details);
      expect(fixture.nativeElement.textContent).toContain(orgEn.tooLarge);
    },
  );

  it('shows load failure with Retry for PERMISSION_SCOPE_AUTHORITY_INCONSISTENT', async () => {
    signIn();
    create();
    await fail(422, 'PERMISSION_SCOPE_AUTHORITY_INCONSISTENT');
    expect(fixture.nativeElement.textContent).toContain(orgEn.loadFailed);
    button(orgEn.retry)!.click();
    await render();
    expect(fixture.nativeElement.querySelector('app-org-tree-rows')).not.toBeNull();
  });

  it.each(['MISSING_REQUIRED_PERMISSIONS', 'PERMISSION_SCOPE_UNAVAILABLE'])(
    'shows the forbidden state on 403 (%s)', async (code) => {
      signIn();
      create();
      await fail(403, code, code === 'MISSING_REQUIRED_PERMISSIONS'
        ? { permissions: ['org.company.read'] } : { permissionKey: ['org.company.read'] });
      const denied: RouteError = fixture.debugElement.query(By.directive(RouteError)).componentInstance;
      expect(denied.kind()).toBe('forbidden');
      expect(button(orgEn.reload)).toBeUndefined();
      expect(button(orgEn.retry)).toBeUndefined();
    },
  );

  it('shows the forbidden state on 403 from the client permission check without a request', async () => {
    signIn({});
    create();
    await settled();
    expect(fixture.nativeElement.querySelector('app-route-error')).not.toBeNull();
    http.expectNone(endpoint);
  });

  it('shows load failure with Retry on 500', async () => {
    signIn();
    create();
    await fail(500, 'COMMON.GENERIC.INTERNAL_ERROR');
    expect(fixture.nativeElement.textContent).toContain(orgEn.loadFailed);
    button(orgEn.retry)!.click();
    await render();
    expect(fixture.nativeElement.textContent).not.toContain(orgEn.loadFailed);
  });

  it.each([{ data: [] }, { success: true }])('shows load failure for a malformed body (%j)', async (body) => {
    signIn();
    create();
    (await request()).flush(body);
    await settled();
    expect(fixture.nativeElement.textContent).toContain(orgEn.loadFailed);
    expect(button(orgEn.retry)).toBeDefined();
  });

  it('keeps the last tree on a network error', async () => {
    signIn();
    create();
    await render();
    button(orgEn.reload)!.click();
    (await request()).error(new ProgressEvent('error'));
    await settled();
    expect(rows().tree()[0].id).toBe('c1');
    expect(fixture.nativeElement.textContent).not.toContain(orgEn.loadFailed);
    expect(button(orgEn.reload)?.disabled).toBe(false);
  });

  it('shows load failure on a first-load network error', async () => {
    signIn();
    create();
    (await request()).error(new ProgressEvent('error'));
    await settled();
    expect(fixture.nativeElement.textContent).toContain(orgEn.loadFailed);
    button(orgEn.retry)!.click();
    await render();
  });

  it('reloads on scope change and ignores a late answer for the old scope', async () => {
    signIn();
    create();
    const old = await request();
    signIn(readScopes, 'new-actor');
    fixture.detectChanges();
    await render([node('c2')]);
    old.flush({ success: true, data: [node('c1')] });
    await settled();
    expect(rows().tree().map(({ id }) => id)).toEqual(['c2']);
  });

  it('reads the tree from the network again after invalidateScope', async () => {
    signIn();
    create();
    await render();
    await TestBed.inject(OrganizationReadApi).invalidateScope(TestBed.inject(StaffSession).scopeRevision()!);
    button(orgEn.reload)!.click();
    await render([node('c2')]);
    expect(rows().tree()[0].id).toBe('c2');
  });

  it('waits for session scope before loading and clears the old tree on scope loss', async () => {
    create();
    await fixture.whenStable();
    http.expectNone(endpoint);
    signIn();
    fixture.detectChanges();
    await render();
    me.set(null);
    status.set('failed');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-org-tree-rows')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(orgEn.loadFailed);
  });
});
