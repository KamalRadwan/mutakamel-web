import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import assetEn from '../../../../../../../public/i18n/templates-assets/en.json';
import templatesEn from '../../../../../../../public/i18n/templates/en.json';
import globalEn from '../../../../../../../public/i18n/en.json';
import recordEn from '../../../../../../../public/i18n/record-page/en.json';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type { TemplateAssetDto, TemplateListRow } from '../../templates.model';
import { AssetsPage } from './assets-page';

class Loader {
  getTranslation(lang: string) { return of((lang.startsWith('templates-assets/') ? assetEn : lang.startsWith('templates/') ? templatesEn : lang.startsWith('record-page/') ? recordEn : globalEn) as Translation); }
}
const base = '/api/tenant/core/v1/templates';
const assets = `${base}/assets`;
const asset: TemplateAssetDto = { assetId: 'asset', definitionId: null, assetType: 'IMAGE', originalFileName: 'image.png',
  mimeType: 'image/png', sizeBytes: 10, widthPx: 2, heightPx: 2, checksum: 'a'.repeat(64), deliveryClass: 'PRIVATE_ONLY',
  emailRendition: { kind: 'NOT_REQUESTED' }, status: 'RETIRED', revision: 1, etag: '"asset:asset:1"',
  createdAt: '2026-11-22T00:00:00Z', updatedAt: '2026-11-22T00:00:00Z',
  createdBy: { kind: 'USER', actorId: 'actor', displayName: 'Author' }, updatedBy: { kind: 'USER', actorId: 'actor', displayName: 'Author' } };
const definition = (id: string): TemplateListRow => ({ templateId: id, name: id, code: id,
  definitionScope: { type: 'COMPANY', companyId: 'company' } } as TemplateListRow);
function page(items: unknown[] = [], nextCursor: string | null = null, totalCount = items.length) {
  return { success: true, data: { items, totalCount, pageInfo: { limit: 100, hasNextPage: !!nextCursor, nextCursor } } };
}

