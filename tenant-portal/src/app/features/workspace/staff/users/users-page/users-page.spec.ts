import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { map, timer } from 'rxjs';
import { vi } from 'vitest';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { listBranches, listUsers } from '../../shared/staff.api';
import { InviteModal } from '../invite-modal/invite-modal';
import { UsersPage } from './users-page';

class EmptyLoader {
  getTranslation() {
    return timer(0).pipe(map(() => ({})));
  }
}

describe('scoped Users list and lookup options', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps permitted users visible and replaces branch filter options when /me changes', async () => {
    const [users, branches] = await Promise.all([
      listUsers({ limit: 100 }),
      listBranches({ limit: 100 }),
    ]);
    const user = users.data[0];
    const firstBranch = branches.data.find((branch) => branch.id === user.branchId)!;
    const otherBranch = branches.data.find((branch) => branch.id !== user.branchId)!;
    const userScope = { tenantWide: false, companyIds: [], branchIds: [user.branchId] };
    const me = signal<TenantMe>({
      ...FAKE_TENANT_ME,
      isTenantOwner: false,
      permissions: ['users.user.read'],
      permissionScopes: { 'users.user.read': userScope },
      accessibleBranches: [firstBranch.id, otherBranch.id],
      accessibleCompanies: [...new Set([firstBranch.companyId, otherBranch.companyId])],
      accessibleBranchCompanies: [firstBranch, otherBranch].map((branch) => ({
        branchId: branch.id,
        companyId: branch.companyId,
      })),
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            missingHandler: { logMissingKey: false },
          },
          loader: EmptyLoader,
        }),
        {
          provide: AuthSession,
          useValue: { me, status: signal('signed-in'), ensureLoaded: async () => 'signed-in' },
        },
      ],
    });
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(UsersPage);
    const page = fixture.componentInstance;
    async function settle() {
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(2_000);
      fixture.detectChanges();
    }
    const options = (id: string) => page['filters']().find((filter) => filter.id === id)!.options;
    await settle();
    expect(page['loadFailed']()).toBe(false);
    expect(page['rows']().map((row) => row.id)).toContain(user.id);
    expect(page['rows']().every((row) => row.branchId === user.branchId)).toBe(true);
    for (const id of ['companyId', 'branchId', 'departmentId', 'teamId']) {
      expect(options(id)).toEqual([]);
    }
    const invite: InviteModal = fixture.debugElement.query(
      By.directive(InviteModal),
    ).componentInstance;
    expect(invite.roles()).toEqual([]);
    for (const branch of [firstBranch, otherBranch]) {
      me.update((actor) => ({
        ...actor,
        permissions: ['users.user.read', 'org.branch.read'],
        permissionScopes: {
          'users.user.read': userScope,
          'org.branch.read': { ...userScope, branchIds: [branch.id] },
        },
      }));
      await settle();
      expect(options('branchId')).toEqual([{ value: branch.id, label: branch.name }]);
      expect(options('companyId')).toEqual([]);
      expect(invite.roles()).toEqual([]);
      expect(page['rows']().map((row) => row.id)).toContain(user.id);
    }
  });
});
