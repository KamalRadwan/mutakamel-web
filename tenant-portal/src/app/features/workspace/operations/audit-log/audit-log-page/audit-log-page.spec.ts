import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter, Router } from '@angular/router';
import { provideTransloco, Translation, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, defer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enAudit from '../../../../../../../public/i18n/ws-audit-log/en.json';
import enSettings from '../../../../../../../public/i18n/settings/en.json';
import enGlobal from '../../../../../../../public/i18n/en.json';
import enQuery from '../../../../../../../public/i18n/ui-query-value/en.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { Notify } from '../../../../../core/notify/notify';
import { WorkspaceLookups } from '../../../../../shared/widgets/workspace-lookups/workspace-lookups.api';
import { AuditEvent } from '../audit-log.model';
import { AuditLogPage } from './audit-log-page';

const PATH = '/api/tenant/core/v1/audit';
const translations: Record<string, Translation> = { en: enGlobal, 'ws-audit-log/en': enAudit, 'settings/en': enSettings, 'ui-query-value/en': enQuery };
const event = { id: '019a7c20-0002-7000-8000-000000000002', actorLabel: 'Sent by server', actorType: 'USER', actorUserId: 'actor', action: 'UPDATE', entityType: 'Party', entityId: 'party', entityLabel: 'Nile', createdAt: new Date().toISOString(), sourceApp: null, sourceKind: null, sensitivity: null, outcome: null, correlationId: null, diff: [], before: null, after: null } as unknown as AuditEvent;

@Injectable()
class TestLoader implements TranslocoLoader {
  getTranslation(path: string) { return defer(() => Promise.resolve(translations[path] ?? {})); }
}

const dialogProto = HTMLDialogElement.prototype;
const originalDialog = { showModal: dialogProto.showModal, close: dialogProto.close };
beforeEach(() => {
  dialogProto.showModal = function () { this.setAttribute('open', ''); };
  dialogProto.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
});
afterEach(() => { dialogProto.showModal = originalDialog.showModal; dialogProto.close = originalDialog.close; });

describe('AuditLogPage', () => {
  let fixture: ComponentFixture<AuditLogPage>;
  let page: AuditLogPage;
  let http: HttpTestingController;
  let lookups: { users: ReturnType<typeof vi.fn>; allBranches: ReturnType<typeof vi.fn> };
  let queryParams$: BehaviorSubject<ParamMap>;
  let meSignal: ReturnType<typeof signal<{
    id: string;
    isTenantOwner: boolean;
    permissions: string[];
    permissionScopes: Record<string, { tenantWide: boolean; companyIds: string[]; branchIds: string[] }>;
  } | null>>;

  beforeEach(() => {
    lookups = { users: vi.fn().mockResolvedValue({ data: [], meta: {} }), allBranches: vi.fn().mockResolvedValue([]) };
    queryParams$ = new BehaviorSubject(convertToParamMap({}));
    meSignal = signal({ id: 'actor', isTenantOwner: true, permissions: [], permissionScopes: {} });
    TestBed.configureTestingModule({ imports: [AuditLogPage], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: TenantScopeState, useValue: { me: meSignal, selection: signal(null) } },
      { provide: WorkspaceLookups, useValue: lookups },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { get queryParamMap() { return queryParams$.value; } },
          queryParamMap: queryParams$.asObservable(),
        },
      },
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', reRenderOnLangChange: true, prodMode: true }, loader: TestLoader }),
    ] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuditLogPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    try {
      fixture?.destroy();
      http?.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  async function initial(items: AuditEvent[] = [], nextCursor: string | null = null) {
    http.expectOne((r) => r.url === PATH).flush({ success: true, data: { items, nextCursor } });
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function exportToolbarButton(): HTMLButtonElement | undefined {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('section button')]
      .find((button) => button.textContent?.trim() === 'Export CSV');
  }
  async function debounce() {
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
  }

  it('load more resends the filters with the cursor', async () => {
    await initial([event], 'cursor-1');
    vi.useFakeTimers();
    page['onDropdownChange']('sourceApp', 'CRM');
    await debounce();
    const first = http.expectOne((r) => r.url === PATH);
    const filters = first.request.params;
    first.flush({ success: true, data: { items: [event], nextCursor: 'cursor-2' } });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    const pending = page['loadMore']();
    const more = http.expectOne((r) => r.url === PATH);
    expect(more.request.params.get('cursor')).toBe('cursor-2');
    for (const key of filters.keys()) expect(more.request.params.get(key)).toBe(filters.get(key));
    more.flush({ success: true, data: { items: [], nextCursor: null } });
    await pending;
  });

  it('a cursor 400 resets and reloads once', async () => {
    for (const code of ['CORE_VALIDATION_FAILED', 'AUDIT_QUERY_INVALID']) {
      if (page['loading']()) await initial([event], 'bad');
      else { page['reload'](); await initial([event], 'bad'); }
      const pending = page['loadMore']();
      http.expectOne((r) => r.params.get('cursor') === 'bad').flush({ errorCode: code }, { status: 400, statusText: 'Invalid cursor' });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const retry = http.expectOne((r) => r.url === PATH);
      expect(retry.request.params.has('cursor')).toBe(false);
      retry.flush({ errorCode: code, correlationId: 'support-ref' }, { status: 400, statusText: 'Bad request' });
      await pending;
      fixture.detectChanges();
      expect(page['loadFailed']()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('support-ref');
      http.expectNone((r) => r.url === PATH);
    }
  });

  it('a 403 shows forbidden', async () => {
    http.expectOne((r) => r.url === PATH).flush({ errorCode: 'MISSING_REQUIRED_PERMISSIONS' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Audit access required');
  });

  it('a 5xx shows load failure with Retry', async () => {
    http.expectOne((r) => r.url === PATH).flush({ errorCode: 'GW.UPSTREAM.FAILED', correlationId: 'support' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-full-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Try again');
    expect(fixture.nativeElement.textContent).toContain('support');
    const retry = fixture.nativeElement.querySelector('ui-full-state button') as HTMLButtonElement;
    retry.click(); await initial();
  });

  it('empty range shows the empty panel without a total', async () => {
    await initial();
    expect(fixture.nativeElement.textContent).toContain('No events in this period');
    expect(fixture.nativeElement.textContent).not.toContain('Showing');
    expect(fixture.nativeElement.textContent).not.toContain('results');
  });

  it('deleted search sends q with the prefix hint', async () => {
    await initial(); vi.useFakeTimers();
    page['onModeChange']('deleted');
    page['onTextInput']('q', { target: { value: 'Nile' } } as unknown as Event);
    await debounce();
    const request = http.expectOne((r) => r.url === `${PATH}/deleted`);
    expect(request.request.params.get('q')).toBe('Nile');
    request.flush({ success: true, data: { items: [], nextCursor: null } });
    await vi.advanceTimersByTimeAsync(0); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Starts with, exact letters');
    page['onModeChange']('all'); await debounce();
    const all = http.expectOne((r) => r.url === PATH);
    expect(all.request.params.has('q')).toBe(false);
    all.flush({ success: true, data: { items: [], nextCursor: null } });
  });

  it('deleted view errors match the list', async () => {
    await initial(); vi.useFakeTimers(); page['onModeChange']('deleted'); await debounce();
    for (const status of [400, 403, 503]) {
      const request = http.expectOne((r) => r.url === `${PATH}/deleted`);
      request.flush({ errorCode: status === 403 ? 'MISSING_REQUIRED_PERMISSIONS' : 'AUDIT_QUERY_INVALID' }, { status, statusText: 'Failure' });
      await vi.advanceTimersByTimeAsync(0);
      expect(page['forbidden']()).toBe(status === 403);
      expect(page['loadFailed']()).toBe(status !== 403);
      if (status !== 503) page['reload']();
    }
  });

  it('filter changes are debounced 300 ms', async () => {
    await initial(); vi.useFakeTimers();
    page['onDropdownChange']('sourceApp', 'CRM');
    await vi.advanceTimersByTimeAsync(150);
    page['onDropdownChange']('sourceApp', 'CORE');
    await vi.advanceTimersByTimeAsync(299); fixture.detectChanges();
    http.expectNone((r) => r.url === PATH);
    await vi.advanceTimersByTimeAsync(1); fixture.detectChanges();
    const request = http.expectOne((r) => r.url === PATH);
    expect(request.request.params.get('sourceApp')).toBe('CORE');
    request.flush({ success: true, data: { items: [], nextCursor: null } });
  });

  it('a 429 shows the rate-limit text', async () => {
    http.expectOne((r) => r.url === PATH).flush({ code: 'GW.RATE.LIMIT_EXCEEDED' }, { status: 429, statusText: 'Rate limited', headers: { 'Retry-After': '7' } });
    await fixture.whenStable();
    expect(TestBed.inject(Notify).toasts()[0]?.title).toBe(TestBed.inject(TranslocoService).translate('settings.errors.rateLimitedIn', { seconds: '7' }));
  });

  it.skip('include requests sends includeRequests', () => { /* Requires committed BE-O5; the switch is deliberately disabled. */ });

  it('include requests is disabled before BE-O5', async () => {
    await initial();
    const control = fixture.nativeElement.querySelector('ui-switch button') as HTMLButtonElement;
    expect(control.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Coming soon');
    page['onIncludeRequestsChange'](true);
    expect(page['draftIncludeRequests']()).toBe(false);
    expect(page['buildApiQuery']({ ...page['applied'](), includeRequests: true })).not.toHaveProperty('sourceKind');
    expect(page['buildApiQuery']({ ...page['applied'](), includeRequests: true })).not.toHaveProperty('includeRequests');
  });

  it('show related is hidden without a correlation id', async () => {
    await initial([event]);
    page['openEvent'](event);
    http.expectOne(`${PATH}/events/${event.id}`).flush({ success: true, data: event });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Show related events');
  });

  it('null provenance shows a dash', async () => {
    await initial([event]);
    const rows = fixture.nativeElement.querySelectorAll('[role="row"]');
    expect(rows[rows.length - 1].textContent).not.toContain('.null');
    expect(rows[rows.length - 1].textContent.match(/—/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('actor filter searches users', async () => {
    await initial();
    expect(lookups.users).not.toHaveBeenCalled();
    await page['searchActors']('Mona');
    expect(lookups.users).toHaveBeenCalledExactlyOnceWith({ search: 'Mona', limit: 20 });
  });

  it('actor lookup 403 shows the hint', async () => {
    await initial([event]);
    lookups.users.mockRejectedValue(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    await page['searchActors']('Mona'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Needs user read access');
    expect(page['actorDisplay'](event)).toBe('Sent by server');
    expect(page['actorDisplay']({ ...event, actorLabel: null })).toBe('System');
  });

  it('keeps the 7 day default and the 92 day limit', async () => {
    const request = http.expectOne((r) => r.url === PATH);
    const days = (Date.parse(request.request.params.get('to')!) - Date.parse(request.request.params.get('from')!)) / 86400000;
    expect(days).toBeCloseTo(7, 1);
    request.flush({ success: true, data: { items: [], nextCursor: null } });
    await fixture.whenStable();
    page['onRangePicked']({ from: '2026-01-01T00:00', to: '2026-04-03T23:59', preset: null });
    expect(page['dateRangeErrorKind']()).toBe('max');
    page['applyFilters'](); http.expectNone((r) => r.url === PATH);
  });

  it('branch filter uses the workspace lookups', async () => {
    await initial();
    expect(lookups.allBranches).toHaveBeenCalledExactlyOnceWith();
  });

  it('export button for workspace-wide auditors', async () => {
    await initial();
    expect(exportToolbarButton()).toBeTruthy();

    meSignal.set({
      id: 'auditor',
      isTenantOwner: false,
      permissions: ['audit.read'],
      permissionScopes: { 'audit.read': { tenantWide: true, companyIds: [], branchIds: [] } },
    });
    fixture.detectChanges();
    expect(exportToolbarButton()).toBeTruthy();
  });

  it('no export button for branch or own readers', async () => {
    await initial();
    const actors: NonNullable<ReturnType<typeof meSignal>>[] = [
      {
        id: 'branch-reader',
        isTenantOwner: false,
        permissions: ['audit.read.branch'],
        permissionScopes: { 'audit.read.branch': { tenantWide: false, companyIds: [], branchIds: ['br-1'] } },
      },
      {
        id: 'own-reader',
        isTenantOwner: false,
        permissions: ['audit.read.own'],
        permissionScopes: {},
      },
    ];
    for (const actor of actors) {
      meSignal.set(actor);
      fixture.detectChanges();
      expect(exportToolbarButton()).toBeUndefined();
      expect(fixture.nativeElement.querySelector('app-audit-export-modal')).toBeNull();
    }
  });

  it('ready export downloads', async () => {
    await initial();
    const exportId = '019a7c20-0020-7000-8000-000000000020';
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const hadCreate = 'createObjectURL' in URL;
    const hadRevoke = 'revokeObjectURL' in URL;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const createUrlMock = vi.fn(() => 'blob:audit-export');
    const revokeUrlMock = vi.fn();
    URL.createObjectURL = createUrlMock;
    URL.revokeObjectURL = revokeUrlMock;

    try {
      queryParams$.next(convertToParamMap({ exportId }));
      fixture.detectChanges();

      http.expectOne(`${PATH}/exports/${exportId}`).flush({
        success: true,
        data: {
          status: 'READY',
          rowsWritten: 42,
          fileName: 'audit-export-20.csv',
          sizeBytes: 512,
          expiresAt: '2026-12-01T00:00:00.000Z',
        },
      });
      await settle();

      const downloadReq = http.expectOne(`${PATH}/exports/${exportId}/download`);
      expect(downloadReq.request.responseType).toBe('blob');
      downloadReq.flush(new Blob(['\uFEFFid\n'], { type: 'text/csv; charset=utf-8' }));
      await settle();

      expect(createUrlMock).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeUrlMock).toHaveBeenCalledWith('blob:audit-export');
      expect(navigateSpy).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { exportId: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );
    } finally {
      if (hadCreate) URL.createObjectURL = origCreate;
      else delete (URL as unknown as Record<string, unknown>)['createObjectURL'];
      if (hadRevoke) URL.revokeObjectURL = origRevoke;
      else delete (URL as unknown as Record<string, unknown>)['revokeObjectURL'];
    }
  });

  it('running export shows still being prepared', async () => {
    await initial();
    const notify = TestBed.inject(Notify);

    for (const [idx, status] of (['QUEUED', 'RUNNING'] as const).entries()) {
      const exportId = `019a7c20-0021-7000-8000-00000000002${idx}`;
      queryParams$.next(convertToParamMap({ exportId }));
      fixture.detectChanges();

      http.expectOne(`${PATH}/exports/${exportId}`).flush({
        success: true,
        data: { status, rowsWritten: 0, fileName: `audit-${exportId}.csv`, sizeBytes: 0, expiresAt: null },
      });
      await settle();

      const last = notify.toasts()[notify.toasts().length - 1];
      expect(last?.type).toBe('info');
      expect(last?.title).toBe('The export is still being prepared. You will be notified.');
    }
  });

  it('failed limit export text', async () => {
    await initial();
    const exportId = '019a7c20-0022-7000-8000-000000000022';
    queryParams$.next(convertToParamMap({ exportId }));
    fixture.detectChanges();

    http.expectOne(`${PATH}/exports/${exportId}`).flush({
      success: true,
      data: {
        status: 'FAILED',
        rowsWritten: 500000,
        fileName: `audit-${exportId}.csv`,
        sizeBytes: 0,
        expiresAt: null,
        errorCode: 'AUDIT_EXPORT_LIMIT_EXCEEDED',
      },
    });
    await settle();

    const toast = TestBed.inject(Notify).toasts()[0];
    expect(toast?.type).toBe('error');
    expect(toast?.title).toBe('Too many rows (max 500 000); narrow the filters');
  });

  it('failed export text', async () => {
    await initial();
    const notify = TestBed.inject(Notify);

    const stalledId = '019a7c20-0023-7000-8000-000000000023';
    queryParams$.next(convertToParamMap({ exportId: stalledId }));
    fixture.detectChanges();
    http.expectOne(`${PATH}/exports/${stalledId}`).flush({
      success: true,
      data: {
        status: 'FAILED',
        rowsWritten: 10000,
        fileName: `audit-${stalledId}.csv`,
        sizeBytes: 0,
        expiresAt: null,
        errorCode: 'AUDIT_EXPORT_STALLED',
      },
    });
    await settle();
    expect(notify.toasts()[0]?.title).toBe('The export stopped making progress. Request a new export.');

    const genericId = '019a7c20-0024-7000-8000-000000000024';
    queryParams$.next(convertToParamMap({ exportId: genericId }));
    fixture.detectChanges();
    http.expectOne(`${PATH}/exports/${genericId}`).flush({
      success: true,
      correlationId: 'corr-fail-9',
      data: {
        status: 'FAILED',
        rowsWritten: 0,
        fileName: `audit-${genericId}.csv`,
        sizeBytes: 0,
        expiresAt: null,
        errorCode: 'UNEXPECTED_ERROR',
      },
    });
    await settle();

    const genericToast = notify.toasts()[notify.toasts().length - 1];
    expect(genericToast?.title).toBe('Export failed');
    expect(genericToast?.text).toContain('corr-fail-9');
  });

  it('expired export asks for a new one', async () => {
    await initial();
    const notify = TestBed.inject(Notify);

    const expiredId = '019a7c20-0025-7000-8000-000000000025';
    queryParams$.next(convertToParamMap({ exportId: expiredId }));
    fixture.detectChanges();
    http.expectOne(`${PATH}/exports/${expiredId}`).flush({
      success: true,
      data: {
        status: 'EXPIRED',
        rowsWritten: 12,
        fileName: `audit-${expiredId}.csv`,
        sizeBytes: 128,
        expiresAt: '2026-11-15T00:00:00.000Z',
      },
    });
    await settle();
    expect(notify.toasts()[0]?.title).toBe('Export expired, start a new one');

    const downloadExpiredId = '019a7c20-0026-7000-8000-000000000026';
    queryParams$.next(convertToParamMap({ exportId: downloadExpiredId }));
    fixture.detectChanges();
    http.expectOne(`${PATH}/exports/${downloadExpiredId}`).flush({
      success: true,
      data: {
        status: 'READY',
        rowsWritten: 12,
        fileName: `audit-${downloadExpiredId}.csv`,
        sizeBytes: 128,
        expiresAt: '2026-11-15T00:00:00.000Z',
      },
    });
    await settle();
    http.expectOne(`${PATH}/exports/${downloadExpiredId}/download`).flush(
      new Blob([JSON.stringify({ code: 'AUDIT_EXPORT_EXPIRED' })], { type: 'application/json' }),
      { status: 410, statusText: 'Gone' },
    );
    await settle();

    const latest = notify.toasts()[notify.toasts().length - 1];
    expect(latest?.title).toBe('Export expired, start a new one');
  });

  it('unknown export says no longer available', async () => {
    await initial();
    const exportId = '019a7c20-0027-7000-8000-000000000027';
    queryParams$.next(convertToParamMap({ exportId }));
    fixture.detectChanges();

    http.expectOne(`${PATH}/exports/${exportId}`).flush(
      { errorCode: 'AUDIT_EVENT_NOT_FOUND' },
      { status: 404, statusText: 'Not Found' },
    );
    await settle();

    const toast = TestBed.inject(Notify).toasts()[0];
    expect(toast?.type).toBe('error');
    expect(toast?.title).toBe('No longer available');
  });
});
