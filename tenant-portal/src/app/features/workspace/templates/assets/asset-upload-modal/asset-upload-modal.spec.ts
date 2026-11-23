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
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import type { TemplateListRow } from '../../templates.model';
import { AssetUploadModal } from './asset-upload-modal';

class Loader {
  getTranslation(lang: string) { return of((lang.startsWith('templates-assets/') ? assetEn : lang.startsWith('templates/') ? templatesEn : globalEn) as Translation); }
}
const base = '/api/tenant/core/v1/templates/assets';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('AssetUploadModal', () => {
  let fixture: ComponentFixture<AssetUploadModal>;
  let modal: AssetUploadModal;
  let http: HttpTestingController;
  const notify = { success: vi.fn(), error: vi.fn() };
  beforeEach(async () => {
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('mutakamel-http-tenant-csrf=csrf-proof; __Host-mutakamel-tenant-csrf=csrf-proof');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
    TestBed.configureTestingModule({ imports: [AssetUploadModal], providers: [provideHttpClient(), provideHttpClientTesting(),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } }, loader: Loader }),
      { provide: TenantScopeState, useValue: { me: signal({ isTenantOwner: true }), selection: signal(null) } },
      { provide: Notify, useValue: notify }] });
    fixture = TestBed.createComponent(AssetUploadModal);
    modal = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    await fixture.whenStable();
    modal.open();
    modal['draft'].update((v) => ({ ...v, deliveryClass: 'PRIVATE_ONLY' }));
    await modal['onFilePicked'](new File(['png bytes'], 'image.png', { type: 'image/png' }));
    fixture.detectChanges();
    notify.error.mockClear(); notify.success.mockClear();
  });
  afterEach(() => { fixture?.destroy(); http?.verify(); vi.restoreAllMocks(); Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close'); });

  async function sendFailure(status: number, code: string) {
    const pending = modal['submit']();
    await Promise.resolve();
    const req = http.expectOne(base);
    req.flush({ errorCode: code }, { status, statusText: 'Failure' });
    await pending;
    fixture.detectChanges();
    return req;
  }

  it('upload adds the asset', async () => {
    const added = vi.fn(); modal.uploaded.subscribe(added);
    const pending = modal['submit'](); await Promise.resolve();
    const req = http.expectOne(base);
    const form = req.request.body as FormData;
    const metadata = JSON.parse(form.get('metadata') as string);
    expect(metadata.expectedRawSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.fileName).toBe((form.get('file') as File).name);
    expect(metadata.confirmPublicEmailDelivery).toBeUndefined();
    req.flush({ success: true, data: { asset: { assetId: 'new' }, delivery: { kind: 'SAME_ORIGIN_AUTHENTICATED_READ' } } }, { status: 201, statusText: 'Created' });
    await pending;
    expect(added).toHaveBeenCalledWith({ assetId: 'new' });
    expect(notify.success).toHaveBeenCalled();
  });
  it('refuses names over 255 characters', async () => {
    await modal['onFilePicked'](new File(['png'], `${'a'.repeat(256)}.png`, { type: 'image/png' }));
    await modal['submit']();
    expect(modal['file']()).toBeNull();
    expect(modal['fileError']()).toContain('255');
    http.expectNone(base);
  });
  it('upload invalid 400 is a field message', async () => {
    await sendFailure(400, 'CORE.TEMPLATE.ASSET.UPLOAD_INVALID');
    expect(modal['fileError']()).toBe(assetEn.errors['CORE.TEMPLATE.ASSET.UPLOAD_INVALID']);
    expect(fixture.nativeElement.textContent).toContain(modal['fileError']());
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('a 403 shows a toast', async () => {
    await sendFailure(403, 'MISSING_REQUIRED_PERMISSIONS');
    expect(notify.error).toHaveBeenCalled();
    expect(modal['fileError']()).toBeNull();
  });
  it('definition not found is a field message', async () => {
    fixture.componentRef.setInput('templates', [{ templateId: 'definition', name: 'Definition', code: 'DEF',
      definitionScope: { type: 'TENANT' } } as TemplateListRow]);
    modal['draft'].update((v) => ({ ...v, scope: 'DEFINITION', definitionId: 'definition' }));
    fixture.detectChanges();
    await sendFailure(404, 'NOT_FOUND');
    expect(modal['templateError']()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain(modal['templateError']());
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('in flight keeps the key', async () => {
    const first = await sendFailure(409, 'CORE.TEMPLATE.IDEMPOTENCY.IN_FLIGHT');
    expect(notify.error).toHaveBeenCalledWith('Still uploading');
    const second = await sendFailure(503, 'CORE.TEMPLATE.ASSET.STORAGE_UNAVAILABLE');
    expect(second.request.headers.get('x-idempotency-key')).toBe(first.request.headers.get('x-idempotency-key'));
  });
  it('422 codes land under the file', async () => {
    for (const suffix of ['UPLOAD_INVALID', 'CHECKSUM_MISMATCH', 'INVALID', 'EMAIL_PUBLIC_NOT_ALLOWED']) {
      await sendFailure(422, `CORE.TEMPLATE.ASSET.${suffix}`);
      expect(modal['fileError']()).toBe(assetEn.errors[`CORE.TEMPLATE.ASSET.${suffix}` as keyof typeof assetEn.errors]);
    }
    expect(notify.error).not.toHaveBeenCalled();
  });
  it('storage unavailable toast', async () => {
    await sendFailure(503, 'CORE.TEMPLATE.ASSET.STORAGE_UNAVAILABLE');
    expect(notify.error).toHaveBeenCalledWith('Upload service busy, try again');
  });
  it('a 413 says max 5 MB', async () => {
    await sendFailure(413, 'GW.BODY.TOO_LARGE');
    expect(modal['fileError']()).toBe('Max 5 MB');
  });
  it('a 401 keeps the form', async () => {
    const picked = modal['file']();
    const draft = modal['draft']();
    await sendFailure(401, 'COMMON.GENERIC.UNAUTHORIZED');
    expect(notify.error).toHaveBeenCalledWith('Not saved. Try again.');
    expect(modal['file']()).toBe(picked);
    expect(modal['draft']()).toEqual(draft);
    expect(modal['modal']()['isOpen']).toBe(true);
  });
  it('retry reuses the fingerprint key', async () => {
    const firstPending = modal['submit'](); await Promise.resolve();
    const first = http.expectOne(base);
    first.error(new ProgressEvent('network'), { status: 0, statusText: 'Network' });
    await firstPending;
    const second = await sendFailure(503, 'CORE.TEMPLATE.ASSET.STORAGE_UNAVAILABLE');
    expect(first.request.headers.get('x-idempotency-key')).toMatch(uuid);
    expect(second.request.headers.get('x-idempotency-key')).toBe(first.request.headers.get('x-idempotency-key'));
    expect((second.request.body as FormData).get('metadata')).toBe((first.request.body as FormData).get('metadata'));
    expect(await ((second.request.body as FormData).get('file') as File).text()).toBe(await ((first.request.body as FormData).get('file') as File).text());
    modal['draft'].update((v) => ({ ...v, assetType: 'BACKGROUND' }));
    const changed = await sendFailure(503, 'CORE.TEMPLATE.ASSET.STORAGE_UNAVAILABLE');
    expect(changed.request.headers.get('x-idempotency-key')).not.toBe(first.request.headers.get('x-idempotency-key'));
    expect((changed.request.body as FormData).get('metadata')).not.toBe((first.request.body as FormData).get('metadata'));
  });
  it('a validation rejection starts a new key on the next attempt', async () => {
    const first = await sendFailure(422, 'CORE.TEMPLATE.ASSET.UPLOAD_INVALID');
    const second = await sendFailure(422, 'CORE.TEMPLATE.ASSET.UPLOAD_INVALID');
    expect(second.request.headers.get('x-idempotency-key')).not.toBe(first.request.headers.get('x-idempotency-key'));
  });
});
