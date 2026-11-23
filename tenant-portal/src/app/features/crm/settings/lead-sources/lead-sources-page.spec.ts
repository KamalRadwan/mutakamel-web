import { Injectable, signal, type Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco, type Translation } from '@jsverse/transloco';
import { defer, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../public/i18n/ar.json';
import en from '../../../../../../public/i18n/en.json';
import arSettings from '../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../public/i18n/settings/en.json';
import arSources from '../../../../../../public/i18n/settings-lead-sources/ar.json';
import enSources from '../../../../../../public/i18n/settings-lead-sources/en.json';
import { ApiError } from '../../../../core/api/api-errors';
import { FAKE_TENANT_ME } from '../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { LeadSourceModal } from './lead-source-modal/lead-source-modal';
import { LeadSourcesPage } from './lead-sources-page';
import type { LeadSource } from './lead-sources.model';

const rows: LeadSource[] = [1, 2, 3].map((n) => ({ id: `0192b8ea-7c4f-7a7d-9c9f-51c7f2b3000${n}`,
  nameAr: `مصدر ${n}`, nameEn: `Source ${n}`, isActive: true, sortOrder: n,
  iconUrl: `/api/tenant/crm/v1/acquisition-sources/${n}/icon?v=1234567890abcdef`,
  createdAt: '2026-11-18T00:00:00Z', updatedAt: '2026-11-18T00:00:00Z' }));
const readKey = 'crm.acquisition_sources.read';
const manageKey = 'crm.acquisition_sources.manage';
const translations: Record<string, Translation> = {
  en: { ...en, settings: enSettings, leadSources: enSources },
  ar: { ...ar, settings: arSettings, leadSources: arSources },
  'settings/en': enSettings, 'settings/ar': arSettings,
  'settings-lead-sources/en': enSources, 'settings-lead-sources/ar': arSources,
};
@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string) { return defer(() => Promise.resolve(translations[path] ?? {})); }
}
const response = (data: unknown) => ({ data, status: 200, etag: null, location: null });
const iconFile = (bytes = 'image') => new File([bytes], 'icon.png', { type: 'image/png' });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

