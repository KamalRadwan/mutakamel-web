import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import en from '../../../../../../../public/i18n/ws-branding/en.json';
import { ApiError } from '../../../../../core/api/api-errors';
import { Notify } from '../../../../../core/notify/notify';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { BrandingApi } from '../branding.api';
import { EMPTY_BRANDING } from '../branding.model';
import { BrandingAssetCard } from './branding-asset-card';

class Loader {
  getTranslation() {
    return of({});
  }
}
describe('BrandingAssetCard', () => {
  let fixture: ComponentFixture<BrandingAssetCard>;
  let card: BrandingAssetCard;
  let confirm: MockInstance<ConfirmDialog['open']>;
  const api = {
    removeBrandingLogo: vi.fn(async (_key: string) => undefined),
    removeBrandingIcon: vi.fn(async (_key: string) => undefined),
    getBranding: vi.fn(async () => ({ ...EMPTY_BRANDING, hasLogo: true, logoUrl: '/logo?v=2' })),
  };
  const notify = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    confirm = vi.spyOn(ConfirmDialog.prototype, 'open').mockResolvedValue(true);
    api.removeBrandingLogo.mockResolvedValue(undefined);
    api.removeBrandingIcon.mockResolvedValue(undefined);
    api.getBranding.mockResolvedValue({ ...EMPTY_BRANDING, hasLogo: true, logoUrl: '/logo?v=2' });
    TestBed.configureTestingModule({
      providers: [
        { provide: BrandingApi, useValue: api },
        { provide: Notify, useValue: notify },
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            prodMode: true,
            missingHandler: { logMissingKey: false },
          },
          loader: Loader,
        }),
      ],
    });
    TestBed.inject(TranslocoService).setTranslation({ ...globalEn, wsBranding: en }, 'en');
    fixture = TestBed.createComponent(BrandingAssetCard);
    card = fixture.componentInstance;
    fixture.componentRef.setInput('kind', 'logo');
    fixture.componentRef.setInput('url', '/logo?v=1');
    fixture.componentRef.setInput('hasAsset', true);
    fixture.componentRef.setInput('canManage', true);
    await render();
  });
  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });
  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('remove reuses its key', async () => {
    api.removeBrandingLogo.mockRejectedValueOnce(new ApiError(503, 'BRANDING_STORAGE_UNAVAILABLE'));
    await card['remove']();
    await card['remove']();
    expect(api.removeBrandingLogo.mock.calls[1][0]).toBe(api.removeBrandingLogo.mock.calls[0][0]);
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('remove failure shows a toast', async () => {
    api.removeBrandingLogo.mockRejectedValueOnce(new ApiError(404, 'BRANDING_ASSET_NOT_FOUND'));
    const refreshed = vi.fn();
    card.refreshed.subscribe(refreshed);
    await card['remove']();
    await render();
    expect(notify.error).toHaveBeenCalledWith(en.errors.BRANDING_ASSET_NOT_FOUND);
    expect(api.getBranding).toHaveBeenCalledOnce();
    expect(refreshed).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: '/logo?v=2' }));
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe('/logo?v=2');
  });

  it('broken image falls back to empty', async () => {
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    image.dispatchEvent(new Event('error'));
    await render();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(en.asset.empty);
    fixture.componentRef.setInput('url', '/logo?v=3');
    await render();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe('/logo?v=3');
  });

  it('confirm first, then success clears the asset and shows Removed', async () => {
    let answer: (confirmed: boolean) => void = () => undefined;
    confirm.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    const removed = vi.fn();
    card.removed.subscribe(removed);
    const pending = card['remove']();
    expect(api.removeBrandingLogo).not.toHaveBeenCalled();
    answer(true);
    await pending;
    await render();
    expect(api.removeBrandingLogo).toHaveBeenCalledOnce();
    expect(removed).toHaveBeenCalledOnce();
    expect(notify.success).toHaveBeenCalledWith(en.assets.removed);
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(en.asset.empty);
    expect(card['present']()).toBe(false);
  });

  it('cancelled confirmation sends nothing', async () => {
    confirm.mockResolvedValueOnce(false);
    await card['remove']();
    expect(api.removeBrandingLogo).not.toHaveBeenCalled();
    expect(card['removing']()).toBe(false);
  });

  it('icon removal uses its route and read-only blocks removal', async () => {
    fixture.componentRef.setInput('kind', 'icon');
    await card['remove']();
    expect(api.removeBrandingIcon).toHaveBeenCalledOnce();
    expect(api.removeBrandingLogo).not.toHaveBeenCalled();
    fixture.componentRef.setInput('canManage', false);
    await render();
    await card['remove']();
    expect(api.removeBrandingIcon).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('button:not(dialog button)')).toBeNull();
  });

  it('tenant-wide rejection switches the parent to read-only', async () => {
    const rejected = vi.fn();
    card.tenantWideRequired.subscribe(rejected);
    api.removeBrandingLogo.mockRejectedValueOnce(
      new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED'),
    );
    await card['remove']();
    expect(rejected).toHaveBeenCalledOnce();
    expect(notify.error).toHaveBeenCalledWith(en.errors.TENANT_WIDE_PERMISSION_REQUIRED);
  });
});
