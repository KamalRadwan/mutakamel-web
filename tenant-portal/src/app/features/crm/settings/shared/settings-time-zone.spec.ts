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

  it('uses the CRM tenant default', async () => {
    const expected = (await getCrmSettings()).analyticsTimeZone;
    expect(await run()).toBe(expected);
    expect(await run()).not.toBe(user().timeZone);
  });

  it('no zone without settings read', async () => {
    me.update((value) => ({ ...value!, permissions: [], permissionScopes: {} }));
    const read = vi.spyOn(stub, 'read');
    const delay = vi.spyOn(globalThis, 'setTimeout');
    expect(await run()).toBeNull();
    expect(read).not.toHaveBeenCalled();
    // Until the general API migration lands, a fake read would schedule fakeDelay instead.
    expect(delay).not.toHaveBeenCalled();
  });

  it('never guesses from the browser', async () => {
    const browserZone = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions');
    const read = vi.spyOn(stub, 'read');
    me.set(null);
    expect(await run()).toBeNull();
    expect(browserZone).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('does not read settings for a branch-only settings grant', async () => {
    me.update((value) => ({ ...value!, permissionScopes: {
      'crm.settings.read': { tenantWide: false, branchIds: ['branch-a'], companyIds: [] },
    } }));
    const read = vi.spyOn(stub, 'read');
    const delay = vi.spyOn(globalThis, 'setTimeout');
    expect(await run()).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(delay).not.toHaveBeenCalled();
  });

  it('uses the explicit CurrentUser zone only after the workspace projection lands', async () => {
    me.update((value) => Object.assign({ ...value!, permissions: [], permissionScopes: {} }, { workspace: {} }));
    const read = vi.spyOn(stub, 'read');
    const delay = vi.spyOn(globalThis, 'setTimeout');
    expect(await run()).toBe('Pacific/Auckland');
    expect(read).not.toHaveBeenCalled();
    expect(delay).not.toHaveBeenCalled();
  });
});