for (const lang of ['en', 'ar'] as const) for (const theme of ['light', 'dark'] as const) {
  describe(`${lang} ${theme}`, () => {
    const me = signal<TenantMe | null>(null);
    let stub: CrmHttpStub;
    let dispose: () => void;
    let fixtures: Record<string, unknown>;
    let previousTheme: string | null;
    let previousDir: string;
    const dialog = HTMLDialogElement.prototype;
    const originalDialog = { showModal: dialog.showModal, close: dialog.close };

    beforeEach(() => {
      globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;
      dialog.showModal = function () { this.open = true; };
      dialog.close = function () {
        if (!this.open) return;
        this.open = false;
        queueMicrotask(() => this.dispatchEvent(new Event('close')));
      };
      previousTheme = document.documentElement.getAttribute('data-theme');
      previousDir = document.documentElement.dir;
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      me.set({ ...FAKE_TENANT_ME, isTenantOwner: false, permissions: [readKey, manageKey], permissionScopes: {
        [readKey]: { tenantWide: true, companyIds: [], branchIds: [] },
        [manageKey]: { tenantWide: true, companyIds: [], branchIds: [] },
      } });
      fixtures = { '/acquisition-sources': structuredClone(rows) };
      stub = new CrmHttpStub(fixtures);
      dispose = bindCrmHttpForTest(stub);
      TestBed.configureTestingModule({ providers: [provideRouter([]),
        provideTransloco({ config: { availableLangs: ['en', 'ar'], defaultLang: lang, reRenderOnLangChange: true, prodMode: false }, loader: Loader }),
        { provide: TenantScopeState, useValue: { me } },
        { provide: LanguageState, useValue: { current: signal(lang) } },
      ] });
    });

    afterEach(() => {
      TestBed.resetTestingModule();
      dispose();
      vi.restoreAllMocks();
      if (originalDialog.showModal) dialog.showModal = originalDialog.showModal;
      else Reflect.deleteProperty(dialog, 'showModal');
      if (originalDialog.close) dialog.close = originalDialog.close;
      else Reflect.deleteProperty(dialog, 'close');
      if (previousTheme) document.documentElement.setAttribute('data-theme', previousTheme);
      else document.documentElement.removeAttribute('data-theme');
      document.documentElement.dir = previousDir;
    });

    async function render<T>(type: Type<T>): Promise<ComponentFixture<T>> {
      await firstValueFrom(TestBed.inject(TranslocoService).load(lang));
      const fixture = TestBed.createComponent(type);
      if (fixture.componentInstance instanceof LeadSourceModal) fixture.componentRef.setInput('canManage', true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    async function settle<T>(fixture: ComponentFixture<T>): Promise<void> {
      await fixture.whenStable();
      fixture.detectChanges();
    }

    function text(key: string): string { return TestBed.inject(TranslocoService).translate(key); }

    describe('LeadSourcesPage', () => {
      it('loads and shows empty', async () => {
        fixtures['/acquisition-sources'] = [];
        const fixture = await render(LeadSourcesPage);
        expect(fixture.componentInstance['sources']()).toEqual([]);
        expect(fixture.nativeElement.textContent).toContain(text('leadSources.empty'));
        expect(fixture.nativeElement.textContent).toContain(text('leadSources.new'));
        fixtures['/acquisition-sources'] = rows;
        fixture.componentInstance['reload']();
        await settle(fixture);
        expect(fixture.componentInstance['sources']()).toEqual(rows);
        expect(fixture.nativeElement.textContent).toContain('Source 1');
      });

      it('branch read grant opens the page', async () => {
        me.set({ ...me()!, permissions: [readKey], permissionScopes: {
          [readKey]: { tenantWide: false, companyIds: [], branchIds: ['branch-one'] },
        } });
        const read = vi.spyOn(stub, 'read');
        const fixture = await render(LeadSourcesPage);
        expect(read).toHaveBeenCalledWith('/acquisition-sources');
        expect(fixture.componentInstance['sources']()).toEqual(rows);
        expect(fixture.nativeElement.querySelector('ui-full-state')).toBeNull();
      });

      it('branch manage grant stays read-only', async () => {
        me.update((current) => ({ ...current!, permissionScopes: { ...current!.permissionScopes,
          [manageKey]: { tenantWide: false, companyIds: [], branchIds: ['branch-one'] },
        } }));
        const fixture = await render(LeadSourcesPage);
        const page = fixture.componentInstance;
        expect(page['canManage']()).toBe(false);
        expect(page['gridColumnsClass']()).toBe('grid-cols-crm-lead-source-row');
        page['openEdit'](rows[0]);
        await settle(fixture);
        expect(fixture.nativeElement.querySelector('input[id$="-name-ar"]').readOnly).toBe(true);
        expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeNull();
        await page['dropOnRow'](rows[0].id, rows[1].id);
        expect(stub.recordedWrites()).toEqual([]);
      });

      it('reorder adopts the server list', async () => {
        const server = [{ ...rows[1], sortOrder: 1, nameEn: 'Renamed on server' }, { ...rows[0], sortOrder: 2 }, rows[2]];
        const write = vi.spyOn(stub, 'write').mockResolvedValueOnce(response(server));
        const fixture = await render(LeadSourcesPage);
        await fixture.componentInstance['dropOnRow'](rows[0].id, rows[1].id);
        await settle(fixture);
        expect(fixture.componentInstance['sources']()).toEqual(server);
        expect(write.mock.calls[0][3].key).toMatch(uuid);
      });

      it('reorder invalid reloads', async () => {
        const fixture = await render(LeadSourcesPage);
        const read = vi.spyOn(stub, 'read');
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(422, 'CRM_ACQUISITION_SOURCE_REORDER_INVALID'));
        fixtures['/acquisition-sources'] = [{ ...rows[0], nameEn: 'Fresh list' }];
        await fixture.componentInstance['dropOnRow'](rows[0].id, rows[1].id);
        expect(write).toHaveBeenCalledTimes(1);
        await settle(fixture);
        expect(read).toHaveBeenCalled();
        expect(fixture.componentInstance['sources']()[0].nameEn).toBe('Fresh list');
        expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(text('leadSources.errors.CRM_ACQUISITION_SOURCE_REORDER_INVALID'));
      });

      it.each([0, 503, 409])('rolls back and reuses reorder key after %s, changing it for a changed order', async (status) => {
        const fixture = await render(LeadSourcesPage);
        const write = vi.spyOn(stub, 'write').mockRejectedValue(new ApiError(status, status === 409 ? 'GW.IDEM.IN_FLIGHT' : 'NETWORK_ERROR'));
        const page = fixture.componentInstance;
        await page['dropOnRow'](rows[0].id, rows[1].id);
        expect(page['sources']()).toEqual(rows);
        await page['dropOnRow'](rows[0].id, rows[1].id);
        expect(write.mock.calls[1][3].key).toBe(write.mock.calls[0][3].key);
        expect(write.mock.calls[1][2]).toEqual(write.mock.calls[0][2]);
        await page['dropOnRow'](rows[0].id, rows[2].id);
        expect(write.mock.calls[2][3].key).not.toBe(write.mock.calls[0][3].key);
      });

      it('in use offers make inactive', async () => {
        const fixture = await render(LeadSourcesPage);
        const page = fixture.componentInstance;
        vi.spyOn(page['deleteConfirm'](), 'open').mockResolvedValueOnce(true);
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_ACQUISITION_SOURCE_IN_USE'));
        await page['requestDelete'](rows[0]);
        await settle(fixture);
        expect(page['inUseSource']()).toEqual(rows[0]);
        expect(fixture.nativeElement.textContent).toContain(text('leadSources.inUse.makeInactive'));
        write.mockResolvedValueOnce(response({ ...rows[0], isActive: false }));
        await page['makeInUseInactive']();
        expect(write.mock.calls[1].slice(0, 3)).toEqual(['PATCH', `/acquisition-sources/${rows[0].id}`, { isActive: false }]);
        expect(page['sources']()[0].isActive).toBe(false);
      });

      it.each([['CRM_SUBSCRIPTION_READ_ONLY'], ['SEAT_OVER_CAPACITY_READ_ONLY']])('switches page and open fields to read-only for %s', async (code) => {
        const fixture = await render(LeadSourcesPage);
        const page = fixture.componentInstance;
        page['openEdit'](rows[0]);
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(403, code));
        await page['onAction'](rows[0], { id: 'toggleActive' });
        await settle(fixture);
        expect(page['canManage']()).toBe(false);
        expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeNull();
        expect(fixture.nativeElement.querySelector('input[id$="-name-ar"]').readOnly).toBe(true);
      });

      it.each([403, 503, 0])('renders the full load state for %s with the correlation reference', async (status) => {
        vi.spyOn(stub, 'read').mockRejectedValueOnce(new ApiError(status, status === 403 ? 'CRM_MODULE_DISABLED' : 'NETWORK_ERROR', undefined, { correlationId: 'source-load-ref' }));
        const fixture = await render(LeadSourcesPage);
        expect(fixture.componentInstance['loadError']()?.kind).toBe(status === 403 ? 'forbidden' : 'load-failure');
        expect(fixture.nativeElement.querySelector('ui-full-state')?.textContent).toContain('source-load-ref');
        expect(fixture.nativeElement.querySelector('[role="table"]')).toBeNull();
      });

      it('makes no read without a read grant, even with manage', async () => {
        me.update((current) => ({ ...current!, permissions: [manageKey] }));
        const read = vi.spyOn(stub, 'read');
        const fixture = await render(LeadSourcesPage);
        expect(read).not.toHaveBeenCalled();
        expect(fixture.componentInstance['loadError']()?.kind).toBe('forbidden');
      });

      it('uses the authenticated icon URL and falls back to the default glyph', async () => {
        const fixture = await render(LeadSourcesPage);
        const image = fixture.nativeElement.querySelector('[role="table"] img') as HTMLImageElement;
        expect(image.getAttribute('src')).toBe(rows[0].iconUrl);
        image.dispatchEvent(new Event('error'));
        await settle(fixture);
        expect(fixture.nativeElement.querySelector('[role="table"] [role="row"]:nth-child(2) img')).toBeNull();
      });

      it('replaces the table row after the modal uploads an icon', async () => {
        const fixture = await render(LeadSourcesPage);
        const updated = { ...rows[0], iconUrl: `${rows[0].iconUrl}-replaced` };
        vi.spyOn(stub, 'writeMultipart').mockResolvedValueOnce(response(updated));
        fixture.componentInstance['openEdit'](rows[0]);
        await settle(fixture);
        await fixture.componentInstance['sourceModal']()['onIconPicked'](iconFile());
        await settle(fixture);
        expect(fixture.componentInstance['sources']()[0]).toEqual(updated);
        expect(fixture.nativeElement.querySelector('[role="table"] img').getAttribute('src')).toBe(updated.iconUrl);
      });
    });

    describe('LeadSourceModal', () => {
      async function modal() {
        const fixture = await render(LeadSourceModal);
        fixture.componentInstance.openEdit(rows[0]);
        await settle(fixture);
        return fixture;
      }

      async function save(fixture: ComponentFixture<LeadSourceModal>) {
        fixture.componentInstance['save']();
        await settle(fixture);
      }

      it('name taken on both names', async () => {
        const fixture = await modal();
        const component = fixture.componentInstance;
        component.openCreate();
        component['draft'].set({ nameAr: 'مصدر مكرر', nameEn: 'Taken', isActive: true });
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(409, 'CRM_ACQUISITION_SOURCE_NAME_TAKEN'));
        await save(fixture);
        for (const field of ['nameAr', 'nameEn'] as const) expect(component['errorOf'](field)).toBe(text('leadSources.errors.CRM_ACQUISITION_SOURCE_NAME_TAKEN'));
        expect(fixture.nativeElement.querySelectorAll('ui-field [role="alert"]').length).toBe(2);
        expect(TestBed.inject(Notify).toasts()).toEqual([]);
      });

      it('create switches to edit', async () => {
        const fixture = await render(LeadSourceModal);
        const component = fixture.componentInstance;
        component.openCreate();
        component['draft'].set({ nameAr: 'مصدر جديد', nameEn: ' New source ', isActive: true });
        vi.spyOn(stub, 'write').mockResolvedValueOnce({ ...response({ ...rows[0], iconUrl: null }), status: 201 });
        await save(fixture);
        expect(component['mode']()).toBe('edit');
        expect(fixture.nativeElement.querySelector('ui-file-drop')).not.toBeNull();
      });

      for (const [status, suffix] of [[400, 'REQUIRED'], [400, 'EMPTY'], [413, 'TOO_LARGE'], [415, 'TYPE_UNSUPPORTED'], [415, 'EXTENSION_UNSUPPORTED'], [415, 'CONTENT_INVALID']] as const) {
        it(`icon errors inline: ${status} ${suffix}`, async () => {
          const fixture = await modal();
          const code = `CRM_ACQUISITION_SOURCE_ICON_${suffix}`;
          vi.spyOn(stub, 'writeMultipart').mockRejectedValueOnce(new ApiError(status, code));
          await fixture.componentInstance['onIconPicked'](iconFile());
          await settle(fixture);
          const alert = fixture.nativeElement.querySelector('ui-field [role="alert"]') as HTMLElement;
          expect(alert.textContent).toContain(text(`leadSources.errors.${code}`));
          const browse = fixture.nativeElement.querySelector('ui-file-drop button') as HTMLButtonElement;
          expect(browse.getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
          expect(TestBed.inject(Notify).toasts()).toEqual([]);
        });
      }

      it('upload replaces the row', async () => {
        const fixture = await modal();
        const updated = { ...rows[0], iconUrl: `${rows[0].iconUrl}-new` };
        const emitted = vi.fn();
        fixture.componentInstance.iconUpdated.subscribe(emitted);
        vi.spyOn(stub, 'writeMultipart').mockResolvedValueOnce({ ...response(updated), status: 201 });
        await fixture.componentInstance['onIconPicked'](iconFile());
        await settle(fixture);
        expect(fixture.componentInstance['baseSource']()).toEqual(updated);
        expect(emitted).toHaveBeenCalledWith(updated);
        expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(updated.iconUrl);
      });

      it('keeps the icon key and bytes on retry, including reselecting the same file', async () => {
        const fixture = await modal();
        const write = vi.spyOn(stub, 'writeMultipart').mockRejectedValue(new ApiError(503, 'ENTITLEMENT_UNAVAILABLE'));
        await fixture.componentInstance['onIconPicked'](iconFile('same'));
        await fixture.componentInstance['onIconPicked'](iconFile('same'));
        expect(write.mock.calls[1][2].key).toBe(write.mock.calls[0][2].key);
        expect(write.mock.calls[1][1].get('file')).toBe(write.mock.calls[0][1].get('file'));
        await fixture.componentInstance['onIconPicked'](iconFile('diff'));
        expect(write.mock.calls[2][2].key).not.toBe(write.mock.calls[0][2].key);
      });

      it('shows client icon rejections inline and keeps all field hints connected', async () => {
        const fixture = await modal();
        fixture.componentInstance['onIconRejected']('size');
        await settle(fixture);
        expect(fixture.nativeElement.textContent).toContain(text('leadSources.errors.CRM_ACQUISITION_SOURCE_ICON_TOO_LARGE'));
        for (const field of fixture.nativeElement.querySelectorAll('ui-field') as NodeListOf<HTMLElement>) {
          const hint = field.querySelector('[role="tooltip"]')!;
          const control = field.querySelector('input, [role="switch"], ui-file-drop button')!;
          expect(hint.textContent?.trim()).toBeTruthy();
          expect(control.getAttribute('aria-describedby')?.split(' ')).toContain(hint.id);
        }
      });

      it('preserves edits for a write 401 and emits no navigation or close', async () => {
        const fixture = await modal();
        const component = fixture.componentInstance;
        component['draft'].update((value) => ({ ...value, nameEn: 'Unsaved' }));
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED'));
        await save(fixture);
        expect(component['draft']().nameEn).toBe('Unsaved');
        expect(fixture.nativeElement.querySelector('dialog').open).toBe(true);
        expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(text('settings.errors.notSaved'));
      });

      it('closes and asks for a reload when the source disappears during upload', async () => {
        const fixture = await modal();
        const reload = vi.fn();
        fixture.componentInstance.reloadRequested.subscribe(reload);
        vi.spyOn(stub, 'writeMultipart').mockRejectedValueOnce(new ApiError(404, 'CRM_ACQUISITION_SOURCE_NOT_FOUND'));
        await fixture.componentInstance['onIconPicked'](iconFile());
        await settle(fixture);
        expect(reload).toHaveBeenCalledOnce();
        expect(fixture.nativeElement.querySelector('dialog').open).toBe(false);
      });

      it('shows real validation messages under their named field', async () => {
        const fixture = await modal();
        fixture.componentInstance['draft'].update((value) => ({ ...value, nameEn: 'Invalid' }));
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(400, 'CRM_VALIDATION_FAILED', { nameEn: ['Name is invalid'] }));
        await save(fixture);
        expect(fixture.componentInstance['errorOf']('nameEn')).toBe('Name is invalid');
        expect(fixture.componentInstance['errorOf']('nameAr')).toBeNull();
      });

      it('propagates a read-only write error and hides Save without discarding values', async () => {
        const fixture = await modal();
        const component = fixture.componentInstance;
        const readOnly = vi.fn();
        component.becameReadOnly.subscribe(readOnly);
        component['draft'].update((value) => ({ ...value, nameEn: 'Pending change' }));
        vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'));
        await save(fixture);
        expect(readOnly).toHaveBeenCalledOnce();
        expect(component['draft']().nameEn).toBe('Pending change');
        expect(fixture.nativeElement.querySelector('input[id$="-name-en"]').readOnly).toBe(true);
        expect(fixture.nativeElement.querySelector('button[type="submit"]')).toBeNull();
      });

      it('renders shared rate-limit and idempotency feedback without losing values', async () => {
        const fixture = await modal();
        const component = fixture.componentInstance;
        component['draft'].update((value) => ({ ...value, nameEn: 'Pending change' }));
        const write = vi.spyOn(stub, 'write');
        for (const [status, code, details, key] of [
          [409, 'GW.IDEM.IN_FLIGHT', undefined, 'settings.errors.GW.IDEM.IN_FLIGHT'],
          [422, 'GW.IDEM.MISMATCH', undefined, 'settings.errors.GW.IDEM.MISMATCH'],
          [429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['12'] }, 'settings.errors.rateLimitedIn'],
        ] as const) {
          write.mockRejectedValueOnce(new ApiError(status, code, details));
          await save(fixture);
          expect(component['draft']().nameEn).toBe('Pending change');
          expect(TestBed.inject(Notify).toasts().at(-1)?.title).toBe(TestBed.inject(TranslocoService).translate(key, { seconds: '12' }));
        }
      });
    });
  });
}
