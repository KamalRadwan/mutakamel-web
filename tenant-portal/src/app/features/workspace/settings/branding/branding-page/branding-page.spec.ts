import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../public/i18n/en.json';
import en from '../../../../../../../public/i18n/ws-branding/en.json';
import ar from '../../../../../../../public/i18n/ws-branding/ar.json';
import { ApiError, errorMessage } from '../../../../../core/api/api-errors';
import { AuthSession } from '../../../../../core/auth/auth-session';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { Notify } from '../../../../../core/notify/notify';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { BrandingApi } from '../branding.api';
import { BrandingUploadModal } from '../branding-upload-modal/branding-upload-modal';
import { brandingAccess, EMPTY_BRANDING, type UpdateBrandingBody } from '../branding.model';
import { BrandingPage } from './branding-page';

class Loader {
  getTranslation() {
    return of({});
  }
}
function user(owner = false, tenantWide = true): TenantMe {
  return {
    id: 'actor',
    email: 'owner@example.test',
    firstName: 'Test',
    lastName: 'User',
    hasAvatar: false,
    workspace: { timezone: 'UTC', defaultLanguage: 'en' },
    isTenantOwner: owner,
    mfaEnabled: false,
    mfaUpdatedAt: null,
    status: 'ACTIVE',
    accessibleBranches: [],
    accessibleCompanies: [],
    accessibleBranchCompanies: [],
    permissions: ['branding.read', 'branding.manage'],
    seats: [],
    teamMemberships: [],
    featureEntitlements: {},
    permissionScopes: { 'branding.manage': { tenantWide, companyIds: [], branchIds: [] } },
    accessScope: {
      mode: 'FULL',
      branchesTruncated: false,
      companiesTruncated: false,
      teamMembershipsTruncated: false,
      teamMembershipsTotal: 0,
    },
  };
}
const branding = {
  ...EMPTY_BRANDING,
  id: 'brand',
  appName: 'Delta',
  tabTitle: 'Home',
  primaryColor: '#123456',
};

