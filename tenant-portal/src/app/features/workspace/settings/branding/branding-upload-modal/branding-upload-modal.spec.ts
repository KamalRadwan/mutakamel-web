import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import en from '../../../../../../../public/i18n/ws-branding/en.json';
import ar from '../../../../../../../public/i18n/ws-branding/ar.json';
import { ApiError, errorMessage } from '../../../../../core/api/api-errors';
import { Notify } from '../../../../../core/notify/notify';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { BrandingApi } from '../branding.api';
import { BRANDING_ASSET_LIMITS, EMPTY_BRANDING } from '../branding.model';
import { BrandingUploadModal } from './branding-upload-modal';

class Loader {
  getTranslation() {
    return of({});
  }
}
const file = (name = 'logo.png', bytes = 16) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/png' });

describe('BrandingUploadModal', () => {
  let fixture: ComponentFixture<BrandingUploadModal>;
  let modal: BrandingUploadModal;
  const api = {
    uploadBrandingLogo: vi.fn(async (_file: File, _key: string) => ({
      ...EMPTY_BRANDING,
      hasLogo: true,
      logoUrl: '/logo?v=2',
    })),
    uploadBrandingIcon: vi.fn(async (_file: File, _key: string) => ({ ...EMPTY_BRANDING })),
  };
  const notify = { error: vi.fn(), success: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(Modal.prototype, 'open').mockImplementation(() => undefined);
    vi.spyOn(Modal.prototype, 'close').mockImplementation(() => undefined);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 200, height: 100, close() {} })),
    );
    vi.stubGlobal(
      'URL',
      class extends URL {
        static override createObjectURL() {
          return 'blob:preview';
        }
        static override revokeObjectURL() {}
      },
    );
    api.uploadBrandingLogo.mockResolvedValue({
      ...EMPTY_BRANDING,
      hasLogo: true,
      logoUrl: '/logo?v=2',
    });
    api.uploadBrandingIcon.mockResolvedValue({ ...EMPTY_BRANDING });
    TestBed.configureTestingModule({
      providers: [
        { provide: BrandingApi, useValue: api },
        { provide: Notify, useValue: notify },
        provideTransloco({
          config: {
            availableLangs: ['en', 'ar'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            prodMode: true,
            missingHandler: { logMissingKey: false },
          },
          loader: Loader,
        }),
      ],
    });
    const t = TestBed.inject(TranslocoService);
    t.setTranslation({ ...globalEn, wsBranding: en }, 'en');
    t.setTranslation({ ...globalEn, wsBranding: ar }, 'ar');
    fixture = TestBed.createComponent(BrandingUploadModal);
    modal = fixture.componentInstance;
    fixture.componentRef.setInput('canManage', true);
    await render();
    modal.open('logo', null);
  });
  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function choose(image = file()) {
    modal['onFilePicked'](image);
    await render();
  }

  it('same file reuses its key', async () => {
    await choose();
    api.uploadBrandingLogo.mockRejectedValueOnce(new ApiError(503, 'BRANDING_STORAGE_UNAVAILABLE'));
    await modal['confirmUpload']();
    await modal['confirmUpload']();
    expect(api.uploadBrandingLogo.mock.calls[0][1]).toBe(api.uploadBrandingLogo.mock.calls[1][1]);
  });

  it('another file gets a new key', async () => {
    await choose();
    api.uploadBrandingLogo.mockRejectedValueOnce(new ApiError(503, 'BRANDING_STORAGE_UNAVAILABLE'));
    await modal['confirmUpload']();
    const firstKey = api.uploadBrandingLogo.mock.calls[0][1];
    await choose(file('other.png'));
    await modal['confirmUpload']();
    expect(api.uploadBrandingLogo.mock.calls[1][1]).not.toBe(firstKey);
  });

  it('idempotency conflict text', async () => {
    await choose();
    api.uploadBrandingLogo.mockRejectedValueOnce(
      new ApiError(409, 'BRANDING_IDEMPOTENCY_CONFLICT'),
    );
    await modal['confirmUpload']();
    expect(notify.error).toHaveBeenLastCalledWith(en.errors.BRANDING_IDEMPOTENCY_CONFLICT);
    const firstKey = api.uploadBrandingLogo.mock.calls[0][1];
    await modal['confirmUpload']();
    expect(api.uploadBrandingLogo.mock.calls[1][1]).not.toBe(firstKey);
  });

  it('413 is a field message', async () => {
    await choose();
    for (const code of ['BRANDING_FILE_TOO_LARGE', 'GW.BODY.TOO_LARGE']) {
      const error = new ApiError(413, code);
      api.uploadBrandingLogo.mockRejectedValueOnce(error);
      await modal['confirmUpload']();
      await render();
      expect(fixture.nativeElement.querySelector('ui-field').textContent).toContain(
        errorMessage(error, 'wsBranding', TestBed.inject(TranslocoService)),
      );
      expect(notify.error).not.toHaveBeenCalled();
      const describedBy = fixture.nativeElement
        .querySelector('ui-file-drop button')
        .getAttribute('aria-describedby');
      expect(describedBy).toContain('-file-error');
    }
  });

  it('type and invalid file messages', async () => {
    await choose();
    for (const [status, code] of [
      [415, 'BRANDING_FILE_TYPE_UNSUPPORTED'],
      [400, 'BRANDING_FILE_INVALID'],
    ] as const) {
      api.uploadBrandingLogo.mockRejectedValueOnce(new ApiError(status, code));
      await modal['confirmUpload']();
      await render();
      expect(fixture.nativeElement.querySelector('ui-field').textContent).toContain(
        en.errors[code],
      );
      expect(notify.error).not.toHaveBeenCalled();
    }
    TestBed.inject(TranslocoService).setActiveLang('ar');
    await render();
    expect(fixture.nativeElement.querySelector('ui-field').textContent).toContain(
      ar.errors.BRANDING_FILE_INVALID,
    );
  });

  it('icon size is checked before upload', async () => {
    modal.open('icon', null);
    await choose(file('icon.png', BRANDING_ASSET_LIMITS.icon.maxBytes + 1));
    await modal['confirmUpload']();
    expect(api.uploadBrandingIcon).not.toHaveBeenCalled();
    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(en.upload.errors.iconTooLarge);
  });

  it('storage unavailable toast', async () => {
    await choose();
    api.uploadBrandingLogo.mockRejectedValueOnce(new ApiError(503, 'BRANDING_STORAGE_UNAVAILABLE'));
    await modal['confirmUpload']();
    expect(notify.error).toHaveBeenLastCalledWith(en.errors.BRANDING_STORAGE_UNAVAILABLE);
    expect(modal['activeError']()).toBeNull();
    expect(modal['selectedFile']()).not.toBeNull();
  });

  it('successful upload emits the full result for the page to merge', async () => {
    await choose();
    const saved = vi.fn();
    modal.saved.subscribe(saved);
    await modal['confirmUpload']();
    expect(saved).toHaveBeenCalledWith({
      kind: 'logo',
      branding: { ...EMPTY_BRANDING, hasLogo: true, logoUrl: '/logo?v=2' },
    });
    expect(notify.success).toHaveBeenCalledWith(en.upload.success);
    expect(Modal.prototype.close).toHaveBeenCalled();
  });

  it('401 preserves the selected file and key', async () => {
    const image = file();
    await choose(image);
    api.uploadBrandingLogo.mockRejectedValueOnce(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'));
    await modal['confirmUpload']();
    expect(notify.error).toHaveBeenLastCalledWith(en.notSaved);
    expect(modal['selectedFile']()).toBe(image);
    await modal['confirmUpload']();
    expect(api.uploadBrandingLogo.mock.calls[1][1]).toBe(api.uploadBrandingLogo.mock.calls[0][1]);
  });

  it('tenant-wide rejection tells the page to become read-only', async () => {
    await choose();
    const rejected = vi.fn();
    modal.tenantWideRequired.subscribe(rejected);
    api.uploadBrandingLogo.mockRejectedValueOnce(
      new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED'),
    );
    await modal['confirmUpload']();
    expect(rejected).toHaveBeenCalledOnce();
    expect(Modal.prototype.close).toHaveBeenCalled();
    fixture.componentRef.setInput('canManage', false);
    await modal['confirmUpload']();
    expect(api.uploadBrandingLogo).toHaveBeenCalledOnce();
  });

  it('client rejects an empty file, unsupported type and excessive dimensions', async () => {
    await choose(file('empty.png', 0));
    expect(modal['activeError']()).toBe(en.upload.errors.fileRequired);
    await choose(new File(['svg'], 'logo.svg', { type: 'image/svg+xml' }));
    expect(modal['activeError']()).toBe(en.upload.errors.typeUnsupported);
    vi.mocked(createImageBitmap).mockResolvedValueOnce({
      width: 5000,
      height: 100,
      close() {},
    } as ImageBitmap);
    await choose();
    expect(modal['activeError']()).toBe(en.upload.errors.dimensionsLogo);
    await modal['confirmUpload']();
    expect(api.uploadBrandingLogo).not.toHaveBeenCalled();
  });
});
