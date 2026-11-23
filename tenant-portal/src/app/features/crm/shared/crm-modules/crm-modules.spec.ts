import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { LanguageState } from '../../../../core/i18n/language';
import { ScopeState } from '../../../../core/scope/scope';
import { bindCrmHttpForTest } from '../crm-http';
import { CrmHttpStub } from '../testing/crm-http-testing';
import { requireCrmModuleAnywhere } from './crm-module.guard';
import { CrmModules } from './crm-modules';
import type { CrmModulesState } from './crm-modules.model';

for (const lang of ['en', 'ar'] as const)
  for (const theme of ['light', 'dark'] as const) {
    describe(`CrmModules ${lang} ${theme}`, () => {
      const company = signal({ id: 'company' });
      let stub: CrmHttpStub;
      let dispose: () => void;
      let fixtures: Record<string, CrmModulesState>;
      let previousTheme: string | null;
      let previousDir: string;
      beforeEach(() => {
        previousTheme = document.documentElement.getAttribute('data-theme');
        previousDir = document.documentElement.dir;
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        company.set({ id: 'company' });
        fixtures = {
          '/settings/modules': {
            revision: 12,
            defaults: { leadsEnabled: false, opportunitiesEnabled: false },
            companies: [
              {
                companyId: 'company',
                code: 'CO1',
                name: 'Server name',
                status: 'ACTIVE',
                override: { leadsEnabled: true, opportunitiesEnabled: null },
                effective: { leadsEnabled: true, opportunitiesEnabled: false },
              },
            ],
          },
        };
        stub = new CrmHttpStub(fixtures);
        dispose = bindCrmHttpForTest(stub);
        TestBed.configureTestingModule({
          providers: [
            {
              provide: ScopeState,
              useValue: {
                company,
                companies: signal([
                  { id: 'company', nameEn: 'Company One', nameAr: 'الشركة الأولى' },
                ]),
              },
            },
            { provide: LanguageState, useValue: { current: signal(lang) } },
            { provide: Router, useValue: { createUrlTree: (commands: string[]) => commands } },
          ],
        });
      });
      afterEach(() => {
        dispose();
        vi.restoreAllMocks();
        if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
        else document.documentElement.removeAttribute('data-theme');
        document.documentElement.dir = previousDir;
      });

      it('real state', async () => {
        const modules = TestBed.inject(CrmModules);
        await modules.ensureLoaded();
        expect(stub.recordedReads().map((read) => read.path)).toEqual(['/settings/modules']);
        expect(modules.state()?.revision).toBe(12);
        expect(modules.state()?.companies[0].name).toBe(
          lang === 'ar' ? 'الشركة الأولى' : 'Company One',
        );
        expect(modules.leadsEnabled()).toBe(true);
        expect(modules.opportunitiesEnabled()).toBe(false);
        expect(modules.leadsAnywhere()).toBe(true);
        expect(modules.opportunitiesAnywhere()).toBe(false);
        const guard = (module: 'leads' | 'opportunities') =>
          TestBed.runInInjectionContext(() =>
            requireCrmModuleAnywhere(module)({} as never, {} as never),
          );
        await expect(guard('leads')).resolves.toBe(true);
        await expect(guard('opportunities')).resolves.toEqual(['/crm/off', 'opportunities']);
        company.set({ id: 'other' });
        expect(modules.leadsEnabled()).toBe(false);
        expect(stub.recordedReads()).toHaveLength(1);
      });

      it('deduplicates loading and refetches real defaults even when the revision stays the same', async () => {
        const modules = TestBed.inject(CrmModules);
        await Promise.all([modules.ensureLoaded(), modules.ensureLoaded()]);
        expect(stub.recordedReads()).toHaveLength(1);
        fixtures['/settings/modules'].defaults.opportunitiesEnabled = true;
        fixtures['/settings/modules'].companies[0].effective.opportunitiesEnabled = true;
        await modules.reload();
        expect(modules.opportunitiesEnabled()).toBe(true);
        expect(modules.state()?.revision).toBe(12);
      });

      it('exposes read failures without changing the existing guard fallback and retries', async () => {
        const modules = TestBed.inject(CrmModules);
        const error = new ApiError(503, 'CRM_SETTINGS_MISSING');
        const read = vi.spyOn(stub, 'read').mockRejectedValueOnce(error);
        await modules.ensureLoaded();
        expect(modules.state()).toBeNull();
        expect(modules.error()).toBe(error);
        expect(modules.leadsAnywhere()).toBe(true);
        await modules.ensureLoaded();
        expect(read).toHaveBeenCalledTimes(2);
        expect(modules.error()).toBeNull();
        expect(modules.state()?.revision).toBe(12);
        read.mockRejectedValueOnce(error);
        await modules.reload();
        expect(modules.state()?.revision).toBe(12);
        expect(modules.error()).toBe(error);
      });

      it('preserves apply and applyDefaults for existing callers', () => {
        const modules = TestBed.inject(CrmModules);
        modules.applyDefaults({ leadsEnabled: false });
        expect(modules.leadsAnywhere()).toBe(false);
        modules.apply(fixtures['/settings/modules']);
        modules.applyDefaults({ opportunitiesEnabled: true });
        expect(modules.state()?.companies[0].effective).toEqual({
          leadsEnabled: true,
          opportunitiesEnabled: true,
        });
        expect(modules.loaded()).toBe(true);
      });
    });
  }