describe('BrandingPage', () => {
  let fixture: ComponentFixture<BrandingPage>;
  let page: BrandingPage;
  let host: HTMLElement;
  const me = signal<TenantMe | null>(user());
  const api = {
    getBranding: vi.fn(async () => ({ ...branding })),
    updateBranding: vi.fn(async (body: UpdateBrandingBody, _key: string) => ({
      ...branding,
      ...body,
    })),
  };
  const notify = {
    success: vi.fn(),
    error: vi.fn(),
    connectionLost: vi.fn(),
    connectionRestored: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    me.set(user());
    api.getBranding.mockResolvedValue({ ...branding });
    api.updateBranding.mockImplementation(async (body) => ({ ...branding, ...body }));
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { me } },
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
    fixture = TestBed.createComponent(BrandingPage);
    page = fixture.componentInstance;
    host = fixture.nativeElement;
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
  function input(suffix: string, value: string) {
    const field = host.querySelector<HTMLInputElement>(`input[id$="-${suffix}"]`)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }
  async function failSave(error: ApiError) {
    await render();
    input('app-name', 'New draft');
    api.updateBranding.mockRejectedValueOnce(error);
    await page['save']();
    await render();
  }

  it('403 shows forbidden', async () => {
    api.getBranding.mockRejectedValueOnce(new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS'));
    await render();
    expect(host.textContent).toContain(en.errors.MISSING_REQUIRED_PERMISSIONS);
    expect(host.querySelector('form')).toBeNull();
    expect(host.textContent).not.toContain(en.loadFailed);
  });

  it('5xx and offline show load-failure', async () => {
    api.getBranding.mockRejectedValueOnce(new ApiError(503, 'BRANDING_STATE_UNAVAILABLE'));
    await render();
    expect(host.textContent).toContain(en.loadFailed);
    expect(host.textContent).toContain(en.actions.retry);
    api.getBranding.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
    await page['reload']();
    await render();
    expect(host.textContent).toContain(en.loadFailed);
    expect(notify.connectionLost).toHaveBeenCalledOnce();
    await page['reload']();
    await render();
    expect(host.querySelector('form')).not.toBeNull();
    expect(notify.connectionRestored).toHaveBeenCalled();
  });

  it('scoped holder sees read-only', async () => {
    me.set(user(false, false));
    await render();
    expect(host.textContent).toContain(en.needsTenantWide);
    expect(host.querySelector('button[type="submit"]')).toBeNull();
    expect(host.querySelector('app-branding-asset-card button')).toBeNull();
    expect(
      [...host.querySelectorAll<HTMLInputElement>('form input')].every((field) => field.readOnly),
    ).toBe(true);
    await page['save']();
    expect(api.updateBranding).not.toHaveBeenCalled();
  });

  it('uses the owner or tenant-wide grant helper and requires read permission', async () => {
    expect(brandingAccess(null)).toEqual({ readable: false, editable: false });
    expect(brandingAccess(user(true, false)).editable).toBe(true);
    const actor = user();
    actor.permissions = [];
    expect(brandingAccess(actor)).toEqual({ readable: false, editable: false });
    me.set(actor);
    await render();
    expect(api.getBranding).not.toHaveBeenCalled();
    expect(host.textContent).toContain(en.errors.MISSING_REQUIRED_PERMISSIONS);
  });

  it('save succeeds', async () => {
    await render();
    input('app-name', 'New name');
    await page['save']();
    await render();
    expect(api.updateBranding).toHaveBeenCalledWith({ appName: 'New name' }, expect.any(String));
    expect(notify.success).toHaveBeenCalledWith(en.saved);
    expect(page['dirty']()).toBe(false);
  });

  it('validation errors map to fields', async () => {
    await failSave(
      new ApiError(400, 'CORE_VALIDATION_FAILED', {
        appName: ['Name invalid'],
        tabTitle: ['Title invalid'],
        primaryColor: ['Primary invalid'],
        secondaryColor: ['Secondary invalid'],
      }),
    );
    for (const text of ['Name invalid', 'Title invalid', 'Primary invalid', 'Secondary invalid']) {
      expect(host.textContent).toContain(text);
    }
    expect(notify.error).not.toHaveBeenCalled();
    input('app-name', 'Fixed');
    await render();
    expect(host.textContent).not.toContain('Name invalid');
  });

  it('tenant-wide 403 turns the page read-only', async () => {
    await failSave(new ApiError(403, 'TENANT_WIDE_PERMISSION_REQUIRED'));
    expect(host.textContent).toContain(en.needsTenantWide);
    expect(host.querySelector('button[type="submit"]')).toBeNull();
    expect(host.querySelector('app-branding-asset-card button')).toBeNull();
    expect(page['draft']().appName).toBe('New draft');
    expect(notify.error).toHaveBeenCalledWith(en.errors.TENANT_WIDE_PERMISSION_REQUIRED);
  });

  it('idempotency codes use the core mapper', async () => {
    await render();
    input('app-name', 'New draft');
    const t = TestBed.inject(TranslocoService);
    for (const [status, code] of [
      [409, 'GW.IDEM.IN_FLIGHT'],
      [422, 'GW.IDEM.MISMATCH'],
    ] as const) {
      const error = new ApiError(status, code);
      api.updateBranding.mockRejectedValueOnce(error);
      await page['save']();
      expect(notify.error).toHaveBeenLastCalledWith(errorMessage(error, 'wsBranding', t));
    }
    expect(api.updateBranding.mock.calls[1][1]).toBe(api.updateBranding.mock.calls[0][1]);
  });

  it('401 keeps the draft', async () => {
    await failSave(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'));
    expect(page['draft']().appName).toBe('New draft');
    expect(notify.error).toHaveBeenLastCalledWith(en.notSaved);
    const key = api.updateBranding.mock.calls[0][1];
    await page['save']();
    expect(api.updateBranding.mock.calls[1][1]).toBe(key);
    expect(host.querySelector('form')).not.toBeNull();
  });

  it('changed body gets a new PUT key and emptied fields send null', async () => {
    await failSave(new ApiError(503, 'BRANDING_STATE_UNAVAILABLE'));
    const firstKey = api.updateBranding.mock.calls[0][1];
    input('app-name', '');
    input('tab-title', '');
    input('primary', '');
    await page['save']();
    expect(api.updateBranding).toHaveBeenLastCalledWith(
      { appName: null, tabTitle: null, primaryColor: null },
      expect.any(String),
    );
    expect(api.updateBranding.mock.calls[1][1]).not.toBe(firstKey);
  });

  it('429 shows the rate text', async () => {
    const error = new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['17'] });
    await failSave(error);
    const text = errorMessage(error, 'wsBranding', TestBed.inject(TranslocoService));
    expect(notify.error).toHaveBeenLastCalledWith(text);
    expect(text).toContain('17');
  });

  it('invalid colour drafts remain dirty and reload asks before discarding them', async () => {
    await render();
    input('secondary', 'red');
    expect(page['dirty']()).toBe(true);
    await page['save']();
    await render();
    expect(api.updateBranding).not.toHaveBeenCalled();
    expect(host.textContent).toContain(en.validation.colourInvalid);
    vi.spyOn(ConfirmDialog.prototype, 'open').mockResolvedValueOnce(false);
    await page['reload']();
    expect(ConfirmDialog.prototype.open).toHaveBeenCalledOnce();
    expect(api.getBranding).toHaveBeenCalledOnce();
    expect(page['draft']().secondaryColor).toBe('red');
  });

  it('upload and removal merge asset fields without replacing the draft', async () => {
    await render();
    input('app-name', 'Unsaved name');
    input('primary', 'ff0000');
    const upload = fixture.debugElement.query(By.directive(BrandingUploadModal))
      .componentInstance as BrandingUploadModal;
    upload.saved.emit({
      kind: 'logo',
      branding: { ...EMPTY_BRANDING, appName: 'Server name', hasLogo: true, logoUrl: '/logo?v=2' },
    });
    await render();
    expect(page['baseline']()?.appName).toBe('Delta');
    expect(page['draft']()).toMatchObject({ appName: 'Unsaved name', primaryColor: '#FF0000' });
    expect(
      host.querySelector<HTMLImageElement>('app-branding-asset-card img')?.getAttribute('src'),
    ).toBe('/logo?v=2');
    page['onAssetRemoved']('logo');
    await render();
    expect(host.querySelector('app-branding-asset-card img')).toBeNull();
    expect(page['draft']().appName).toBe('Unsaved name');
    await page['save']();
    expect(api.updateBranding).toHaveBeenLastCalledWith(
      { appName: 'Unsaved name', primaryColor: '#ff0000' },
      expect.any(String),
    );
  });

  it('all editable field labels retain translated hints in English and Arabic', async () => {
    await render();
    for (const lang of ['en', 'ar']) {
      TestBed.inject(TranslocoService).setActiveLang(lang);
      await render();
      const fields = host.querySelectorAll('form ui-field');
      expect(fields).toHaveLength(4);
      for (const field of fields) {
        expect(field.querySelector('[data-ui-hint]')).not.toBeNull();
        expect(field.querySelector('input')?.getAttribute('aria-describedby')).toContain('-hint');
        expect(field.textContent).not.toContain('wsBranding.');
      }
    }
  });
});
