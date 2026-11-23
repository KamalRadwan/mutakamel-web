import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoLoader } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { FunctionsApi } from '../functions.api';
import { FunctionsPage } from './functions-page';

@Injectable()
class EmptyLoader implements TranslocoLoader { getTranslation() { return Promise.resolve({}); } }

describe('FunctionsPage HTTP consumer', () => {
  const me = signal({ permissions: ['templates.functions.read', 'templates.functions.manage'] });
  const listFunctions = vi.fn();
  beforeEach(() => {
    me.set({ permissions: ['templates.functions.read', 'templates.functions.manage'] });
    listFunctions.mockResolvedValue({ items: [], pageInfo: { limit: 25, hasNextPage: false, nextCursor: null } });
    TestBed.configureTestingModule({ providers: [
      { provide: TenantScopeState, useValue: { me, selectorCompanyIds: () => ['company-from-session'] } },
      { provide: FunctionsApi, useValue: { listFunctions } },
      { provide: Notify, useValue: { error: vi.fn(), success: vi.fn() } },
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: EmptyLoader }),
    ] }).overrideComponent(FunctionsPage, { set: { template: '', imports: [] } });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.resetAllMocks(); });

  // This view exposes only the state this spec needs; no loose casts or fixture data sources.
  type State = { errorState: () => string; correlationId: () => string | null; loading: () => boolean;
    companyOptions: () => { id: string; label: string }[]; canManage: boolean; canPublish: boolean;
    companyFilterOptions: () => { value: string }[]; updateDraftScopeType: (scopeType: 'COMPANY') => void;
    draftFilters: () => { scopeType: string; companyId: string } };
  async function render() {
    const fixture = TestBed.createComponent(FunctionsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, state: fixture.componentInstance as unknown as State };
  }

  it('loads through the service and uses authorized IDs rather than sample company mappings', async () => {
    const { state } = await render();
    expect(listFunctions).toHaveBeenCalledWith({ limit: 25, cursor: undefined });
    expect(state.companyOptions()).toEqual([{ id: 'company-from-session', label: 'company-from-session' }]);
    expect(state.canManage).toBe(true);
    expect(state.canPublish).toBe(false);
    expect(state.loading()).toBe(false);
  });

  it('makes no request without read permission and reacts when it is granted', async () => {
    me.set({ permissions: [] });
    const { fixture, state } = await render();
    expect(listFunctions).not.toHaveBeenCalled();
    expect(state.errorState()).toBe('forbidden');
    me.set({ permissions: ['templates.functions.read'] });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(listFunctions).toHaveBeenCalledTimes(1);
    expect(state.errorState()).toBe('none');
  });

  it('requires an exact authorized company for the backend company-scope filter', async () => {
    const { state } = await render();
    expect(state.companyFilterOptions()).toEqual([{ value: 'company-from-session', label: 'company-from-session' }]);
    state.updateDraftScopeType('COMPANY');
    expect(state.draftFilters()).toMatchObject({ scopeType: 'COMPANY', companyId: 'company-from-session' });
  });

  for (const [status, code, expected] of [
    [403, 'CORE.TEMPLATE.PERMISSION.DENIED', 'forbidden'],
    [503, 'CORE.TEMPLATE.FEATURE.DISABLED', 'featureDisabled'],
    [0, 'NETWORK_ERROR', 'failed'],
  ] as const) {
    it(`maps ${code} to the existing ${expected} state and retains correlation IDs`, async () => {
      listFunctions.mockRejectedValueOnce(new ApiError(status, code, undefined, { correlationId: 'trace-id' }));
      const { state } = await render();
      expect(state.errorState()).toBe(expected);
      expect(state.loading()).toBe(false);
      expect(state.correlationId()).toBe('trace-id');
    });
  }
});
