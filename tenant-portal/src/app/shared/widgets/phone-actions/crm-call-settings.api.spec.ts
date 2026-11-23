import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LanguageState } from '../../../core/i18n/language';
import { ScopeState } from '../../../core/scope/scope';
import { bindCrmHttpForTest } from '../../../features/crm/shared/crm-http';
import { CrmModules } from '../../../features/crm/shared/crm-modules/crm-modules';
import type { CrmModulesState } from '../../../features/crm/shared/crm-modules/crm-modules.model';
import { CrmHttpStub } from '../../../features/crm/shared/testing/crm-http-testing';
import { getCrmClickToCallSetting } from './crm-call-settings.api';

describe('CrmCallSettings', () => {
  for (const language of ['en', 'ar'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      describe(`${language} ${theme}`, () => {
        let stub: CrmHttpStub;
        let modules: CrmModules;
        let dispose: () => void;
        let previousTheme: string | null;
        let previousLanguage: string;
        let previousDirection: string;
        let state: CrmModulesState & {
          calls?: { clickToCallEnabled?: boolean; logCallsAsActivities?: boolean };
        };

        beforeEach(() => {
          previousTheme = document.documentElement.getAttribute('data-theme');
          previousLanguage = document.documentElement.lang;
          previousDirection = document.documentElement.dir;
          document.documentElement.setAttribute('data-theme', theme);
          document.documentElement.lang = language;
          document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
          state = {
            revision: 4,
            defaults: { leadsEnabled: true, opportunitiesEnabled: true },
            companies: [],
          };
          stub = new CrmHttpStub({ '/settings/modules': state });
          dispose = bindCrmHttpForTest(stub);
          TestBed.configureTestingModule({
            providers: [
              {
                provide: ScopeState,
                useValue: { company: signal({ id: 'company' }), companies: signal([]) },
              },
              { provide: LanguageState, useValue: { current: signal(language) } },
            ],
          });
          modules = TestBed.inject(CrmModules);
        });

        afterEach(() => {
          dispose();
          if (previousTheme === null) document.documentElement.removeAttribute('data-theme');
          else document.documentElement.setAttribute('data-theme', previousTheme);
          document.documentElement.lang = previousLanguage;
          document.documentElement.dir = previousDirection;
        });

        it('reads modules calls', async () => {
          state.calls = { clickToCallEnabled: false, logCallsAsActivities: true };
          const pending = getCrmClickToCallSetting();
          const simultaneous = getCrmClickToCallSetting();
          await expect(pending).resolves.toEqual({ clickToCallEnabled: false });
          await expect(simultaneous).resolves.toEqual({ clickToCallEnabled: false });

          state.calls = { clickToCallEnabled: true, logCallsAsActivities: false };
          modules.apply(state);
          await expect(getCrmClickToCallSetting()).resolves.toEqual({ clickToCallEnabled: true });
          expect(stub.recordedReads()).toEqual([
            { path: '/settings/modules', query: undefined, scope: undefined },
          ]);
          expect(stub.recordedWrites()).toEqual([]);
        });

        it('defaults without calls', async () => {
          await modules.ensureLoaded();
          await expect(getCrmClickToCallSetting()).resolves.toEqual({ clickToCallEnabled: true });
          state.calls = { logCallsAsActivities: true };
          modules.apply(state);
          await expect(getCrmClickToCallSetting()).resolves.toEqual({ clickToCallEnabled: true });
          expect(stub.recordedReads().map(({ path }) => path)).toEqual(['/settings/modules']);
          expect(stub.recordedWrites()).toEqual([]);
        });
      });
    }
  }
});
