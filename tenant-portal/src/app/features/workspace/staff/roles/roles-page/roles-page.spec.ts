import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { AuthSession } from '../../../../../core/auth/auth-session';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import type { Role } from '../../shared/staff.model';
import { RolesPage } from './roles-page';

class EmptyLoader {
  getTranslation() {
    return of({});
  }
}

it('keeps permission assignment owner-only and keeps system roles protected even for owners', () => {
  const tenant = { tenantWide: true, companyIds: [], branchIds: [] };
  const me = signal<TenantMe>({
    ...FAKE_TENANT_ME,
    isTenantOwner: false,
    permissions: ['roles.role.read', 'roles.role.update'],
    permissionScopes: { 'roles.role.read': tenant, 'roles.role.update': tenant },
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
  const page = TestBed.createComponent(RolesPage).componentInstance;
  const custom: Role = {
    id: 'role-fixture',
    name: 'Reader',
    nameI18n: { en: 'Reader', ar: 'قارئ' },
    isSystem: false,
    permissionMode: 'GLOBAL',
    branchProfileCount: 0,
    permissionCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
  const enabled = (id: string, role = custom) =>
    page['actionsFor'](role).some((action) => action.id === id && !action.disabled);
  expect(enabled('edit')).toBe(true);
  expect(enabled('assign')).toBe(false);
  me.update((actor) => ({ ...actor, isTenantOwner: true }));
  const branchRole: Role = { ...custom, permissionMode: 'BRANCH' };
  expect(enabled('assign', branchRole)).toBe(false);
  me.update((actor) => ({
    ...actor,
    permissions: [...actor.permissions, 'roles.permission.read'],
    permissionScopes: { ...actor.permissionScopes, 'roles.permission.read': tenant },
  }));
  expect(enabled('assign', branchRole)).toBe(true);
  expect(enabled('assign', { ...branchRole, isSystem: true })).toBe(false);
});