describe('AssetsPage', () => {
  let fixture: ComponentFixture<AssetsPage>;
  let component: AssetsPage;
  let http: HttpTestingController;
  const me = signal({ id: 'actor', isTenantOwner: true, permissions: ['templates.read', 'templates.assets.manage'],
    permissionScopes: { 'templates.read': { tenantWide: false, companyIds: ['company'], branchIds: [] as string[] },
      'templates.assets.manage': { tenantWide: false, companyIds: ['company'], branchIds: [] as string[] } } });
  const selection = signal<{ companyId: string; branchId: string | null }>({ companyId: 'company', branchId: 'branch' });
  const notify = { success: vi.fn(), error: vi.fn() };
  beforeEach(() => {
    me.update((v) => ({ ...v, isTenantOwner: true }));
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('mutakamel-http-tenant-csrf=csrf-proof; __Host-mutakamel-tenant-csrf=csrf-proof');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    TestBed.configureTestingModule({ imports: [AssetsPage], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: Loader }),
      { provide: TenantScopeState, useValue: { me, selection, branchCompanies: signal(new Map([['branch', 'company']])) } },
      { provide: LanguageState, useValue: { current: signal('en') } }, { provide: Notify, useValue: notify }] });
    http = TestBed.inject(HttpTestingController);
    notify.error.mockClear(); notify.success.mockClear();
  });
  afterEach(() => {
    fixture?.destroy(); http.verify(); vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });
  async function tick() { await new Promise((resolve) => setTimeout(resolve, 0)); fixture.detectChanges(); }
  async function start() {
    fixture = TestBed.createComponent(AssetsPage); component = fixture.componentInstance;
    fixture.detectChanges(); await tick();
  }
  async function boot(items: TemplateAssetDto[] = [], next: string | null = null) {
    await start();
    http.expectOne((r) => r.url === base).flush(page([definition('definition')]));
    http.expectOne((r) => r.url === assets).flush(page(items, next));
    await tick();
  }
  async function retireFailure(status: number, code: string) {
    await boot([asset]);
    const target = { ...asset, status: 'ACTIVE' as const };
    vi.spyOn(component['retireConfirm']()!, 'open').mockResolvedValue(true);
    const pending = component['requestRetire'](target); await tick();
    http.expectOne(`${assets}/asset`).flush({ errorCode: code }, { status, statusText: 'Failure' });
    await pending; await tick();
  }

  it('lists assets and loads more', async () => {
    await boot([asset], 'next');
    expect(fixture.nativeElement.textContent).toContain('image.png');
    component['goNextPage'](); await tick();
    const req = http.expectOne((r) => r.url === assets);
    expect(req.request.params.get('cursor')).toBe('next');
    req.flush(page([{ ...asset, assetId: 'second', originalFileName: 'second.png' }])); await tick();
    expect(component['items']()).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('second.png');
  });
  it('schema invalid resets the definition filter', async () => {
    await boot(); component['setScopeFilter']('DEFINITION'); await tick();
    http.expectOne((r) => r.url === assets).flush({ errorCode: 'SCHEMA.INVALID' }, { status: 400, statusText: 'Invalid' });
    await tick();
    expect(component['scopeFilter']()).toBe('ALL_AUTHORIZED');
    expect(component['definitionIdFilter']()).toBe('');
    http.expectOne((r) => r.url === assets).flush(page()); await tick();
  });
  it('feature disabled shows the plan full state', async () => {
    await start(); http.expectOne((r) => r.url === base).flush(page());
    http.expectOne((r) => r.url === assets).flush({ errorCode: 'FEATURE.DISABLED' }, { status: 403, statusText: 'Forbidden' });
    await tick();
    expect(fixture.nativeElement.querySelector('ui-full-state')?.getAttribute('kind')).toBe('forbidden');
    expect(component['isFeatureDisabled']()).toBe(true);
  });
  it('a 5xx shows load failure', async () => {
    await start(); http.expectOne((r) => r.url === base).flush(page());
    http.expectOne((r) => r.url === assets).flush({ errorCode: 'COMMON.GENERIC.INTERNAL_ERROR', correlationId: 'ref' }, { status: 503, statusText: 'Unavailable' });
    await tick();
    expect(fixture.nativeElement.querySelector('ui-full-state')?.getAttribute('kind')).toBe('load-failure');
    expect(fixture.nativeElement.textContent).toContain('ref');
    component['reload'](); await tick();
    http.expectOne((r) => r.url === base).flush(page());
    http.expectOne((r) => r.url === assets).flush(page()); await tick();
    expect(component['loadFailed']()).toBe(false);
  });
  it('first use and filtered empty', async () => {
    await boot();
    expect(component['hasActiveFilters']()).toBe(false);
    component['search'].set('missing'); await tick();
    http.expectOne((r) => r.url === assets).flush(page()); await tick();
    expect(fixture.nativeElement.textContent).toContain(assetEn.states.emptyFiltered.title);
  });
  it('retire refreshes', async () => {
    await boot([asset]);
    vi.spyOn(component['retireConfirm']()!, 'open').mockResolvedValue(true);
    const pending = component['requestRetire']({ ...asset, status: 'ACTIVE' }); await tick();
    const req = http.expectOne(`${assets}/asset`);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await pending; await tick();
    expect(notify.success).toHaveBeenCalledWith('Asset retired');
    http.expectOne((r) => r.url === assets).flush(page([asset])); await tick();
  });
  it('retire 403 shows a toast', async () => { await retireFailure(403, 'MISSING_REQUIRED_PERMISSIONS'); expect(notify.error).toHaveBeenCalled(); });
  it('in use shows a toast', async () => { await retireFailure(409, 'CORE.TEMPLATE.ASSET.IN_USE'); expect(notify.error).toHaveBeenCalledWith(assetEn.errors['CORE.TEMPLATE.ASSET.IN_USE']); expect(component['conflictOpen']()).toBe(false); });
  it('stale retire opens the conflict modal', async () => { await retireFailure(409, 'CORE.TEMPLATE.STALE_REVISION'); expect(component['conflictOpen']()).toBe(true); expect(!!fixture.nativeElement.querySelector('ui-conflict-dialog dialog[open]')).toBe(true); });
  it('a 428 shows a toast', async () => { await retireFailure(428, 'CORE.TEMPLATE.PRECONDITION_REQUIRED'); expect(notify.error).toHaveBeenCalled(); });
  it('retire retries keep the key until the intent changes', async () => {
    await boot([asset]);
    let key: string | null = null;
    for (const status of [0, 503, 409]) {
      const pending = component['performRetire'](asset);
      const req = http.expectOne(`${assets}/asset`);
      const currentKey = req.request.headers.get('x-idempotency-key');
      expect(currentKey).toMatch(/^[a-f0-9-]{14}7[a-f0-9-]{21}$/);
      if (key) expect(currentKey).toBe(key);
      key = currentKey;
      expect(req.request.body).toBeNull();
      if (status === 0) req.error(new ProgressEvent('network'), { status: 0, statusText: 'Network' });
      else req.flush({ errorCode: status === 409 ? 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT' : 'COMMON.GENERIC.INTERNAL_ERROR' }, { status, statusText: 'Failure' });
      await pending;
    }
    const changed = component['performRetire']({ ...asset, etag: '"asset:asset:2"' });
    const req = http.expectOne(`${assets}/asset`);
    expect(req.request.headers.get('x-idempotency-key')).not.toBe(key);
    expect(req.request.headers.get('If-Match')).toBe('"asset:asset:2"');
    req.flush({ errorCode: 'MISSING_REQUIRED_PERMISSIONS' }, { status: 403, statusText: 'Forbidden' }); await changed;
  });
  it('keep my changes reads the latest etag before another retire', async () => {
    await retireFailure(409, 'CORE.TEMPLATE.STALE_REVISION');
    const pending = component['resolveRetireConflict'](true);
    http.expectOne(`${assets}/asset`).flush({ success: true, data: { asset: { ...asset, etag: '"asset:asset:2"' }, delivery: { kind: 'UNAVAILABLE', reason: 'NOT_ACTIVE' } } });
    await tick();
    const req = http.expectOne(`${assets}/asset`);
    expect(req.request.headers.get('If-Match')).toBe('"asset:asset:2"');
    req.flush({ errorCode: 'CORE.TEMPLATE.ASSET.IN_USE' }, { status: 409, statusText: 'Conflict' });
    await pending;
    expect(component['conflictOpen']()).toBe(false);
  });
  it('reusable assets need tenant-wide manage', async () => {
    me.update((v) => ({ ...v, isTenantOwner: false })); await boot([asset]);
    expect(component['actionsFor'](asset).map((v) => v.id)).toEqual(['open']);
    component['openUpload']();
    expect(component['uploadModal']()!['scopeOptions']().map((v) => v.value)).toEqual(['DEFINITION']);
  });
  it('definition assets follow the company scope', async () => {
    me.update((v) => ({ ...v, isTenantOwner: false })); await boot();
    expect(component['actionsFor']({ ...asset, definitionId: 'definition', status: 'ACTIVE' }).map((v) => v.id)).toContain('retire');
    expect(component['canManageAsset']({ ...asset, definitionId: 'unknown' })).toBe(false);
    me.update((v) => ({ ...v, permissionScopes: { ...v.permissionScopes, 'templates.assets.manage': { tenantWide: false, companyIds: [], branchIds: ['branch'] } } }));
    await tick();
    http.expectOne((r) => r.url === base).flush(page([definition('definition')]));
    http.expectOne((r) => r.url === assets).flush(page()); await tick();
    expect(component['canManageAsset']({ ...asset, definitionId: 'definition' })).toBe(true);
  });
  it('definition filter loops the cursor with the scope', async () => {
    me.update((v) => ({ ...v, isTenantOwner: false })); await start();
    for (let i = 0; i < 3; i++) {
      const req = http.expectOne((r) => r.url === base);
      expect(req.request.params.get('assignmentScopeType')).toBe('BRANCH');
      expect(req.request.params.get('assignmentCompanyId')).toBe('company');
      expect(req.request.params.get('assignmentBranchId')).toBe('branch');
      expect(req.request.params.get('cursor')).toBe(i ? `cursor${i}` : null);
      req.flush(page([definition(`def${i}`)], i < 2 ? `cursor${i + 1}` : null)); await tick();
    }
    http.expectOne((r) => r.url === assets).flush(page()); await tick();
    expect(component['templatesList']()).toHaveLength(3);
  });
  it('over 500 definitions switches to search', async () => {
    await start(); http.expectOne((r) => r.url === base).flush(page([definition('one')], 'next', 501));
    http.expectOne((r) => r.url === assets).flush(page()); await tick();
    component['setScopeFilter']('DEFINITION'); await tick();
    expect(fixture.nativeElement.querySelector('#asset-definition-search')).toBeTruthy();
    component['definitionSearch'].set('invoice'); await tick();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.get('name')).toBe('invoice');
    req.flush(page([definition('invoice')])); await tick();
    expect(component['templatesList']()).toHaveLength(1);
  });
});
