import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import assetEn from '../../../../../../../public/i18n/templates-assets/en.json';
import templatesEn from '../../../../../../../public/i18n/templates/en.json';
import globalEn from '../../../../../../../public/i18n/en.json';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type { TemplateAssetDto } from '../../templates.model';
import { AssetDetailModal } from './asset-detail-modal';

class Loader {
  getTranslation(lang: string) { return of((lang.startsWith('templates-assets/') ? assetEn : lang.startsWith('templates/') ? templatesEn : globalEn) as Translation); }
}
const base = '/api/tenant/core/v1/templates/assets/asset';
const asset: TemplateAssetDto = { assetId: 'asset', definitionId: null, assetType: 'IMAGE', originalFileName: 'image.png',
  mimeType: 'image/png', sizeBytes: 10, widthPx: 2, heightPx: 2, checksum: 'a'.repeat(64), deliveryClass: 'PRIVATE_ONLY',
  emailRendition: { kind: 'NOT_REQUESTED' }, status: 'ACTIVE', revision: 1, etag: '"asset:asset:1"',
  createdAt: '2026-11-22T00:00:00Z', updatedAt: '2026-11-22T00:00:00Z',
  createdBy: { kind: 'USER', actorId: 'actor', displayName: 'Author' }, updatedBy: { kind: 'USER', actorId: 'actor', displayName: 'Author' } };
describe('AssetDetailModal', () => {
  let fixture: ComponentFixture<AssetDetailModal>;
  let modal: AssetDetailModal;
  let http: HttpTestingController;
  const revoke = vi.fn();
  beforeEach(async () => {
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('mutakamel-http-tenant-csrf=csrf-proof; __Host-mutakamel-tenant-csrf=csrf-proof');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    vi.stubGlobal('URL', class extends URL { static override createObjectURL = vi.fn(() => 'blob:preview'); static override revokeObjectURL = revoke; });
    revoke.mockClear();
    TestBed.configureTestingModule({ imports: [AssetDetailModal], providers: [provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: Loader }),
      { provide: TenantScopeState, useValue: { me: signal({ id: 'actor' }), selection: signal(null) } },
      { provide: LanguageState, useValue: { current: signal('en') } }, { provide: Notify, useValue: { error: vi.fn(), success: vi.fn() } }] });
    fixture = TestBed.createComponent(AssetDetailModal); modal = fixture.componentInstance;
    fixture.componentRef.setInput('canManage', true);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges(); await fixture.whenStable();
  });
  afterEach(() => {
    fixture?.destroy(); http.verify(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });
  async function detail() {
    modal.openAsset(asset, null);
    http.expectOne(base).flush({ success: true, data: { asset, delivery: { kind: 'SAME_ORIGIN_AUTHENTICATED_READ', url: `${base}/content` } } });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  it('shows the asset preview', async () => {
    await detail();
    http.expectOne(`${base}/content`).flush(new Blob(['png'], { type: 'image/png' }));
    await new Promise((resolve) => setTimeout(resolve, 0)); fixture.detectChanges();
    expect(modal['previewUrl']()).toBe('blob:preview');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('blob:preview');
    fixture.destroy();
    expect(revoke).toHaveBeenCalledWith('blob:preview');
  });
  it('not found says no longer available', async () => {
    modal.openAsset(asset, null);
    http.expectOne(base).flush({ errorCode: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No longer available');
  });
  it('retire not found closes', async () => {
    modal.openAsset(asset, 'blob:shared');
    http.expectOne(base).flush({ success: true, data: { asset, delivery: { kind: 'SAME_ORIGIN_AUTHENTICATED_READ', url: `${base}/content` } } });
    await fixture.whenStable(); fixture.detectChanges();
    vi.spyOn(modal['retireConfirm'](), 'open').mockResolvedValue(true);
    const pending = modal['requestRetire'](); await Promise.resolve();
    http.expectOne(base).flush({ errorCode: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await pending;
    expect(modal['modal']()['isOpen']).toBe(false);
  });
});
