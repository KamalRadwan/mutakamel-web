import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import en from '../../../../../../public/i18n/leads/en.json';
import ar from '../../../../../../public/i18n/leads/ar.json';
import { of } from 'rxjs';
import { ApiError } from '../../../../core/api/api-errors';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { LeadBoard } from '../lead-board/lead-board';
import { CONTRACT_ROW, CONTRACT_STAGES, ListContractHttp, contractLane, contractPage } from '../lead-board/lead-list.contract-fixture';
import { LIST_CAPABILITIES } from '../lead-board/lead-list.testing';
import { leadList } from '../lead-list';
import { LeadSearchBody, compileLeadQuery } from '../lead-search/lead-search.compile';
import { leadSearchFields } from '../lead-search/lead-search.fields';
import { LeadsPage } from './leads-page';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    const messages = lang.endsWith('ar') ? ar : en;
    return of(lang.includes('/') ? messages : { leads: messages });
  }
}

describe.each([['en', 'light'], ['en', 'dark'], ['ar', 'light'], ['ar', 'dark']])('List contracts %s / %s', (lang, theme) => {
  let http: ListContractHttp;
  let dispose: () => void;
  let attributes: (string | null)[];
  let storedLanguage: string | null;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    attributes = ['lang', 'dir', 'data-theme'].map((key) => document.documentElement.getAttribute(key));
    storedLanguage = localStorage.getItem('lang');
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset['theme'] = theme;
    TestBed.configureTestingModule({ providers: [
      { provide: TenantScopeState, useValue: { selection: signal({ companyId: 'company', branchId: null }),
        branchCompanies: () => new Map(), me: signal({ permissions: ['crm.leads.read.all'] }) } },
      provideRouter([]), provideTransloco({
      config: { availableLangs: ['en', 'ar'], defaultLang: lang, missingHandler: { logMissingKey: false } }, loader: EmptyLoader,
    })] });
    TestBed.inject(LanguageState).current.set(lang as 'en' | 'ar');
    TestBed.inject(TranslocoService).setTranslation({ leads: lang === 'ar' ? ar : en }, lang);
    http = new ListContractHttp();
    dispose = bindCrmHttpForTest(http);
    crmQueries().clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    dispose(); bindAnalyticsPermissions(() => []);
    TestBed.resetTestingModule();
    if (storedLanguage === null) localStorage.removeItem('lang');
    else localStorage.setItem('lang', storedLanguage);
    ['lang', 'dir', 'data-theme'].forEach((key, i) => attributes[i] === null
      ? document.documentElement.removeAttribute(key) : document.documentElement.setAttribute(key, attributes[i]!));
  });

  async function listSetup(page = signal(1)) {
    const body = signal<LeadSearchBody>({ branchId: 'branch' });
    const capabilities = signal(LIST_CAPABILITIES);
    const onPage = vi.fn();
    const list = TestBed.runInInjectionContext(() => leadList(body, signal(CONTRACT_STAGES), signal('all'), page,
      signal(24), onPage, undefined, undefined, capabilities));
    TestBed.tick(); await TestBed.inject(Notify); await Promise.resolve(); TestBed.tick();
    await vi.waitFor(() => { TestBed.tick(); expect(list.loading()).toBe(false); });
    return { list, body, onPage, capabilities };
  }

  it('LeadList › invalid search keeps the page', async () => {
    const { list, body } = await listSetup();
    const before = list.items();
    const toast = vi.spyOn(TestBed.inject(Notify), 'error');
    http.failures.set('/leads/search', new ApiError(400, 'INVALID_FIELD'));
    body.set({ branchId: 'branch', search: 'invalid' }); TestBed.tick();
    await vi.waitFor(() => { TestBed.tick(); expect(list.loading()).toBe(false); });
    expect(list.items()).toEqual(before);
    expect(toast).toHaveBeenCalledWith((lang === 'ar' ? ar : en)['search.invalid']);
  });

  it('LeadList › empty page falls back', async () => {
    http.search = (page) => contractPage(page, page === 2 ? [] : [{ ...CONTRACT_ROW }]);
    const { list, onPage } = await listSetup(signal(2));
    expect(onPage).toHaveBeenCalledWith(1);
    expect(list.items()).toEqual([CONTRACT_ROW]);
    expect(http.recordedWrites().map((call) => (call.body as { page: number }).page)).toEqual([2, 1]);
  });

  it('LeadList › rating conflict', async () => {
    const { list } = await listSetup();
    http.failures.set('/leads/lead', new ApiError(409, 'CRM.LEAD.CONCURRENT_UPDATE'));
    await list.rate(CONTRACT_ROW, 3);
    expect(list.writes.conflictOpen()).toBe(true);
    expect(http.recordedWrites().filter((call) => call.method === 'PATCH')).toHaveLength(1);
    http.search = () => contractPage(1, [{ ...CONTRACT_ROW, updatedAt: 'fresh-token', rating: 2 }]);
    await list.writes.keepConflict();
    expect(list.items()[0]).toMatchObject({ updatedAt: 'fresh-token', rating: 3 });
    expect(http.recordedWrites().filter((call) => call.method === 'PATCH')).toHaveLength(1);
  });

  it('blocks further actions when writes become read only', async () => {
    const { list, capabilities } = await listSetup();
    http.failures.set('/leads/lead', new ApiError(403, 'CRM_LEADS_DISABLED'));
    await list.rate(CONTRACT_ROW, 3);
    expect(list.writes.readOnly()).toBe(true);
    expect(list.writes.canUpdate(CONTRACT_ROW)).toBe(false);
    expect(list.writes.canDelete(CONTRACT_ROW)).toBe(false);
    await list.rate(CONTRACT_ROW, 2);
    expect(http.recordedWrites().filter((call) => call.method === 'PATCH')).toHaveLength(1);
    capabilities.set({ ...LIST_CAPABILITIES, branchId: 'another-branch' });
    TestBed.tick();
    expect(list.writes.readOnly()).toBe(false);
  });

  async function boardSetup() {
    const fixture = TestBed.createComponent(LeadBoard);
    fixture.componentRef.setInput('body', { branchId: 'branch' });
    fixture.componentRef.setInput('capabilities', LIST_CAPABILITIES);
    fixture.detectChanges();
    await fixture.whenStable(); fixture.detectChanges();
    return fixture;
  }

  it('LeadBoard › lane paging and failure', async () => {
    const fixture = await boardSetup();
    const board = fixture.componentInstance;
    const internals = board as unknown as { loadMore: (lane: ReturnType<typeof contractLane>) => Promise<void> };
    http.failures.set('/leads/board/stages/new', new ApiError(503, 'UNAVAILABLE'));
    await internals.loadMore(contractLane()); fixture.detectChanges();
    expect(board.hasItem('lead')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain((lang === 'ar' ? ar : en).retry);
    http.failures.delete('/leads/board/stages/new');
    await internals.loadMore(contractLane());
    expect(board.hasItem('lead')).toBe(true); expect(board.hasItem('next')).toBe(true);
    fixture.destroy();
  });

  it('LeadBoard › own scope locks others', async () => {
    const fixture = await boardSetup();
    fixture.componentRef.setInput('capabilities', { ...LIST_CAPABILITIES,
      leads: { ...LIST_CAPABILITIES.leads, update: { scope: 'own', ownerUserIds: ['someone-else'] } } });
    fixture.detectChanges();
    const board = fixture.componentInstance as unknown as { canDragLead: (row: typeof CONTRACT_ROW) => boolean };
    expect(board.canDragLead(CONTRACT_ROW)).toBe(false);
    expect(board.canDragLead({ ...CONTRACT_ROW, owner: { ...CONTRACT_ROW.owner!, userId: 'someone-else' } })).toBe(true);
    await fixture.componentInstance.rate(CONTRACT_ROW, 3);
    expect(http.recordedWrites().some((call) => call.method === 'PATCH')).toBe(false);
    expect(board.canDragLead({ ...CONTRACT_ROW, status: 'CONVERTED' })).toBe(false);
    fixture.destroy();
  });

  it('LeadBoard › converted meanwhile', async () => {
    const fixture = await boardSetup();
    const before = http.recordedWrites().filter((call) => call.path === '/leads/board').length;
    http.failures.set('/leads/lead/stage', new ApiError(409, 'LEAD_ALREADY_CONVERTED'));
    await fixture.componentInstance.move('lead', 'qualified');
    fixture.detectChanges(); await fixture.whenStable();
    expect(http.recordedWrites().filter((call) => call.path === '/leads/board').length).toBeGreaterThan(before);
    fixture.destroy();
  });

  it('reloads the board when a lane stage disappears', async () => {
    const fixture = await boardSetup();
    http.failures.set('/leads/board/stages/new', new ApiError(404, 'LEAD_STAGE_NOT_FOUND'));
    const board = fixture.componentInstance as unknown as { loadMore: (lane: ReturnType<typeof contractLane>) => Promise<void> };
    await board.loadMore(contractLane());
    fixture.detectChanges(); await fixture.whenStable();
    expect(http.recordedWrites().filter((call) => call.path === '/leads/board')).toHaveLength(2);
    fixture.destroy();
  });

  it('LeadSearch › facet degrades alone', () => {
    const fields = leadSearchFields({ t: (key) => key, language: lang as 'en' | 'ar', stages: [], sources: [], tags: [],
      owners: async () => [], unavailable: ['source'] });
    expect(fields.some((field) => field.id === 'source')).toBe(false);
    expect(fields.some((field) => field.id === 'stage')).toBe(true);
    expect(fields.some((field) => field.id === 'tag')).toBe(true);
    expect(fields.every((field) => !!field.hint)).toBe(true);
  });

  it('LeadSearch › wire map has only backend fields', () => {
    for (const field of ['qualifiedAt', 'disqualifiedAt', 'disqualificationReasonId', 'convertedCustomerId']) {
      expect(compileLeadQuery({ fixed: [], root: { kind: 'group', id: 'root', op: 'AND', children: [
        { kind: 'condition', id: 'bad', field, operator: 'eq', value: 'invalid' },
      ] } }, { branchId: 'branch', meUserId: 'me', timeZone: 'UTC' })).toEqual({ branchId: 'branch' });
    }
  });

  it('LeadSearch › dates without a zone', () => {
    const fields = leadSearchFields({ t: (key) => key, language: lang as 'en' | 'ar', stages: [], sources: [], tags: [], owners: async () => [], timeZone: null });
    expect(fields.find((field) => field.id === 'createdAt')?.hint).toContain('UTC');
    const result = compileLeadQuery({ fixed: [], root: { kind: 'group', id: 'root', op: 'AND', children: [
      { kind: 'condition', id: 'date', field: 'createdAt', operator: 'on', value: '2026-11-23' },
    ] } }, { branchId: 'branch', meUserId: 'me', timeZone: 'UTC' });
    expect(result.filterTree).toEqual({ op: 'AND', children: [
      { field: 'createdAt', operator: 'gte', value: '2026-11-23T00:00:00+00:00' },
      { field: 'createdAt', operator: 'lt', value: '2026-11-24T00:00:00+00:00' },
    ] });
  });

  it('LeadsPage › no session branch', async () => {
    bindAnalyticsPermissions(() => ['crm.leads.read.all']);
    const fixture = TestBed.createComponent(LeadsPage);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain((lang === 'ar' ? ar : en).chooseBranch);
    expect(document.documentElement.dir).toBe(lang === 'ar' ? 'rtl' : 'ltr');
    expect(document.documentElement.dataset['theme']).toBe(theme);
    expect(http.recordedReads()).toEqual([]); expect(http.recordedWrites()).toEqual([]);
    fixture.destroy();
  });
});
