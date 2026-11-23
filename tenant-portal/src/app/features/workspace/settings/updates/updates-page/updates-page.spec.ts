import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { EMPTY } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession, RenewalState } from '../../../../../core/auth/auth-session';
import { SessionStatus, TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { UpdatesApi } from '../updates.api';
import { UpdatesPage } from './updates-page';

const member: TenantMe = {
  id: 'member', email: 'member@example.com', firstName: 'Member', lastName: 'User',
  hasAvatar: false, isTenantOwner: false, mfaEnabled: false, mfaUpdatedAt: null, status: 'ACTIVE',
  workspace: { timezone: 'Africa/Cairo', defaultLanguage: 'en' },
  accessibleBranches: [], accessibleCompanies: [], accessibleBranchCompanies: [],
  permissions: ['workspace.read', 'workspace.manage'], seats: [], permissionScopes: {},
  teamMemberships: [], accessScope: { mode: 'FULL', branchesTruncated: false,
    companiesTruncated: false, teamMembershipsTruncated: false, teamMembershipsTotal: 0 },
  featureEntitlements: {},
};

describe('UpdatesPage tenant-wide authorization', () => {
  const status = signal<SessionStatus>('signed-in');
  const me = signal<TenantMe | null>(member);
  const renewal = signal<RenewalState>('ok');
  const listUpdates = vi.fn().mockResolvedValue({ data: [], meta: {
    page: 1, limit: 25, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
  } });
  beforeEach(() => {
    status.set('signed-in'); me.set(member); renewal.set('ok'); listUpdates.mockClear();
    TestBed.configureTestingModule({ providers: [
      { provide: AuthSession, useValue: { status, me, renewal } },
      { provide: UpdatesApi, useValue: { listUpdates } },
      { provide: TranslocoService, useValue: { events$: EMPTY, translate: (key: string) => key } },
      { provide: LanguageState, useValue: { current: signal('en') } },
      { provide: Notify, useValue: { error: vi.fn() } },
    ] });
    TestBed.overrideComponent(UpdatesPage, { set: { template: '', imports: [] } });
  });

  it('does not load updates for company or branch grants', async () => {
    me.set({ ...member, permissionScopes: {
      'workspace.read': { tenantWide: false, companyIds: ['company'], branchIds: ['branch'] },
      'workspace.manage': { tenantWide: false, companyIds: ['company'], branchIds: [] },
    } });
    const fixture = TestBed.createComponent(UpdatesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance['canRead']()).toBe(false);
    expect(fixture.componentInstance['canManage']()).toBe(false);
    expect(listUpdates).not.toHaveBeenCalled();
  });

  it('allows tenant-wide reads but requires a tenant-wide manage grant for apply', () => {
    me.set({ ...member, permissionScopes: {
      'workspace.read': { tenantWide: true, companyIds: [], branchIds: [] },
    } });
    const page = TestBed.createComponent(UpdatesPage).componentInstance;
    expect(page['canRead']()).toBe(true);
    expect(page['canManage']()).toBe(false);
    me.update((value) => value ? { ...value, permissionScopes: { ...value.permissionScopes,
      'workspace.manage': { tenantWide: true, companyIds: [], branchIds: [] },
    } } : null);
    expect(page['canManage']()).toBe(true);
    renewal.set('retrying');
    expect(page['canRead']()).toBe(true);
    expect(page['canManage']()).toBe(false);
  });

  it('allows owners and revokes access when the session ends or the user becomes inactive', () => {
    me.set({ ...member, isTenantOwner: true, permissions: [] });
    const page = TestBed.createComponent(UpdatesPage).componentInstance;
    expect(page['canManage']()).toBe(true);
    status.set('signed-out');
    expect(page['canRead']()).toBe(false);
    status.set('signed-in');
    me.set({ ...member, isTenantOwner: true, status: 'INACTIVE' });
    expect(page['canRead']()).toBe(false);
  });
});
