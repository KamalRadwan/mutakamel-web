import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../../../../../public/i18n/ar.json';
import en from '../../../../../../../public/i18n/en.json';
import arSettings from '../../../../../../../public/i18n/settings/ar.json';
import enSettings from '../../../../../../../public/i18n/settings/en.json';
import arTags from '../../../../../../../public/i18n/settings-tags/ar.json';
import enTags from '../../../../../../../public/i18n/settings-tags/en.json';
import { FAKE_TENANT_ME } from '../../../../../core/auth/auth-session.fake';
import type { TenantMe } from '../../../../../core/auth/auth-session.model';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../core/scope/tenant-scope';
import { bindCrmHttpForTest, crmQueries } from '../../../shared/crm-http';
import { CrmHttpStub } from '../../../shared/testing/crm-http-testing';
import { TagModal } from './tag-modal';

@Injectable()
class TagModalLoader implements TranslocoLoader {
  getTranslation(path: string) {
    const arabic = path.endsWith('ar');
    if (path.startsWith('settings-tags/')) return of(arabic ? arTags : enTags);
    if (path.startsWith('settings/')) return of(arabic ? arSettings : enSettings);
    return of(arabic ? ar : en);
  }
}

function createTenantWideTagsActor(): TenantMe {
  return {
    ...FAKE_TENANT_ME,
    isTenantOwner: false,
    permissions: ['crm.tags.read.team', 'crm.tags.manage.team'],
    permissionScopes: {
      'crm.tags.read.team': { tenantWide: true, companyIds: [], branchIds: [] },
      'crm.tags.manage.team': { tenantWide: true, companyIds: [], branchIds: [] },
    },
  };
}

describe('TagModal custom colour picker', () => {
  const me = signal<TenantMe | null>(createTenantWideTagsActor());
  const dialogPrototype = HTMLDialogElement.prototype;
  const originalShow = dialogPrototype.showModal;
  const originalClose = dialogPrototype.close;
  let stub: CrmHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    TestBed.resetTestingModule();
    dialogPrototype.showModal = function () {
      this.setAttribute('open', '');
    };
    dialogPrototype.close = function () {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };

    me.set(createTenantWideTagsActor());
    stub = new CrmHttpStub({ '/tags': [] });
    dispose = bindCrmHttpForTest(stub);

    TestBed.configureTestingModule({
      imports: [TagModal],
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['en', 'ar'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
          },
          loader: TagModalLoader,
        }),
        { provide: TenantScopeState, useValue: { me } },
        { provide: LanguageState, useValue: { current: signal<'en' | 'ar'>('en') } },
        { provide: Notify, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });

    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation({ ...en, settings: enSettings, tags: enTags }, 'en');
    transloco.setTranslation({ ...ar, settings: arSettings, tags: arTags }, 'ar');
  });

  afterEach(() => {
    dialogPrototype.showModal = originalShow;
    dialogPrototype.close = originalClose;
    crmQueries().clear();
    dispose();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('uses ui-color-picker with allowAlpha=false, keeps hints and low-contrast warning, and saves #RRGGBB', async () => {
    const fixture = TestBed.createComponent(TagModal);
    fixture.componentRef.setInput('canManage', true);
    const modal = fixture.componentInstance;
    const host: HTMLElement = fixture.nativeElement;

    fixture.detectChanges();
    await fixture.whenStable();

    modal.openCreate();
    fixture.detectChanges();
    await fixture.whenStable();

    modal['selectCustom']();
    fixture.detectChanges();
    await fixture.whenStable();

    const pickers = host.querySelectorAll<HTMLElement>('ui-color-picker');
    expect(pickers).toHaveLength(2);

    const firstPicker = pickers[0];
    if (!firstPicker) throw new Error('Missing background picker');
    const trigger = firstPicker.querySelector<HTMLElement>('[data-color-trigger]');
    if (!trigger) throw new Error('Missing picker trigger');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(firstPicker.querySelector('[data-color-popover]')).not.toBeNull();
    expect(firstPicker.querySelector('[data-alpha-bar]')).toBeNull();
    document.body.click();
    fixture.detectChanges();

    modal['onColorPicked']('bg', '#DBEAFE');
    modal['onColorPicked']('text', '#BFDBFE');
    fixture.detectChanges();
    expect(modal['lowContrast']()).toBe(true);
    expect(host.textContent).toContain(enTags.form.lowContrast);

    modal['onColorPicked']('bg', '#1d56c9');
    modal['onColorPicked']('text', '#ffffff');
    modal['name'].set('Priority');
    fixture.detectChanges();
    expect(modal['lowContrast']()).toBe(false);

    for (const lang of ['en', 'ar'] as const) {
      TestBed.inject(TranslocoService).setActiveLang(lang);
      fixture.detectChanges();
      await fixture.whenStable();
      for (const field of host.querySelectorAll('ui-field')) {
        expect(field.querySelector('[data-ui-hint]')).not.toBeNull();
      }
    }

    vi.spyOn(stub, 'write').mockResolvedValueOnce({
      status: 201,
      etag: null,
      location: null,
      data: {
        id: 'tag-1',
        name: 'Priority',
        backgroundColor: '#1D56C9',
        textColor: '#FFFFFF',
        createdAt: '2026-11-23T00:00:00Z',
        updatedAt: '2026-11-23T00:00:00Z',
      },
    });

    await modal['save']();
    expect(stub.write).toHaveBeenCalledWith(
      'POST',
      '/tags',
      { name: 'Priority', backgroundColor: '#1D56C9', textColor: '#FFFFFF' },
      expect.anything(),
    );

    fixture.destroy();
  });
});
