import { Injectable, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import en from '../../../../../../public/i18n/leads/en.json';
import ar from '../../../../../../public/i18n/leads/ar.json';
import { CoreWriteMethod } from '../../../../core/api/core-http';
import { AuthSession } from '../../../../core/auth/auth-session';
import { LanguageState } from '../../../../core/i18n/language';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { StepFilter } from '../../../../shared/ui/step-filter/step-filter';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { bindCrmHttpForTest, crmQueries, CrmWriteOptions } from '../../shared/crm-http';
import { bindCrmInjectorForTest } from '../../shared/crm-runtime';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CONTRACT_STAGES } from '../lead-board/lead-list.contract-fixture';
import { LeadKpisResponse } from '../leads.api';
import { LeadsPage } from './leads-page';

const companyId = '019f0000-0000-7000-8000-000000000010';
const branchId = '019f0000-0000-7000-8000-000000000011';

@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) {
    const messages = path.endsWith('ar') ? ar : en;
    return of(path.includes('/') ? messages : { leads: messages });
  }
}

class KpisHttp extends CrmHttpStub {
  kpis: LeadKpisResponse = { totalLeads: 11, newStageLeads: 8, qualifiedLeads: 3, newTodayLeads: 2,
    hotLeads: 1, overdueActivityLeads: 0, byStage: [{ stageId: 'new', count: 8 }, { stageId: 'qualified', count: 3 }] };

  constructor() { super({ '/lead-stages': CONTRACT_STAGES, '/acquisition-sources': [], '/tags': [], '/leads/capabilities': {} }); }

  capabilities: unknown = {};

  override async read<T>(...args: Parameters<CrmHttpStub['read']>): Promise<T> {
    return args[0] === '/leads/capabilities' ? structuredClone(this.capabilities) as T : super.read<T>(...args);
  }

  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions) {
    const result = await super.write<T>(method, path, body, options);
    if (path !== '/leads/kpis') throw new Error(`Unexpected POST ${path}`);
    return { ...result, data: structuredClone(this.kpis) as T };
  }
}

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('Lead KPI counts %s / %s', (lang, theme) => {
  let http: KpisHttp;
  let dispose: () => void;
  let restoreRuntime: () => void;
  let attributes: (string | null)[];
  let storedLanguage: string | null;

  beforeEach(() => {
    attributes = ['lang', 'dir', 'data-theme'].map((key) => document.documentElement.getAttribute(key));
    storedLanguage = localStorage.getItem('lang');
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    bindAnalyticsPermissions(() => ['crm.leads.read.all']);
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: AuthSession, useValue: { status: () => 'signed-out', me: () => null } },
      { provide: TenantScopeState, useValue: { selection: signal({ companyId, branchId }),
        branchCompanies: () => new Map([[branchId, companyId]]), me: () => null } },
      { provide: BulkJobsTracker, useValue: { finished: signal(null), jobs: signal([]) } },
      provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang }, loader: Loader }),
    ] });
    // Render the stage filter while excluding unrelated list children, each owned by another package.
    TestBed.overrideComponent(LeadsPage, { set: { template: `
      <ui-step-filter [steps]="stageSteps()" [value]="stage()"
        [label]="'leads.stageFilter.label' | transloco" [hint]="'leads.stageFilter.hint' | transloco" />
    ` } });
    TestBed.inject(LanguageState).current.set(lang as 'en' | 'ar');
    TestBed.inject(TranslocoService).setTranslation({ leads: lang === 'ar' ? ar : en }, lang);
    restoreRuntime = bindCrmInjectorForTest(() => TestBed.inject(Injector));
    http = new KpisHttp(); dispose = bindCrmHttpForTest(http); crmQueries().clear();
  });

  afterEach(() => {
    TestBed.resetTestingModule(); crmQueries().clear(); dispose(); restoreRuntime(); bindAnalyticsPermissions(() => []);
    if (storedLanguage === null) localStorage.removeItem('lang');
    else localStorage.setItem('lang', storedLanguage);
    ['lang', 'dir', 'data-theme'].forEach((key, index) => attributes[index] === null
      ? document.documentElement.removeAttribute(key) : document.documentElement.setAttribute(key, attributes[index]!));
  });

  it.each(['cards', 'table'])('LeadsPage › stage counts from kpis (%s)', async (view) => {
    const fixture = TestBed.createComponent(LeadsPage);
    fixture.componentRef.setInput('view', view);
    fixture.componentRef.setInput('stage', 'qualified');
    const filter = () => fixture.debugElement.query(By.directive(StepFilter)).componentInstance as StepFilter;
    await vi.waitFor(() => { fixture.detectChanges(); expect(filter().steps().map((step) => step.count)).toEqual([11, 8, 3, 0]); });
    expect(filter().steps()[1].label).toBe(lang === 'ar' ? 'جديد' : 'New');
    expect(filter().hint()).toBeTruthy();
    const buttons = fixture.nativeElement.querySelectorAll('button[role=radio]') as NodeListOf<HTMLButtonElement>;
    expect([...buttons].every((button) => !!button.getAttribute('aria-describedby'))).toBe(true);
    expect(buttons[1].textContent).toContain('8');
    const calls = http.recordedWrites();
    expect(calls.every((call) => call.path === '/leads/kpis' && !!call.options.key && call.options.scope === undefined)).toBe(true);
    expect(calls.some((call) => JSON.stringify(call.body).includes(branchId)
      && !JSON.stringify(call.body).includes('qualified'))).toBe(true);
    expect(calls.some((call) => JSON.stringify(call.body).includes('qualified'))).toBe(false);
    const page = fixture.componentInstance as unknown as { reloadCounts(): void };
    http.kpis = { ...http.kpis, totalLeads: 0, byStage: [] };
    page.reloadCounts();
    await vi.waitFor(() => { fixture.detectChanges(); expect(filter().steps().map((step) => step.count)).toEqual([0, 0, 0, 0]); });
    fixture.destroy();
  });

  it.each([[true, { scope: 'all', ownerUserIds: null }], [false, null]])('offers New lead only with the create capability (%s)', async (allowed, create) => {
    http.capabilities = { branchId, leads: { create } };
    const fixture = TestBed.createComponent(LeadsPage);
    const page = fixture.componentInstance as unknown as { canCreate(): boolean; capabilities(): unknown };
    await vi.waitFor(() => { fixture.detectChanges(); expect(page.capabilities()).not.toBeNull(); });
    expect(page.canCreate()).toBe(allowed);
    fixture.destroy();
  });
});
