import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, provideTransloco, provideTranslocoScope, type Translation } from '@jsverse/transloco';
import { firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import globalEn from '../../../../../../../../public/i18n/en.json';
import toolsEn from '../../../../../../../../public/i18n/templates-designer-tools/en.json';
import templatesEn from '../../../../../../../../public/i18n/templates/en.json';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Notify } from '../../../../../../core/notify/notify';
import { TenantScopeState } from '../../../../../../core/scope/tenant-scope';
import { AssetsApi } from '../../../assets/assets.api';
import type { TemplateAssetDto } from '../../../templates.model';
import { DesignerState } from '../../designer-state';
import { ImagePicker } from './image-picker';

class Loader {
  getTranslation(lang: string) {
    if (lang.startsWith('templates-designer-tools/')) return of(toolsEn as unknown as Translation);
    if (lang.startsWith('templates/')) return of(templatesEn as unknown as Translation);
    return of({
      ...globalEn,
      templates: templatesEn,
      tplTools: toolsEn,
    } as unknown as Translation);
  }
}

const BASE = '/api/tenant/core/v1/templates/assets';

function makeAsset(overrides: Partial<TemplateAssetDto> = {}): TemplateAssetDto {
  return {
    assetId: '01948100-0000-7000-8000-000000004001',
    definitionId: null,
    assetType: 'LOGO',
    originalFileName: 'logo.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    widthPx: 200,
    heightPx: 100,
    checksum: 'a'.repeat(64),
    deliveryClass: 'EMAIL_PUBLIC',
    emailRendition: { kind: 'READY', checksum: 'b'.repeat(64) },
    status: 'ACTIVE',
    revision: 1,
    etag: '"asset:01948100-0000-7000-8000-000000004001:1"',
    createdAt: '2026-11-20T10:00:00Z',
    createdBy: { kind: 'USER', actorId: 'actor', displayName: 'User' },
    updatedAt: '2026-11-20T10:00:00Z',
    updatedBy: { kind: 'USER', actorId: 'actor', displayName: 'User' },
    ...overrides,
  };
}

describe('ImagePicker', () => {
  const channel = signal<'PRINT' | 'EMAIL' | null>('EMAIL');
  const layoutMode = signal<'HYBRID_DOCUMENT' | 'EMAIL_FLOW' | 'FLOW_DOCUMENT' | 'FIXED_CANVAS' | null>('EMAIL_FLOW');
  const notify = { error: vi.fn(), info: vi.fn(), warning: vi.fn(), success: vi.fn() };
  const insertNode = vi.fn(() => 'new-node-id');
  const updateNode = vi.fn();
  const requestAsset = vi.fn();
  let origCreateObjectUrl: PropertyDescriptor | undefined;
  let origRevokeObjectUrl: PropertyDescriptor | undefined;
  let createMock: ReturnType<typeof vi.fn>;
  let revokeMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    channel.set('EMAIL');
    layoutMode.set('EMAIL_FLOW');
    notify.error.mockClear();
    insertNode.mockClear();
    updateNode.mockClear();
    requestAsset.mockClear();

    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });
    origCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    origRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    createMock = vi.fn(() => 'blob:picker');
    revokeMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createMock });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeMock });

    TestBed.configureTestingModule({
      imports: [ImagePicker],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslocoScope('templates', { scope: 'templates-designer-tools', alias: 'tplTools' }),
        provideTransloco({
          config: { availableLangs: ['en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: Loader,
        }),
        { provide: TenantScopeState, useValue: { me: signal({ id: 'actor' }), selection: signal(null) } },
        { provide: LanguageState, useValue: { current: signal('en') } },
        { provide: Notify, useValue: notify },
        {
          provide: DesignerState,
          useValue: {
            channel,
            layoutMode,
            currentPage: signal(null),
            document: signal(null),
            insertNode,
            updateNode,
            requestAsset,
          },
        },
      ],
    });

    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (origCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', origCreateObjectUrl);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (origRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', origRevokeObjectUrl);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  it('reads EMAIL_PUBLIC assets and binary previews through AssetsApi and revokes object URLs on destroy', async () => {
    const fixture = TestBed.createComponent(ImagePicker);
    const http = TestBed.inject(HttpTestingController);
    const list = vi.spyOn(TestBed.inject(AssetsApi), 'listAssets');
    const content = vi.spyOn(TestBed.inject(AssetsApi), 'getAssetContent');

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.openInsert();

    const asset = makeAsset({ assetId: 'asset' });
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('scope')).toBe('ALL_AUTHORIZED');
    expect(req.request.params.get('status')).toBe('ACTIVE');
    expect(req.request.params.get('deliveryClass')).toBe('EMAIL_PUBLIC');
    req.flush({
      success: true,
      data: {
        items: [asset],
        pageInfo: { limit: 12, hasNextPage: false, nextCursor: null },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const contentReq = http.expectOne(`${BASE}/asset/content`);
    expect(contentReq.request.responseType).toBe('blob');
    expect(contentReq.request.withCredentials).toBe(true);
    contentReq.flush(new Blob(['png'], { type: 'image/png' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(list).toHaveBeenCalledOnce();
    expect(content).toHaveBeenCalledWith('asset');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('blob:picker');

    fixture.destroy();
    expect(revokeMock).toHaveBeenCalledWith('blob:picker');
    http.verify();
  });

  it('omits deliveryClass on print templates, recovers from CURSOR.INVALID on loadMore, and maps loadMore errors', async () => {
    channel.set('PRINT');
    layoutMode.set('HYBRID_DOCUMENT');

    const fixture = TestBed.createComponent(ImagePicker);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.openInsert();
    const firstReq = http.expectOne((r) => r.url === BASE);
    expect(firstReq.request.params.get('deliveryClass')).toBeNull();
    firstReq.flush({
      success: true,
      data: {
        items: [makeAsset({ assetId: 'a1', mimeType: 'image/webp' })],
        pageInfo: { limit: 12, hasNextPage: true, nextCursor: 'cur-1' },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne(`${BASE}/a1/content`).flush(new Blob(['webp'], { type: 'image/webp' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(fixture.componentInstance['formatMime']('image/webp')).toBe('WEBP');

    // Invalid cursor on loadMore resets pagination to the first page without error toast.
    fixture.componentInstance['loadMore']();
    const moreReq = http.expectOne((r) => r.url === BASE && r.params.get('cursor') === 'cur-1');
    moreReq.flush({ errorCode: 'CORE.TEMPLATE.CURSOR.INVALID' }, { status: 400, statusText: 'Bad Request' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const resetReq = http.expectOne((r) => r.url === BASE && r.params.get('cursor') === null);
    resetReq.flush({
      success: true,
      data: {
        items: [makeAsset({ assetId: 'a1' })],
        pageInfo: { limit: 12, hasNextPage: true, nextCursor: 'cur-2' },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(notify.error).not.toHaveBeenCalled();

    // Backend domain error on loadMore maps through existing templates error translations.
    fixture.componentInstance['loadMore']();
    const errReq = http.expectOne((r) => r.url === BASE && r.params.get('cursor') === 'cur-2');
    errReq.flush(
      { errorCode: 'CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(notify.error).toHaveBeenCalledWith(templatesEn.errors['CORE.TEMPLATE.DEPENDENCY.UNAVAILABLE']);

    fixture.destroy();
    http.verify();
  });
});
