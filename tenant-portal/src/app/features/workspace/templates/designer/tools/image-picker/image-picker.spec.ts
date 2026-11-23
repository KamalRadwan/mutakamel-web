import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, type Translation } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import toolsEn from '../../../../../../../../public/i18n/templates-designer-tools/en.json';
import templatesEn from '../../../../../../../../public/i18n/templates/en.json';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Notify } from '../../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../../core/scope/tenant-scope';
import { AssetsApi } from '../../../assets/assets.api';
import { DesignerState } from '../../designer-state';
import { ImagePicker } from './image-picker';

class Loader {
  getTranslation(lang: string) { return of((lang.startsWith('templates-designer-tools/') ? toolsEn : templatesEn) as Translation); }
}
describe('ImagePicker', () => {
  afterEach(() => {
    vi.restoreAllMocks(); vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });
  it('reads assets through AssetsApi', async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static override createObjectURL = vi.fn(() => 'blob:picker'); static override revokeObjectURL = revoke; });
    TestBed.configureTestingModule({ imports: [ImagePicker], providers: [provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: Loader }),
      { provide: TenantScopeState, useValue: { me: signal({ id: 'actor' }), selection: signal(null) } },
      { provide: LanguageState, useValue: { current: signal('en') } }, { provide: Notify, useValue: { error: vi.fn() } },
      { provide: DesignerState, useValue: { channel: signal('EMAIL'), layoutMode: signal('EMAIL_FLOW') } }] });
    const fixture = TestBed.createComponent(ImagePicker);
    const http = TestBed.inject(HttpTestingController);
    const list = vi.spyOn(TestBed.inject(AssetsApi), 'listAssets');
    const content = vi.spyOn(TestBed.inject(AssetsApi), 'getAssetContent');
    fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.openInsert();
    const base = '/api/tenant/core/v1/templates/assets';
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.get('status')).toBe('ACTIVE');
    expect(req.request.params.get('deliveryClass')).toBe('EMAIL_PUBLIC');
    req.flush({ success: true, data: { items: [{ assetId: 'asset', originalFileName: 'image.png', mimeType: 'image/png', widthPx: 2, heightPx: 2 }],
      pageInfo: { limit: 12, hasNextPage: false, nextCursor: null } } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne(`${base}/asset/content`).flush(new Blob(['png'], { type: 'image/png' }));
    await new Promise((resolve) => setTimeout(resolve, 0)); fixture.detectChanges();
    expect(list).toHaveBeenCalledOnce();
    expect(content).toHaveBeenCalledWith('asset');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('blob:picker');
    fixture.destroy();
    expect(revoke).toHaveBeenCalledWith('blob:picker');
    http.verify();
  });
});
