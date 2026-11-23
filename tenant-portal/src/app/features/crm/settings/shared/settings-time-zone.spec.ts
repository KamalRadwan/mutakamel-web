import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { CurrentUser } from '../../../../core/auth/current-user';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { getCrmSettings } from '../general/general.api';
import { settingsTimeZone } from './settings-time-zone';

describe('settings time zone', () => {
  const me = signal<TenantMe | null>(null);
  const user = signal({ timeZone: 'Pacific/Auckland' });
  let dispose: () => void;
  let stub: CrmHttpStub;
  const run = () => TestBed.runInInjectionContext(settingsTimeZone);

  beforeEach(() => {
    me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: ['crm.settings.read'], permissionScopes: {
      'crm.settings.read': { tenantWide: true, companyIds: [], branchIds: [] },
    } });
    user.set({ timeZone: 'Pacific/Auckland' });
    TestBed.configureTestingModule({ providers: [
      { provide: TenantScopeState, useValue: { me } },
      { provide: CurrentUser, useValue: { user } },
    ] });
    stub = new CrmHttpStub();
    dispose = bindCrmHttpForTest(stub);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dispose();
  });

  it('uses the authenticated workspace zone without reading CRM settings', async () => {
    const read = vi.spyOn(stub, 'read');
    expect(await run()).toBe('Pacific/Auckland');
    expect(read).not.toHaveBeenCalled();
  });

  it('keeps the workspace zone without settings read permission', async () => {
    me.update((value) => value ? { ...value, permissions: [], permissionScopes: {} } : null);
    const read = vi.spyOn(stub, 'read');
    expect(await run()).toBe('Pacific/Auckland');
    expect(read).not.toHaveBeenCalled();
  });

  it('never guesses from the browser when signed out', async () => {
    const browserZone = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions');
    const read = vi.spyOn(stub, 'read');
    me.set(null);
    expect(await run()).toBeNull();
    expect(browserZone).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('keeps workspace timezone independent of branch-only settings grants', async () => {
    me.update((value) => value ? { ...value, permissionScopes: {
      'crm.settings.read': { tenantWide: false, branchIds: ['branch-a'], companyIds: [] },
    } } : null);
    const read = vi.spyOn(stub, 'read');
    expect(await run()).toBe('Pacific/Auckland');
    expect(read).not.toHaveBeenCalled();
  });

  it('retains the settings fallback when the current-user projection is unavailable', async () => {
    user.set({ timeZone: '' });
    const expected = (await getCrmSettings()).analyticsTimeZone;
    expect(await run()).toBe(expected);
  });
});
