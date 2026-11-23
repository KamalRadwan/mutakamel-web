import { Injectable, type Type, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_TENANT_ME } from '../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../core/auth/auth-session.model';
import { LanguageState } from '../../../core/i18n/language';
import { Notify } from '../../../core/notify/notify';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { FullState } from '../../../shared/ui/full-state/full-state';
import { ApiError } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import { PolicyPage } from './policy-page/policy-page';
import { WorkflowPage } from './workflow-page/workflow-page';
import { WorkflowVersionPage } from './workflow-version-page/workflow-version-page';

@Injectable()
class EmptyTranslations implements TranslocoLoader {
  getTranslation() { return of({}); }
}

const PAGES: { name: string; component: Type<unknown>; paths: string[] }[] = [
  { name: 'policy definition', component: PolicyPage, paths: ['/policies/def', '/policy-studio/metadata'] },
  { name: 'workflow definition', component: WorkflowPage, paths: ['/workflows/def'] },
  { name: 'workflow version', component: WorkflowVersionPage, paths: ['/workflows/def', '/workflow-versions/ver'] },
];

for (const lang of ['en', 'ar'] as const) {
  for (const theme of ['light', 'dark']) {
    describe.each(PAGES)('$name permissions and forbidden response', ({ component, paths }) => {
      let dispose: () => void;
      let stub: TradeHttpStub;
      const me = signal<TenantMe | null>(null);
      const notify = { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() };
      let previousTheme: string | null;
      let previousDirection: string;
      beforeEach(() => {
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDirection = document.documentElement.dir;
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: [], permissionScopes: {} });
        notify.error.mockClear();
        stub = new TradeHttpStub();
        dispose = bindTradeHttpForTest(stub);
        const paramMap = convertToParamMap({ id: 'def', versionId: 'ver' });
        TestBed.configureTestingModule({ imports: [component], providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { paramMap: of(paramMap), snapshot: { paramMap } } },
          provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang }, loader: EmptyTranslations }),
          { provide: LanguageState, useValue: { current: signal(lang) } },
          { provide: Notify, useValue: notify },
          { provide: TenantScopeState, useValue: { me, selection: signal({ companyId: 'c1', branchId: 'b1' }),
            branchesFor: () => ['b1'], showScopeSwitcher: signal(false) } },
        ] });
      });
      afterEach(() => {
        TestBed.resetTestingModule();
        dispose();
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDirection;
      });

      it(`${lang} ${theme}: blocks reads without permission`, async () => {
        const fixture = TestBed.createComponent(component);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        fixture.detectChanges();
        const state = fixture.debugElement.query(By.directive(FullState));
        expect((state.componentInstance as FullState).kind()).toBe('forbidden');
        expect(stub.recordedReads()).toHaveLength(0);
        expect(notify.error).not.toHaveBeenCalled();
      });

      it(`${lang} ${theme}: shows a forbidden state for a server 403`, async () => {
        me.set({ ...me()!, permissions: ['trade.policy.read'], permissionScopes: {
          'trade.policy.read': { tenantWide: true, companyIds: [], branchIds: [] },
        } });
        for (const path of paths) stub.register('GET', path, new ApiError(403, 'TRADE.AUTH.TARGET_DENIED'));
        const fixture = TestBed.createComponent(component);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        fixture.detectChanges();
        const state = fixture.debugElement.query(By.directive(FullState));
        expect((state.componentInstance as FullState).kind()).toBe('forbidden');
        expect(stub.recordedReads().length).toBeGreaterThan(0);
        expect(notify.error).not.toHaveBeenCalled();
      });
    });
  }
}
